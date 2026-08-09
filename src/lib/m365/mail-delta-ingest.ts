import "server-only";

import { getPrisma } from "@/lib/prisma";
import { emailsIncludeAddress } from "@/lib/entity-route-utils";
import {
  isEmailIngestExcluded,
  markEmailDeletedInSource,
} from "@/lib/email-intelligence-data";
import {
  applySmartCrmCategories,
  extractSmartCrmDealCategory,
  fetchGraphMe,
  fetchMailDelta,
  fetchMessagesWithSmartCrmMasterCategory,
  fromIntentionalCategoryLabel,
  getAccessTokenForIntegration,
  isIntentionalCategoryLabel,
  isSmartCrmManagedCategory,
  stripSmartCrmCategories,
  toIntentionalCategoryLabel,
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
 * Intentional Outlook tags only — set by the user (or inherited onto a reply
 * after the user tagged the thread), never by blind sync attribution.
 */
async function resolveIntentionalCategory(input: {
  conversationId: string;
  recordId?: string;
  existingCategoryName?: string | null;
  outlookCategories?: string[];
  isOutbound: boolean;
}): Promise<{
  apply: boolean;
  opportunityName?: string;
  projectName?: string;
  categoryName?: string;
}> {
  const prisma = getPrisma();

  // Outbound already tagged in Outlook (e.g. draft sent from opportunity/project).
  const outlookDeal = extractSmartCrmDealCategory(input.outlookCategories);
  if (input.isOutbound && outlookDeal) {
    return {
      apply: true,
      categoryName: toIntentionalCategoryLabel(outlookDeal),
    };
  }

  const whereConversation = input.conversationId
    ? {
        conversationId: input.conversationId,
        // Only user-intent markers — never legacy "SmartCRM / …" pollution.
        m365CategoryName: { startsWith: "intent:SmartCRM /" },
        ...(input.recordId ? { id: { not: input.recordId } } : {}),
      }
    : null;

  const taggedSibling = whereConversation
    ? await prisma.emailMessageRecord.findFirst({
        where: whereConversation,
        select: {
          m365CategoryName: true,
          opportunityId: true,
          projectId: true,
          projectName: true,
          opportunity: { select: { name: true } },
        },
        orderBy: { sentAt: "desc" },
      })
    : null;

  const selfTagged = isIntentionalCategoryLabel(input.existingCategoryName)
    ? input.existingCategoryName
    : null;

  if (!taggedSibling && !selfTagged) {
    return { apply: false };
  }

  if (taggedSibling?.opportunity?.name) {
    return {
      apply: true,
      opportunityName: taggedSibling.opportunity.name,
      categoryName: taggedSibling.m365CategoryName ?? undefined,
    };
  }
  if (taggedSibling?.projectName) {
    return {
      apply: true,
      projectName: taggedSibling.projectName,
      categoryName: taggedSibling.m365CategoryName ?? undefined,
    };
  }
  if (selfTagged) {
    const self = input.recordId
      ? await prisma.emailMessageRecord.findUnique({
          where: { id: input.recordId },
          select: {
            opportunity: { select: { name: true } },
            projectName: true,
          },
        })
      : null;
    return {
      apply: true,
      opportunityName: self?.opportunity?.name,
      projectName: self?.projectName ?? undefined,
      categoryName: selfTagged,
    };
  }

  return { apply: false };
}

async function syncOutlookCategoriesForRecord(input: {
  accessToken: string;
  externalMessageId: string;
  recordId: string;
  conversationId: string;
  existingCategoryName: string | null;
  outlookCategories: string[] | undefined;
  isOutbound: boolean;
  linkedOpportunityId: string | null;
  linkedProjectId: string | null;
  opportunityName?: string;
  projectName?: string | null;
}): Promise<void> {
  const prisma = getPrisma();
  const outlookCategories = input.outlookCategories ?? [];
  const hasManaged = outlookCategories.some(isSmartCrmManagedCategory);

  const intentional = await resolveIntentionalCategory({
    conversationId: input.conversationId,
    recordId: input.recordId,
    existingCategoryName: input.existingCategoryName,
    outlookCategories,
    isOutbound: input.isOutbound,
  });

  const canTag =
    intentional.apply &&
    Boolean(input.linkedOpportunityId || input.linkedProjectId || input.isOutbound);

  if (canTag) {
    try {
      const outlookName = await applySmartCrmCategories(
        input.accessToken,
        input.externalMessageId,
        {
          opportunityName:
            intentional.opportunityName ?? input.opportunityName,
          projectName:
            intentional.projectName ?? input.projectName ?? undefined,
          existingCategories: outlookCategories,
        },
      );
      await prisma.emailMessageRecord.update({
        where: { id: input.recordId },
        data: {
          m365CategoryName: toIntentionalCategoryLabel(
            fromIntentionalCategoryLabel(intentional.categoryName) ??
              outlookName,
          ),
        },
      });
    } catch (error) {
      console.warn(
        "[mail-delta-ingest] category apply failed:",
        error instanceof Error ? error.message : error,
      );
    }
    return;
  }

  // No intentional tag — strip SmartCRM pollution from Outlook and clear DB label.
  if (hasManaged || input.existingCategoryName) {
    try {
      if (hasManaged) {
        await stripSmartCrmCategories(
          input.accessToken,
          input.externalMessageId,
          { existingCategories: outlookCategories },
        );
      }
      if (input.existingCategoryName) {
        await prisma.emailMessageRecord.update({
          where: { id: input.recordId },
          data: { m365CategoryName: null },
        });
      }
    } catch (error) {
      console.warn(
        "[mail-delta-ingest] category strip failed:",
        error instanceof Error ? error.message : error,
      );
    }
  }
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
      projectName: true,
      m365CategoryName: true,
    },
  });

  let recordId: string;
  let linkedOpportunityId: string | null = existing?.opportunityId ?? null;
  let linkedProjectId: string | null = existing?.projectId ?? null;
  let linkedProjectName: string | null = existing?.projectName ?? null;
  let opportunityName: string | undefined;
  let existingCategoryName: string | null = existing?.m365CategoryName ?? null;

  if (existing) {
    // Sync must never re-attach or clear user-managed opportunity/project links.
    await prisma.emailMessageRecord.update({
      where: { id: existing.id },
      data: {
        ...contentData,
        ...(contactId ? { contactId } : {}),
      },
    });
    recordId = existing.id;
    linkedOpportunityId = existing.opportunityId;
    linkedProjectId = existing.projectId;
    linkedProjectName = existing.projectName;
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
    // Inherit intentional Outlook category onto replies in a user-tagged thread.
    const intentional = await resolveIntentionalCategory({
      conversationId,
      outlookCategories: input.message.categories,
      isOutbound,
    });
    const created = await prisma.emailMessageRecord.create({
      data: {
        externalMessageId,
        ...contentData,
        contactId: attribution.contactId ?? contactId,
        opportunityId: attribution.opportunityId,
        projectId: attribution.projectId,
        projectName: attribution.projectName,
        // Only persist category label when the thread was intentionally tagged.
        m365CategoryName: intentional.apply
          ? intentional.categoryName ?? null
          : null,
        sentiment: "neutral",
      },
    });
    recordId = created.id;
    linkedOpportunityId = attribution.opportunityId;
    linkedProjectId = attribution.projectId;
    linkedProjectName = attribution.projectName;
    opportunityName = attribution.opportunityName;
    existingCategoryName = intentional.apply
      ? intentional.categoryName ?? null
      : null;
  }

  await syncOutlookCategoriesForRecord({
    accessToken: input.accessToken,
    externalMessageId,
    recordId,
    conversationId,
    existingCategoryName,
    outlookCategories: input.message.categories,
    isOutbound,
    linkedOpportunityId,
    linkedProjectId,
    opportunityName,
    projectName: linkedProjectName,
  });

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

    const scrubbed = await scrubUnintentionalOutlookCategories(accessToken);
    if (scrubbed > 0) {
      console.info(
        `[mail-delta-ingest] scrubbed ${scrubbed} unintentional Outlook categories`,
      );
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

/**
 * Remove SmartCRM Outlook categories that were never intentionally set
 * (legacy sync painted "SmartCRM" / "SmartCRM / VEAS…" on unrelated mail).
 */
async function scrubUnintentionalOutlookCategories(
  accessToken: string,
): Promise<number> {
  const prisma = getPrisma();

  // Drop legacy DB labels that lack the intent: marker.
  await prisma.emailMessageRecord.updateMany({
    where: {
      m365CategoryName: { not: null },
      NOT: { m365CategoryName: { startsWith: "intent:" } },
    },
    data: { m365CategoryName: null },
  });

  let scrubbed = 0;
  try {
    const polluted = await fetchMessagesWithSmartCrmMasterCategory(
      accessToken,
      25,
    );
    for (const message of polluted) {
      const record = await prisma.emailMessageRecord.findUnique({
        where: { externalMessageId: message.id },
        select: { m365CategoryName: true },
      });
      if (isIntentionalCategoryLabel(record?.m365CategoryName)) {
        continue;
      }
      try {
        const changed = await stripSmartCrmCategories(
          accessToken,
          message.id,
          { existingCategories: message.categories },
        );
        if (changed) scrubbed += 1;
      } catch (error) {
        console.warn(
          "[mail-delta-ingest] pollution scrub failed:",
          error instanceof Error ? error.message : error,
        );
      }
    }
  } catch (error) {
    console.warn(
      "[mail-delta-ingest] pollution query failed:",
      error instanceof Error ? error.message : error,
    );
  }
  return scrubbed;
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
