import "server-only";

import { getPrisma } from "@/lib/prisma";
import { emailsIncludeAddress } from "@/lib/entity-route-utils";
import {
  isEmailIngestExcluded,
  markEmailDeletedInSource,
} from "@/lib/email-intelligence-data";
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

type ConversationLinkState = {
  opportunityId: string | null;
  projectId: string | null;
  projectName: string | null;
  opportunityName?: string;
};

/**
 * Inherit links from the latest message in the conversation (including explicit
 * "Not linked" nulls). Never invent a deal from company context.
 */
async function resolveConversationLinks(
  conversationId: string,
): Promise<ConversationLinkState> {
  if (!conversationId) {
    return { opportunityId: null, projectId: null, projectName: null };
  }
  const prisma = getPrisma();
  const latest = await prisma.emailMessageRecord.findFirst({
    where: { conversationId },
    select: {
      opportunityId: true,
      projectId: true,
      projectName: true,
      opportunity: { select: { name: true } },
    },
    orderBy: { sentAt: "desc" },
  });
  if (!latest) {
    return { opportunityId: null, projectId: null, projectName: null };
  }
  return {
    opportunityId: latest.opportunityId,
    projectId: latest.projectId,
    projectName: latest.projectName,
    opportunityName: latest.opportunity?.name,
  };
}

/**
 * Attribute contact + conversation links for *new* messages only.
 * Never guess from "one open deal at company" (that wrongly attached all mail → PL-1001).
 */
async function attributeForNewMessage(input: {
  conversationId: string;
  participantEmails: string[];
}): Promise<{
  contactId: string | null;
  opportunityId: string | null;
  projectId: string | null;
  projectName: string | null;
  opportunityName?: string;
}> {
  const contacts = await findContactsByEmails(input.participantEmails);
  const contactId = contacts[0]?.id ?? null;
  const links = await resolveConversationLinks(input.conversationId);
  return {
    contactId,
    opportunityId: links.opportunityId,
    projectId: links.projectId,
    projectName: links.projectName,
    opportunityName: links.opportunityName,
  };
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

  const conversationId =
    input.message.conversationId?.trim() || `msg-${externalMessageId}`;
  if (
    await isEmailIngestExcluded({
      externalMessageId,
      conversationId,
    })
  ) {
    return "skipped";
  }

  const senderEmail = normalizeEmail(input.message.from?.emailAddress?.address);
  if (!senderEmail) return "skipped";

  const recipientEmails = collectRecipientEmails(input.message);
  const participantEmails = extractParticipantEmails(input.message);
  const mailbox = normalizeEmail(input.mailboxEmail);
  const isOutbound = Boolean(mailbox) && senderEmail === mailbox;

  // Still persist internal-only mail; UI defaults to external filter (FS-009).
  const contacts = await findContactsByEmails(participantEmails);
  const contactId = contacts[0]?.id ?? null;

  const prisma = getPrisma();
  const webLink = input.message.webLink?.trim() || null;
  const contentData = {
    conversationId,
    subject: input.message.subject?.trim() || "(no subject)",
    bodyPreview: input.message.bodyPreview?.slice(0, 2000) ?? null,
    ...(webLink ? { webLink } : {}),
    senderEmail,
    recipientEmails,
    sentAt: parseSentAt(input.message),
    isOutbound,
    isDeletedInSource: false,
    deletedAtInSource: null as Date | null,
  };

  const existing = await prisma.emailMessageRecord.findUnique({
    where: { externalMessageId },
    select: {
      id: true,
      opportunityId: true,
      projectId: true,
      m365CategoryName: true,
    },
  });

  let recordId: string;
  let linkedOpportunityId: string | null = existing?.opportunityId ?? null;
  let opportunityName: string | undefined;

  if (existing) {
    // Sync must never re-attach or clear user-managed opportunity/project links.
    // Drop stale Outlook category labels when there is no opportunity link.
    const updated = await prisma.emailMessageRecord.update({
      where: { id: existing.id },
      data: {
        ...contentData,
        ...(contactId ? { contactId } : {}),
        ...(!existing.opportunityId ? { m365CategoryName: null } : {}),
      },
    });
    recordId = updated.id;
    linkedOpportunityId = existing.opportunityId;
    if (linkedOpportunityId) {
      const opportunity = await prisma.opportunity.findUnique({
        where: { id: linkedOpportunityId },
        select: { name: true },
      });
      opportunityName = opportunity?.name;
    }
  } else {
    const attribution = await attributeForNewMessage({
      conversationId,
      participantEmails,
    });
    const created = await prisma.emailMessageRecord.create({
      data: {
        externalMessageId,
        ...contentData,
        contactId: attribution.contactId ?? contactId,
        opportunityId: attribution.opportunityId,
        projectId: attribution.projectId,
        projectName: attribution.projectName,
        sentiment: "neutral",
      },
    });
    recordId = created.id;
    linkedOpportunityId = attribution.opportunityId;
    opportunityName = attribution.opportunityName;
  }

  if (linkedOpportunityId) {
    try {
      const categoryName = await applySmartCrmCategories(
        input.accessToken,
        externalMessageId,
        {
          opportunityName,
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
