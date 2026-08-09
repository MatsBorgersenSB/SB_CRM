import { NextResponse } from "next/server";
import {
  buildEmailThreadSummary,
  readEmailsForContact,
  resolveContactIdForEmails,
} from "@/lib/email-intelligence-data";

/**
 * Person-lens Outlook mail for Contact 360 (live EmailMessageRecord).
 * GET /api/contacts/[contactId]/emails
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ contactId: string }> },
) {
  const { contactId: contactKey } = await params;

  try {
    const contactId = await resolveContactIdForEmails(contactKey);
    if (!contactId) {
      return NextResponse.json(
        {
          error: "Contact not found",
          contactKey,
          emails: [],
          threads: [],
        },
        { status: 404 },
      );
    }

    const emails = await readEmailsForContact(contactKey);
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
      contactId,
      emails,
      threads,
    });
  } catch (error) {
    console.error("[contact emails GET]", error);
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
