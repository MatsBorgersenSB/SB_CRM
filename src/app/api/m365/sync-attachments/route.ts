import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { getPrisma } from "@/lib/prisma";
import {
  fetchM365MessageAttachments,
  getActiveM365AccessToken,
  type M365AttachmentMeta,
} from "@/lib/m365-client";
import {
  ingestEmailAttachmentToCompanySmartDocs,
  ingestEmailAttachmentToSmartDocs,
} from "@/lib/smartdocs-ingestion";
import { getSessionAzureOid } from "@/lib/m365/session-graph-user";
import { resolveOpportunityRelationId } from "@/lib/smartdocs-resolve-opportunity-relation-id";
import { readProjectById } from "@/lib/project-db";
import { classifyByFileName } from "@/lib/mock-ai-parser";
import JSZip from "jszip";

const ZIP_EXTENSIONS = new Set([".zip"]);
const EXTRACTABLE_EXTENSIONS = new Set([".pdf", ".docx", ".xlsx", ".pptx", ".png"]);
const MAX_ZIP_ENTRIES = 40;

function fileExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}

function guessContentType(fileName: string): string {
  const ext = fileExtension(fileName);
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".docx")
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === ".xlsx")
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === ".pptx")
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (ext === ".png") return "image/png";
  return "application/octet-stream";
}

