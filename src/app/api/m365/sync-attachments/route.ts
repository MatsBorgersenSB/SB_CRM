import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { getPrisma } from "@/lib/prisma";
import {
  fetchM365MessageAttachments,
  getActiveM365AccessToken,
} from "@/lib/m365-client";
import {
  ingestEmailAttachmentToCompanySmartDocs,
  ingestEmailAttachmentToSmartDocs,
} from "@/lib/smartdocs-ingestion";
import { getSessionAzureOid } from "@/lib/m365/session-graph-user";
import { resolveOpportunityRelationId } from "@/lib/smartdocs-resolve-opportunity-relation-id";
import { readProjectById } from "@/lib/project-db";

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

    const ingestedDocuments: unknown[] = [];
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
            attachment,
          });
          documentsSaved += 1;
          ingestedDocuments.push(doc);
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
          attachment,
        });
        documentsSaved += 1;
        ingestedDocuments.push(doc);
      }
    }

    return NextResponse.json({
      success: true,
      emailCount: emails.length,
      fetchedAttachments,
      documentsSaved,
      skippedEmailCount,
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
