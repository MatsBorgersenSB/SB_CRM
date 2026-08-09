import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import {
  buildEmailThreadSummary,
  purgeConversationForContact,
  readEmailsForContact,
  resolveContactIdForEmails,
  setConversationOpportunityForContact,
} from "@/lib/email-intelligence-data";
import { findPrismaContactByIdOrEmail } from "@/lib/resolve-contact-route";
import { getPrisma } from "@/lib/prisma";

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
          opportunityOptions: [],
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

    const contact = await findPrismaContactByIdOrEmail(contactKey);
    const prisma = getPrisma();
    const companyScoped = contact?.companyId
      ? await prisma.opportunity.findMany({
          where: { status: "open", companyId: contact.companyId },
          select: { id: true, name: true, code: true },
          orderBy: { updatedAt: "desc" },
          take: 50,
        })
      : [];

    const broader = await prisma.opportunity.findMany({
      where: {
        status: "open",
        ...(companyScoped.length > 0
          ? { id: { notIn: companyScoped.map((row) => row.id) } }
          : {}),
      },
      select: { id: true, name: true, code: true },
      orderBy: { updatedAt: "desc" },
      take: 40,
    });

    const opportunityRows = [...companyScoped, ...broader];

    // Always include currently linked deals even if closed / other company.
    const linkedIds = [
      ...new Set(
        emails
          .map((email) => email.opportunityId)
          .filter((id): id is string => Boolean(id)),
      ),
    ].filter((id) => !opportunityRows.some((row) => row.id === id));

    if (linkedIds.length > 0) {
      const linked = await prisma.opportunity.findMany({
        where: { id: { in: linkedIds } },
        select: { id: true, name: true, code: true },
      });
      opportunityRows.push(...linked);
    }

    return NextResponse.json({
      contactId,
      emails,
      threads,
      opportunityOptions: opportunityRows.map((row) => ({
        id: row.id,
        label: row.code ? `${row.code} · ${row.name}` : row.name,
        code: row.code,
        name: row.name,
      })),
    });
  } catch (error) {
    console.error("[contact emails GET]", error);
    return NextResponse.json(
      {
        error: "Failed to load emails",
        detail: error instanceof Error ? error.message : "Unknown error",
        emails: [],
        threads: [],
        opportunityOptions: [],
      },
      { status: 500 },
    );
  }
}

/**
 * Link / unlink a conversation to an opportunity.
 * Body: { conversationId, opportunityId: string | null }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> },
) {
  const { contactId: contactKey } = await params;
  const role = getRequestRole(request);

  if (role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      conversationId?: string;
      opportunityId?: string | null;
    };
    const conversationId = body.conversationId?.trim();
    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId is required" },
        { status: 400 },
      );
    }

    const opportunityId =
      typeof body.opportunityId === "string" && body.opportunityId.trim()
        ? body.opportunityId.trim()
        : null;

    const result = await setConversationOpportunityForContact(
      contactKey,
      conversationId,
      opportunityId,
    );

    if (result.updated === 0 && opportunityId) {
      return NextResponse.json(
        { error: "Opportunity not found or no messages to update" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      ...result,
      conversationId,
      opportunityId,
    });
  } catch (error) {
    console.error("[contact emails PATCH]", error);
    return NextResponse.json(
      {
        error: "Failed to update email link",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * Purge a conversation from SmartCRM (private / irrelevant sync).
 * Does not change Outlook. Body: { conversationId, action?: "purge" }
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> },
) {
  const { contactId: contactKey } = await params;
  const role = getRequestRole(request);

  if (role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      conversationId?: string;
      action?: string;
    };
    const conversationId = body.conversationId?.trim();
    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId is required" },
        { status: 400 },
      );
    }

    const contactId = await resolveContactIdForEmails(contactKey);
    if (!contactId) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const result = await purgeConversationForContact(contactKey, conversationId);
    if (result.purged === 0) {
      return NextResponse.json(
        { error: "No matching emails to remove" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      conversationId,
      purged: result.purged,
    });
  } catch (error) {
    console.error("[contact emails DELETE]", error);
    return NextResponse.json(
      {
        error: "Failed to remove emails",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
