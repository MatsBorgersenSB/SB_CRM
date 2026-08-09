import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import {
  buildEmailThreadSummary,
  purgeConversationForContact,
  readEmailsForContact,
  resolveContactIdForEmails,
  setConversationLinksForContact,
} from "@/lib/email-intelligence-data";
import { findPrismaContactByIdOrEmail } from "@/lib/resolve-contact-route";
import { getPrisma } from "@/lib/prisma";
import { readProjects } from "@/lib/project-db";
import { toContactTrackingId } from "@/lib/prisma-mappers";

function projectTouchesContact(
  project: Awaited<ReturnType<typeof readProjects>>[number],
  contactId: string,
  companyId: string | null,
  trackingId: string,
): boolean {
  if (companyId && project.linkedCompanyId === companyId) return true;
  if (
    companyId &&
    project.relatedOrganizations?.some((org) => org.companyId === companyId)
  ) {
    return true;
  }
  if (
    project.team?.some(
      (member) =>
        member.contactId === contactId ||
        member.contactId === trackingId ||
        member.contactId?.toUpperCase() === trackingId.toUpperCase(),
    )
  ) {
    return true;
  }
  if (
    project.projectStakeholders?.some(
      (row) =>
        row.contactId === contactId ||
        row.contactId === trackingId ||
        row.contactId?.toUpperCase() === trackingId.toUpperCase(),
    )
  ) {
    return true;
  }
  return false;
}

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
          projectOptions: [],
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
    const trackingId = toContactTrackingId(contactId);

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
    const linkedOppIds = [
      ...new Set(
        emails
          .map((email) => email.opportunityId)
          .filter((id): id is string => Boolean(id)),
      ),
    ].filter((id) => !opportunityRows.some((row) => row.id === id));

    if (linkedOppIds.length > 0) {
      const linked = await prisma.opportunity.findMany({
        where: { id: { in: linkedOppIds } },
        select: { id: true, name: true, code: true },
      });
      opportunityRows.push(...linked);
    }

    const allProjects = await readProjects();
    const relatedProjects = allProjects.filter((project) =>
      projectTouchesContact(
        project,
        contactId,
        contact?.companyId ?? null,
        trackingId,
      ),
    );
    const otherProjects = allProjects
      .filter((project) => !relatedProjects.some((row) => row.id === project.id))
      .slice(0, 40);
    const projectOptions: Array<{ id: string; label: string; name: string }> = [
      ...relatedProjects.map((row) => ({
        id: row.id,
        label: row.name,
        name: row.name,
      })),
      ...otherProjects.map((row) => ({
        id: row.id,
        label: row.name,
        name: row.name,
      })),
    ];

    const linkedProjectIds = [
      ...new Set(
        emails
          .map((email) => email.projectId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    for (const projectId of linkedProjectIds) {
      if (projectOptions.some((row) => row.id === projectId)) continue;
      const project = allProjects.find((row) => row.id === projectId);
      const linkedName =
        project?.name ??
        emails.find((email) => email.projectId === projectId)?.projectName ??
        projectId;
      projectOptions.push({
        id: projectId,
        label: linkedName,
        name: linkedName,
      });
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
      projectOptions,
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
        projectOptions: [],
      },
      { status: 500 },
    );
  }
}

/**
 * Link / unlink a conversation to an opportunity and/or project.
 * Body: { conversationId, opportunityId?: string | null, projectId?: string | null }
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
      projectId?: string | null;
    };
    const conversationId = body.conversationId?.trim();
    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId is required" },
        { status: 400 },
      );
    }

    if (body.opportunityId === undefined && body.projectId === undefined) {
      return NextResponse.json(
        { error: "opportunityId or projectId is required" },
        { status: 400 },
      );
    }

    const opportunityId =
      body.opportunityId === undefined
        ? undefined
        : typeof body.opportunityId === "string" && body.opportunityId.trim()
          ? body.opportunityId.trim()
          : null;

    const projectId =
      body.projectId === undefined
        ? undefined
        : typeof body.projectId === "string" && body.projectId.trim()
          ? body.projectId.trim()
          : null;

    const result = await setConversationLinksForContact(
      contactKey,
      conversationId,
      { opportunityId, projectId },
    );

    if (result.updated === 0) {
      return NextResponse.json(
        { error: "No matching emails to update, or related record not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      ...result,
      conversationId,
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
