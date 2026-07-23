import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import {
  buildEmailThreadSummary,
  purgeEmailFromSmartCrm,
  readEmailsForOpportunity,
  resolveOpportunityId,
} from "@/lib/email-intelligence-data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: opportunityKey } = await params;

  try {
    const opportunityId = await resolveOpportunityId(opportunityKey);
    if (!opportunityId) {
      return NextResponse.json(
        {
          error: "Opportunity not found",
          opportunityKey,
          emails: [],
          threads: [],
        },
        { status: 404 },
      );
    }

    const emails = await readEmailsForOpportunity(opportunityId);
    const byConversation = new Map<string, typeof emails>();
    for (const email of emails) {
      const list = byConversation.get(email.conversationId) ?? [];
      list.push(email);
      byConversation.set(email.conversationId, list);
    }

    const threads = [...byConversation.entries()].map(([conversationId, messages]) => ({
      conversationId,
      summary: buildEmailThreadSummary(messages),
      messages,
    }));

    return NextResponse.json({
      opportunityId,
      emails,
      threads,
    });
  } catch (error) {
    console.error("[emails GET]", error);
    return NextResponse.json(
      {
        error: "Failed to load emails",
        detail: error instanceof Error ? error.message : "Unknown error",
        emails: [],
        threads: [],
      },
      { status: 500 },
    );
  }
}

/**
 * Purge an email record from SmartCRM (explicit user sovereignty action).
 * Body: { emailId: string, action?: "purge" }
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: opportunityKey } = await params;
  const role = getRequestRole(request);

  if (role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      emailId?: string;
      action?: string;
    };
    const emailId = body.emailId;
    if (!emailId || typeof emailId !== "string") {
      return NextResponse.json({ error: "emailId is required" }, { status: 400 });
    }

    const purged = await purgeEmailFromSmartCrm(opportunityKey, emailId);
    if (!purged) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, purgedId: emailId });
  } catch (error) {
    console.error("[emails DELETE]", error);
    return NextResponse.json(
      {
        error: "Failed to purge email",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
