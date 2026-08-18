import { NextResponse } from "next/server";
import {
  buildEmailThreadSummary,
  readEmailsForCompany,
} from "@/lib/email-intelligence-data";

/**
 * Company-lens Outlook mail for Company 360.
 * GET /api/companies/[companyId]/emails
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId: companyKey } = await params;

  try {
    const emails = await readEmailsForCompany(companyKey);
    const byConversation = new Map<string, typeof emails>();
    for (const email of emails) {
      const list = byConversation.get(email.conversationId) ?? [];
      list.push(email);
      byConversation.set(email.conversationId, list);
    }

    const threads = [...byConversation.entries()]
      .map(([conversationId, messages]) => ({
        conversationId,
        summary: buildEmailThreadSummary(messages),
        messages,
      }))
      .sort((a, b) => {
        const aTime = a.summary?.latestSentAt ?? a.messages.at(-1)?.sentAt ?? "";
        const bTime = b.summary?.latestSentAt ?? b.messages.at(-1)?.sentAt ?? "";
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

    return NextResponse.json({
      companyId: companyKey,
      emails,
      threads,
    });
  } catch (error) {
    console.error("[company emails GET]", error);
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