async function extractSupportedZipAttachments(
  attachment: M365AttachmentMeta,
): Promise<M365AttachmentMeta[]> {
  if (!ZIP_EXTENSIONS.has(fileExtension(attachment.name)) || !attachment.contentBytes) return [];
  const zip = await JSZip.loadAsync(Buffer.from(attachment.contentBytes, "base64"));
  const extracted: M365AttachmentMeta[] = [];
  for (const [entryPath, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    if (!EXTRACTABLE_EXTENSIONS.has(fileExtension(entry.name))) continue;
    const bytes = await entry.async("uint8array");
    extracted.push({
      id: `${attachment.id}::${entryPath}`,
      name: entry.name.split("/").pop() || entry.name,
      contentType: guessContentType(entry.name),
      size: bytes.byteLength,
      contentBytes: Buffer.from(bytes).toString("base64"),
    });
    if (extracted.length >= MAX_ZIP_ENTRIES) break;
  }
  return extracted;
}

/**
 * POST /api/m365/sync-attachments
 * Body: { emailMessageId: string, integrationId?: string }
 *
 * Pulls commercial attachments from Graph for the linked EmailMessageRecord
 * and upserts SmartDocs DocumentRecord rows.
 */
export async function POST(request: Request) {
  const role = getRequestRole(request);
  if (role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      emailMessageId?: string;
      emailExternalMessageIds?: string[];
      integrationId?: string;
      companyId?: string | null;
      opportunityId?: string | null;
      projectId?: string | null;
    };

    const emailMessageId = body.emailMessageId?.trim();
    const emailExternalMessageIds = Array.isArray(body.emailExternalMessageIds)
      ? body.emailExternalMessageIds.map((id) => id?.trim()).filter(Boolean)
      : [];

    if (!emailMessageId && emailExternalMessageIds.length === 0) {
      return NextResponse.json(
        { error: "emailMessageId or emailExternalMessageIds are required" },
        { status: 400 },
      );
    }

    const forcedCompanyId =
      typeof body.companyId === "string" && body.companyId.trim()
        ? body.companyId.trim()
        : undefined;
    const forcedOpportunityId =
      typeof body.opportunityId === "string" && body.opportunityId.trim()
        ? body.opportunityId.trim()
        : undefined;
    const forcedProjectId =
      typeof body.projectId === "string" && body.projectId.trim()
        ? body.projectId.trim()
        : undefined;

    const prisma = getPrisma();
    const emails =
      emailMessageId != null
        ? await prisma.emailMessageRecord.findMany({
            where: { id: emailMessageId },
            select: {
              id: true,
              externalMessageId: true,
              opportunityId: true,
              contact: {
                select: {
                  companyId: true,
                  company: {
                    select: { id: true, name: true },
                  },
                },
              },
            },
          })
        : await prisma.emailMessageRecord.findMany({
            where: { externalMessageId: { in: emailExternalMessageIds } },
            select: {
              id: true,
              externalMessageId: true,
              opportunityId: true,
              contact: {
                select: {
                  companyId: true,
                  company: {
                    select: { id: true, name: true },
                  },
                },
              },
            },
          });

    if (!emails || emails.length === 0) {
      return NextResponse.json({ error: "No email messages found" }, { status: 404 });
    }

    const forcedOpportunity = forcedOpportunityId
      ? await prisma.opportunity.findUnique({
          where: { id: forcedOpportunityId },
          select: { id: true },
        })
      : null;
    if (forcedOpportunityId && !forcedOpportunity) {
      return NextResponse.json({ error: "Selected opportunity not found" }, { status: 400 });
    }

    const forcedProject = forcedProjectId ? await readProjectById(forcedProjectId) : null;
    if (forcedProjectId && !forcedProject) {
      return NextResponse.json({ error: "Selected project not found" }, { status: 400 });
    }

    const projectMappedOpportunityId = await resolveOpportunityRelationId(
      forcedProject?.linkedDealId ?? null,
    );

    const forcedCompany = forcedCompanyId
      ? await prisma.company.findUnique({
          where: { id: forcedCompanyId },
          select: { id: true, name: true },
        })
      : null;
    if (forcedCompanyId && !forcedCompany) {
      return NextResponse.json({ error: "Selected company not found" }, { status: 400 });
    }

    let integrationId = body.integrationId?.trim() || null;
    if (!integrationId) {
      const oid = await getSessionAzureOid();
      const active = await getActiveM365AccessToken(oid);
      integrationId = active?.integrationId ?? null;
    }
    if (!integrationId) {
      return NextResponse.json(
        { error: "No active M365 integration — connect Outlook first" },
        { status: 409 },
      );
    }

    let fetchedAttachments = 0;
    let documentsSaved = 0;
    let skippedEmailCount = 0;
    let zipArchivesDetected = 0;
    let zipFilesExtracted = 0;

    const ingestedDocuments: Array<{ id: string; name: string }> = [];
    for (const email of emails) {
      const messageId = email.externalMessageId;
      if (!messageId) {
        skippedEmailCount += 1;
        continue;
      }

      const emailAttachments = await fetchM365MessageAttachments({
        integrationId,
        messageId,
      });
      fetchedAttachments += emailAttachments.length;

      // If opportunityId exists, we file docs under the opportunity folder.
      // Otherwise (FS-006 phase 1), we file under the company documents folder.
      for (const attachment of emailAttachments) {
        let expandedAttachments: M365AttachmentMeta[] = [attachment];
        if (ZIP_EXTENSIONS.has(fileExtension(attachment.name))) {
          zipArchivesDetected += 1;
          const extracted = await extractSupportedZipAttachments(attachment);
          zipFilesExtracted += extracted.length;
          expandedAttachments = [attachment, ...extracted];
        }

        for (const expandedAttachment of expandedAttachments) {
        const emailOpportunityId = await resolveOpportunityRelationId(
          email.opportunityId ?? null,
        );
        const relationOpportunityId =
          forcedOpportunityId ??
          projectMappedOpportunityId ??
          emailOpportunityId ??
          undefined;
        const hasForcedCompany = Boolean(forcedCompany?.id);
        if (relationOpportunityId && !hasForcedCompany) {
          const doc = await ingestEmailAttachmentToSmartDocs({
            opportunityId: relationOpportunityId,
            emailMessageId: email.id,
            attachment: expandedAttachment,
          });
          documentsSaved += 1;
          ingestedDocuments.push({ id: doc.id, name: doc.name });
          continue;
        }

        const companyId =
          forcedCompany?.id ??
          email.contact?.companyId ??
          email.contact?.company?.id ??
          null;
        const companyName = forcedCompany?.name ?? email.contact?.company?.name ?? null;
        if (!companyId || !companyName) {
          skippedEmailCount += 1;
          continue;
        }

        const doc = await ingestEmailAttachmentToCompanySmartDocs({
          companyId,
          companyName,
          opportunityId: relationOpportunityId ?? null,
          emailMessageId: email.id,
          attachment: expandedAttachment,
        });
        documentsSaved += 1;
        ingestedDocuments.push({ id: doc.id, name: doc.name });
      }
      }
    }

    return NextResponse.json({
      success: true,
      emailCount: emails.length,
      fetchedAttachments,
      documentsSaved,
      skippedEmailCount,
      zipArchivesDetected,
      zipFilesExtracted,
      documents: ingestedDocuments.slice(0, 80).map((doc) => {
        const classified = classifyByFileName(doc.name);
        return {
          id: doc.id,
          name: doc.name,
          docCategory: classified.DocCategory,
          docType: classified.DocType,
        };
      }),
      linkContext: {
        companyId: forcedCompany?.id ?? null,
        opportunityId:
          forcedOpportunityId ??
          projectMappedOpportunityId ??
          null,
        projectId: forcedProject?.id ?? null,
      },
    });
  } catch (error) {
    console.error("[m365 sync-attachments]", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to sync attachments",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
