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
        if (email.opportunityId) {
          const doc = await ingestEmailAttachmentToSmartDocs({
            opportunityId: email.opportunityId,
            emailMessageId: email.id,
            attachment,
          });
          documentsSaved += 1;
          ingestedDocuments.push(doc);
          continue;
        }

        const companyId = email.contact?.companyId ?? email.contact?.company?.id ?? null;
        const companyName = email.contact?.company?.name ?? null;
        if (!companyId || !companyName) {
          skippedEmailCount += 1;
          continue;
        }

        const doc = await ingestEmailAttachmentToCompanySmartDocs({
          companyId,
          companyName,
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
