import "server-only";

import { getPrisma } from "@/lib/prisma";
import { emailsIncludeAddress } from "@/lib/entity-route-utils";
import { markEmailDeletedInSource } from "@/lib/email-intelligence-data";
import {
  applySmartCrmCategories,
  fetchGraphMe,
  fetchMailDelta,
  getAccessTokenForIntegration,
  type GraphMailMessage,
} from "@/lib/m365-client";

export type MailSyncIntegrationResult = {
  integrationId: string;
  status: "ok" | "skipped" | "error";
  upserted: number;
  tombstoned: number;
  pages: number;
  error?: string;
};

export type MailSyncSummary = {
  integrations: number;
  results: MailSyncIntegrationResult[];
};

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function collectRecipientEmails(message: GraphMailMessage): string[] {
  const addresses = [
    ...(message.toRecipients ?? []),
    ...(message.ccRecipients ?? []),
  ]
    .map((row) => normalizeEmail(row.emailAddress?.address))
    .filter(Boolean);
  return [...new Set(addresses)];
}

function extractParticipantEmails(message: GraphMailMessage): string[] {
  const sender = normalizeEmail(message.from?.emailAddress?.address);
  return [...new Set([sender, ...collectRecipientEmails(message)].filter(Boolean))];
}

function parseSentAt(message: GraphMailMessage): Date {
  const raw = message.sentDateTime || message.receivedDateTime;
  if (!raw) return new Date();
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

type ContactMatch = {
  id: string;
  companyId: string | null;
};

async function findContactsByEmails(
  emails: string[],
): Promise<ContactMatch[]> {
  if (emails.length === 0) return [];
  const prisma = getPrisma();
  const contacts = await prisma.contact.findMany({
    where: { status: "active" },
    select: { id: true, companyId: true, emails: true },
  });

  const emailSet = new Set(emails.map((email) => email.toLowerCase()));
  return contacts
    .filter((contact) =>
      [...emailSet].some((email) => emailsIncludeAddress(contact.emails, email)),
    )
    .map((contact) => ({ id: contact.id, companyId: contact.companyId }));
}

async function resolveConversationOpportunityId(
  conversationId: string,
): Promise<string | null> {
  if (!conversationId) return null;
  const prisma = getPrisma();
  const existing = await prisma.emailMessageRecord.findFirst({
    where: {
      conversationId,
      opportunityId: { not: null },
    },
    select: { opportunityId: true },
    orderBy: { sentAt: "desc" },
  });
  return existing?.opportunityId ?? null;
}

/**
 * Attribute to an opportunity when evidence is clear:
 * 1) prior conversation attribution, else
 * 2) single open opportunity for matched contact companies / roster.
 */
async function attributeOpportunity(input: {
  conversationId: string;
  participantEmails: string[];
}): Promise<{ opportunityId: string | null; contactId: string | null; opportunityName?: string }> {
  const prior = await resolveConversationOpportunityId(input.conversationId);
  const contacts = await findContactsByEmails(input.participantEmails);
  const contactId = contacts[0]?.id ?? null;

  if (prior) {
    const prisma = getPrisma();
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: prior },
      select: { id: true, name: true },
    });
    return {
      opportunityId: prior,
      contactId,
      opportunityName: opportunity?.name,
    };
  }

  if (contacts.length === 0) {
    return { opportunityId: null, contactId: null };
  }

  const prisma = getPrisma();
  const companyIds = [
    ...new Set(
      contacts
        .map((contact) => contact.companyId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const contactIds = contacts.map((contact) => contact.id);

  // Prefer company-linked open deals; also scan recent opens for roster hits.
  const pool = await prisma.opportunity.findMany({
    where: {
      status: "open",
      ...(companyIds.length > 0
        ? { OR: [{ companyId: { in: companyIds } }] }
        : {}),
    },
    select: {
      id: true,
      name: true,
      companyId: true,
      team: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  // When contacts have no company, or may sit on another account's roster,
  // widen to recent open opportunities for roster-only matches.
  const rosterPool =
    companyIds.length > 0
      ? pool
      : await prisma.opportunity.findMany({
          where: { status: "open" },
          select: {
            id: true,
            name: true,
            companyId: true,
            team: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: "desc" },
          take: 100,
        });

  const rosterMatches = rosterPool.filter((opportunity) => {
    if (companyIds.includes(opportunity.companyId)) return true;
    const team = Array.isArray(opportunity.team) ? opportunity.team : [];
    return team.some((member) => {
      if (!member || typeof member !== "object") return false;
      const contactIdValue = (member as { contactId?: unknown }).contactId;
      return (
        typeof contactIdValue === "string" && contactIds.includes(contactIdValue)
      );
    });
  });

  if (rosterMatches.length === 1) {
    return {
      opportunityId: rosterMatches[0]!.id,
      contactId,
      opportunityName: rosterMatches[0]!.name,
    };
  }

  // Multiple open deals for the same company — leave unattributed (FS-009: no silent guess).
  return { opportunityId: null, contactId };
}

async function upsertGraphMessage(input: {
  message: GraphMailMessage;
  mailboxEmail: string;
  accessToken: string;
}): Promise<"upserted" | "skipped"> {
  const externalMessageId = input.message.id?.trim();
  if (!externalMessageId) return "skipped";

  if (input.message["@removed"]) {
    await markEmailDeletedInSource(externalMessageId);
    return "upserted";
  }

  const senderEmail = normalizeEmail(input.message.from?.emailAddress?.address);
  if (!senderEmail) return "skipped";

  const recipientEmails = collectRecipientEmails(input.message);
  const participantEmails = extractParticipantEmails(input.message);
  const conversationId =
    input.message.conversationId?.trim() || `msg-${externalMessageId}`;
  const mailbox = normalizeEmail(input.mailboxEmail);
  const isOutbound = Boolean(mailbox) && senderEmail === mailbox;

  // Still persist internal-only mail; UI defaults to external filter (FS-009).
  const attribution = await attributeOpportunity({
    conversationId,
    participantEmails,
  });

  const prisma = getPrisma();
  const data = {
    conversationId,
    opportunityId: attribution.opportunityId,
    contactId: attribution.contactId,
    subject: input.message.subject?.trim() || "(no subject)",
    bodyPreview: input.message.bodyPreview?.slice(0, 2000) ?? null,
    senderEmail,
    recipientEmails,
    sentAt: parseSentAt(input.message),
    isOutbound,
    isDeletedInSource: false,
    deletedAtInSource: null as Date | null,
  };

  const existing = await prisma.emailMessageRecord.findUnique({
    where: { externalMessageId },
    select: { id: true, opportunityId: true, m365CategoryName: true },
  });

  let recordId: string;
  if (existing) {
    // Keep an existing opportunity link if the new pass could not attribute.
    const opportunityId = data.opportunityId ?? existing.opportunityId;
    const updated = await prisma.emailMessageRecord.update({
      where: { id: existing.id },
      data: {
        ...data,
        opportunityId,
      },
    });
    recordId = updated.id;
  } else {
    const created = await prisma.emailMessageRecord.create({
      data: {
        externalMessageId,
        ...data,
        sentiment: "neutral",
      },
    });
    recordId = created.id;
  }

  if (attribution.opportunityId || existing?.opportunityId) {
    try {
      const categoryName = await applySmartCrmCategories(
        input.accessToken,
        externalMessageId,
        {
          opportunityName: attribution.opportunityName,
          existingCategories: input.message.categories,
        },
      );
      await prisma.emailMessageRecord.update({
        where: { id: recordId },
        data: { m365CategoryName: categoryName },
      });
    } catch (error) {
      console.warn(
        "[mail-delta-ingest] category apply failed:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  return "upserted";
}

/**
 * Sync one connected mailbox via Graph inbox delta.
 */
export async function syncMailDeltaForIntegration(
  integrationId: string,
): Promise<MailSyncIntegrationResult> {
  const prisma = getPrisma();
  const integration = await prisma.externalIntegration.findUnique({
    where: { id: integrationId },
    select: {
      id: true,
      status: true,
      provider: true,
      deltaSyncToken: true,
    },
  });

  if (
    !integration ||
    integration.provider !== "m365_graph" ||
    integration.status !== "active"
  ) {
    return {
      integrationId,
      status: "skipped",
      upserted: 0,
      tombstoned: 0,
      pages: 0,
      error: "Integration not active",
    };
  }

  const accessToken = await getAccessTokenForIntegration(integrationId);
  if (!accessToken) {
    return {
      integrationId,
      status: "skipped",
      upserted: 0,
      tombstoned: 0,
      pages: 0,
      error: "No usable access token",
    };
  }

  try {
    const me = await fetchGraphMe(accessToken);
    const mailboxEmail =
      normalizeEmail(me.mail) || normalizeEmail(me.userPrincipalName);

    let cursor: string | null | undefined = integration.deltaSyncToken;
    let pages = 0;
    let upserted = 0;
    let tombstoned = 0;
    let safety = 0;

    while (safety < 40) {
      safety += 1;
      pages += 1;
      const page = await fetchMailDelta(accessToken, cursor);

      for (const message of page.value) {
        if (message["@removed"]) {
          if (message.id) {
            await markEmailDeletedInSource(message.id);
            tombstoned += 1;
          }
          continue;
        }
        const result = await upsertGraphMessage({
          message,
          mailboxEmail,
          accessToken,
        });
        if (result === "upserted") upserted += 1;
      }

      if (page.nextLink) {
        cursor = page.nextLink;
        continue;
      }

      if (page.deltaLink) {
        await prisma.externalIntegration.update({
          where: { id: integrationId },
          data: {
            deltaSyncToken: page.deltaLink,
            lastSyncedAt: new Date(),
            status: "active",
          },
        });
      } else {
        await prisma.externalIntegration.update({
          where: { id: integrationId },
          data: { lastSyncedAt: new Date() },
        });
      }
      break;
    }

    return {
      integrationId,
      status: "ok",
      upserted,
      tombstoned,
      pages,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mail sync failed";
    console.error("[mail-delta-ingest]", integrationId, message);
    return {
      integrationId,
      status: "error",
      upserted: 0,
      tombstoned: 0,
      pages: 0,
      error: message,
    };
  }
}

/** Sync all active M365 Graph integrations (cron). */
export async function syncAllConnectedMailboxes(): Promise<MailSyncSummary> {
  const prisma = getPrisma();
  const integrations = await prisma.externalIntegration.findMany({
    where: { provider: "m365_graph", status: "active" },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
  });

  const results: MailSyncIntegrationResult[] = [];
  for (const integration of integrations) {
    results.push(await syncMailDeltaForIntegration(integration.id));
  }

  return { integrations: integrations.length, results };
}
