import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { getPrisma } from "@/lib/prisma";
import {
  fetchM365MessageAttachments,
  getActiveM365AccessToken,
} from "@/lib/m365-client";
import { ingestEmailAttachmentToSmartDocs } from "@/lib/smartdocs-ingestion";
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
      integrationId?: string;
    };

    const emailMessageId = body.emailMessageId?.trim();
    if (!emailMessageId) {
      return NextResponse.json({ error: "emailMessageId is required" }, { status: 400 });
    }

    const prisma = getPrisma();
    const email = await prisma.emailMessageRecord.findUnique({
      where: { id: emailMessageId },
      select: {
        id: true,
        externalMessageId: true,
        opportunityId: true,
      },
    });

    if (!email) {
      return NextResponse.json({ error: "Email message not found" }, { status: 404 });
    }
    if (!email.opportunityId) {
      return NextResponse.json(
        { error: "Email is not linked to an opportunity" },
        { status: 400 },
      );
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

    const attachments = await fetchM365MessageAttachments({
      integrationId,
      messageId: email.externalMessageId,
    });

    const ingested = [];
    for (const attachment of attachments) {
      ingested.push(
        await ingestEmailAttachmentToSmartDocs({
          opportunityId: email.opportunityId,
          emailMessageId: email.id,
          attachment,
        }),
      );
    }

    return NextResponse.json({
      success: true,
      emailMessageId: email.id,
      opportunityId: email.opportunityId,
      fetched: attachments.length,
      documents: ingested,
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
