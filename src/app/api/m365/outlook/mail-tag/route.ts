import { NextResponse } from "next/server";
import { getRequestRole, resolveRequestRole } from "@/lib/api-auth";
import {
  captureOutlookMessageForContact,
  setConversationLinksForContact,
} from "@/lib/email-intelligence-data";
import {
  getCompanyRelationshipPosture,
  isOpportunityEligibleCompany,
} from "@/lib/company-classification";
import { loadM365DataContext, resolveCompanyFromInput } from "@/lib/m365";
import { getPrisma } from "@/lib/prisma";
import { readProjects } from "@/lib/project-db";
import { findPrismaCompanyByRouteKey } from "@/lib/resolve-company-route";

type LinkOption = {
  id: string;
  label: string;
  name: string;
  code?: string | null;
};

/**
 * Outlook add-in helpers for intentional opportunity/project mail tagging.
 * GET  ?email=&conversationId?  → contact + link options (+ current links)
 * PATCH { contactId, conversationId, message?, opportunityId?, projectId? }
 * Omit opportunity/project to capture relationship mail onto the contact.
 */
export async function GET(request: Request) {
  const role = getRequestRole(request);
  if (role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.trim().toLowerCase() || "";
  const conversationId = searchParams.get("conversationId")?.trim() || "";

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  try {
    const ctx = await loadM365DataContext();
    const resolved = resolveCompanyFromInput(ctx.companies, { email });
    if (!resolved?.contact) {
      return NextResponse.json(
        { error: "No matching contact for this email", email },
        { status: 404 },
      );
    }

    const contactId = resolved.contact.ContactID;
    const companyId = resolved.company.CompanyID;
    const prisma = getPrisma();
    const prismaCompany = await findPrismaCompanyByRouteKey(companyId).catch(() => null);
    const prismaCompanyId =
      prismaCompany?.id ??
      (/^[0-9a-f-]{36}$/i.test(companyId) ? companyId : null);

    const companyScoped = prismaCompanyId
      ? await prisma.opportunity.findMany({
          where: { status: "open", companyId: prismaCompanyId },
          select: { id: true, name: true, code: true },
          orderBy: { updatedAt: "desc" },
          take: 50,
        })
      : [];
    const companyRows = await prisma.company.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { updatedAt: "desc" },
      take: 120,
    });
    const dedupCompanyIds = new Set<string>();
    const companyOptions: LinkOption[] = [];
    const pushCompany = (row: { id: string; name: string; code: string | null }) => {
      if (dedupCompanyIds.has(row.id)) return;
      dedupCompanyIds.add(row.id);
      companyOptions.push({
        id: row.id,
        name: row.name,
        code: row.code,
        label: row.code ? `${row.code} · ${row.name}` : row.name,
      });
    };
    if (prismaCompanyId) {
      const current = companyRows.find((row) => row.id === prismaCompanyId);
      if (current) pushCompany(current);
    }
    for (const row of companyRows) pushCompany(row);
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

    const projects = await readProjects();
    const projectOptions: LinkOption[] = projects.slice(0, 80).map((project) => ({
      id: project.id,
      label: project.linkedCompanyId
        ? `${project.name} · ${project.linkedCompanyId}`
        : project.name,
      name: project.name,
    }));

    let currentOpportunityId: string | null = null;
    let currentProjectId: string | null = null;
    if (conversationId) {
      const sample = await prisma.emailMessageRecord.findFirst({
        where: { conversationId },
        orderBy: { sentAt: "desc" },
        select: { opportunityId: true, projectId: true },
      });
      currentOpportunityId = sample?.opportunityId ?? null;
      currentProjectId = sample?.projectId ?? null;
    }

    return NextResponse.json({
      contactId,
      companyId,
      selectedCompanyId: prismaCompanyId,
      companyName: resolved.company.Title,
      contactName: resolved.contact.Title,
      conversationId: conversationId || null,
      currentOpportunityId,
      currentProjectId,
      relationshipPosture: getCompanyRelationshipPosture(resolved.company),
      opportunityEligible: isOpportunityEligibleCompany(resolved.company),
      companyOptions,
      opportunityOptions: opportunityRows.map(
        (row): LinkOption => ({
          id: row.id,
          label: row.code ? `${row.code} · ${row.name}` : row.name,
          code: row.code,
          name: row.name,
        }),
      ),
      projectOptions,
    });
  } catch (error) {
    console.error("[m365 outlook mail-tag GET]", error);
    return NextResponse.json(
      {
        error: "Failed to load mail tag options",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const role = await resolveRequestRole(request);
  if (role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      contactId?: string;
      conversationId?: string;
      opportunityId?: string | null;
      projectId?: string | null;
      message?: {
        externalMessageId?: string;
        subject?: string;
        senderEmail?: string;
        recipientEmails?: string[];
        sentAt?: string;
        bodyPreview?: string;
        webLink?: string;
        isOutbound?: boolean;
      };
    };

    const contactId = body.contactId?.trim();
    const conversationId = body.conversationId?.trim();
    if (!contactId || !conversationId) {
      return NextResponse.json(
        { error: "contactId and conversationId are required" },
        { status: 400 },
      );
    }

    const seedExternalId = body.message?.externalMessageId?.trim();
    const seedMessage = seedExternalId
      ? {
          externalMessageId: seedExternalId,
          subject: body.message?.subject,
          senderEmail: body.message?.senderEmail,
          recipientEmails: body.message?.recipientEmails,
          sentAt: body.message?.sentAt,
          bodyPreview: body.message?.bodyPreview,
          webLink: body.message?.webLink,
          isOutbound: body.message?.isOutbound === true,
        }
      : undefined;

    const hasLinkIntent =
      body.opportunityId !== undefined || body.projectId !== undefined;

    if (!hasLinkIntent) {
      if (!seedMessage) {
        return NextResponse.json(
          { error: "Open the mail in Outlook and try Mark in Outlook again." },
          { status: 400 },
        );
      }
      const captured = await captureOutlookMessageForContact(
        contactId,
        conversationId,
        seedMessage,
      );
      if (!captured.captured) {
        return NextResponse.json(
          {
            error:
              "Could not save this mail for the matched contact. Confirm the sender is linked, then try again.",
          },
          { status: 404 },
        );
      }
      return NextResponse.json({
        ok: true,
        capture: true,
        conversationId,
        ...captured,
      });
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
      contactId,
      conversationId,
      {
        opportunityId,
        projectId,
      },
      seedMessage ? { seedMessage } : undefined,
    );

    if (result.updated === 0) {
      return NextResponse.json(
        {
          error: seedExternalId
            ? "Could not tag this thread for the matched contact. Confirm the sender is linked to the contact, then try again."
            : "No matching emails to update yet. Open the mail in Outlook and try Tag this thread again.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, ...result, conversationId });
  } catch (error) {
    console.error("[m365 outlook mail-tag PATCH]", error);
    return NextResponse.json(
      {
        error: "Failed to tag mail",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * Save several Outlook messages onto one contact in one action.
 * POST { contactId, opportunityId?, projectId?, messages: [{ conversationId, message }] }
 */
export async function POST(request: Request) {
  const role = await resolveRequestRole(request);
  if (role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      contactId?: string;
      opportunityId?: string | null;
      projectId?: string | null;
      messages?: Array<{
        conversationId?: string;
        message?: {
          externalMessageId?: string;
          subject?: string;
          senderEmail?: string;
          recipientEmails?: string[];
          sentAt?: string;
          bodyPreview?: string;
          webLink?: string;
          isOutbound?: boolean;
        };
      }>;
    };

    const contactId = body.contactId?.trim();
    const messages = Array.isArray(body.messages) ? body.messages.slice(0, 50) : [];
    if (!contactId || messages.length === 0) {
      return NextResponse.json(
        { error: "contactId and messages are required" },
        { status: 400 },
      );
    }

    const opportunityId =
      typeof body.opportunityId === "string" && body.opportunityId.trim()
        ? body.opportunityId.trim()
        : undefined;
    const projectId =
      typeof body.projectId === "string" && body.projectId.trim()
        ? body.projectId.trim()
        : undefined;

    let saved = 0;
    let failed = 0;

    for (const row of messages) {
      const conversationId = row.conversationId?.trim();
      const externalMessageId = row.message?.externalMessageId?.trim();
      if (!conversationId || !externalMessageId) {
        failed += 1;
        continue;
      }
      const seedMessage = {
        externalMessageId,
        subject: row.message?.subject,
        senderEmail: row.message?.senderEmail,
        recipientEmails: row.message?.recipientEmails,
        sentAt: row.message?.sentAt,
        bodyPreview: row.message?.bodyPreview,
        webLink: row.message?.webLink,
        isOutbound: row.message?.isOutbound === true,
      };

      if (opportunityId !== undefined || projectId !== undefined) {
        const result = await setConversationLinksForContact(
          contactId,
          conversationId,
          { opportunityId: opportunityId ?? null, projectId: projectId ?? null },
          { seedMessage },
        );
        if (result.updated > 0) saved += 1;
        else failed += 1;
        continue;
      }

      const captured = await captureOutlookMessageForContact(
        contactId,
        conversationId,
        seedMessage,
      );
      if (captured.captured) saved += 1;
      else failed += 1;
    }

    return NextResponse.json({
      ok: saved > 0,
      saved,
      failed,
      total: messages.length,
    });
  } catch (error) {
    console.error("[m365 outlook mail-tag POST]", error);
    return NextResponse.json(
      {
        error: "Failed to save mail",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
