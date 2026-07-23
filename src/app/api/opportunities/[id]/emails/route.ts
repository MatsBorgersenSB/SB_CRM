import { NextResponse } from "next/server";
import {
  buildEmailThreadSummary,
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
