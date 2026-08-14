import { getPrisma } from "@/lib/prisma";
import { resolveOpportunityId } from "@/lib/meeting-intelligence-data";
import { isExternalEmail, isInternalEmail } from "@/lib/domain-rules";
import { findPrismaContactByIdOrEmail } from "@/lib/resolve-contact-route";
import {
  extractEmailCommitments,
  gradeEmailSentiment,
} from "@/lib/email-sentiment";
import { extractCorrespondenceActionSignals } from "@/lib/correspondence-action-signals";
import type { SentimentGrade } from "@/generated/prisma";
import type { IngestedSmartDoc } from "@/lib/smartdocs-ingestion";

export type EmailAttachmentDto = {
  id: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
  source: string;
  hasContent: boolean;
  downloadUrl: string;
};

export type EmailMessageIntelligenceDto = {
  id: string;
  externalMessageId: string;
  conversationId: string;
  opportunityId: string | null;
  opportunityName: string | null;
  opportunityCode: string | null;
  projectId: string | null;
  projectName: string | null;
  contactId: string | null;
  contactName: string | null;
  /** Primary phone from linked contact — empty when unknown (Reality First). */
  contactPhone: string | null;
  subject: string;
  bodyPreview: string | null;
  webLink: string | null;
  senderEmail: string;
  recipientEmails: string[];
  sentAt: string;
  sentiment: SentimentGrade;
  isOutbound: boolean;
  /** Domain-rules classification (Gap 5). */
  senderIsInternal: boolean;
  senderIsExternal: boolean;
  /** True when every participant domain is internal (privacy / noise filter cue). */
  isInternalOnly: boolean;
  recipientDomains: Array<{ email: string; isInternal: boolean; isExternal: boolean }>;
  m365CategoryName: string | null;
  isDeletedInSource: boolean;
  deletedAtInSource: string | null;
  createdAt: string;
  attachments: EmailAttachmentDto[];
};

export type EmailThreadSummary = {
  conversationId: string;
  subject: string;
  messageCount: number;
  latestSentAt: string;
  takeaways: string[];
  riskAlerts: string[];
  sentimentMix: Record<SentimentGrade, number>;
};

function contactDisplayName(contact: {
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
} | null): string | null {
  if (!contact) return null;
  return (
    contact.fullName?.trim() ||
    `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() ||
    null
  );
}

function toAttachmentDto(doc: {
  id: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
  source: string;
  contentBase64: string | null;
}): EmailAttachmentDto {
  return {
    id: doc.id,
    name: doc.name,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    source: doc.source,
    hasContent: Boolean(doc.contentBase64),
    downloadUrl: `/api/documents/${encodeURIComponent(doc.id)}/download`,
  };
}

function contactPrimaryPhone(phoneNumbers: unknown): string | null {
  if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) return null;
  const typed = phoneNumbers.filter(
    (entry): entry is { number?: string; type?: string; isPrimary?: boolean } =>
      Boolean(entry && typeof entry === "object"),
  );
  const mobile = typed.find((entry) => /mobile|cell/i.test(entry.type ?? ""));
  if (mobile?.number?.trim()) return mobile.number.trim();
  const primary = typed.find((entry) => entry.isPrimary);
  if (primary?.number?.trim()) return primary.number.trim();
  const first = typed[0]?.number?.trim();
  return first || null;
}

const emailMessageInclude = {
  contact: {
    select: {
      fullName: true,
      firstName: true,
      lastName: true,
      phoneNumbers: true,
    },
  },
  opportunity: {
    select: { id: true, name: true, code: true },
  },
  documents: {
    select: {
      id: true,
      name: true,
      mimeType: true,
      sizeBytes: true,
      source: true,
      contentBase64: true,
    },
    orderBy: { name: "asc" as const },
  },
};

function toEmailDto(message: {
  id: string;
  externalMessageId: string;
  conversationId: string;
  opportunityId: string | null;
  projectId: string | null;
  projectName: string | null;
  contactId: string | null;
  subject: string;
  bodyPreview: string | null;
  webLink: string | null;
  senderEmail: string;
  recipientEmails: string[];
  sentAt: Date;
  sentiment: SentimentGrade;
  isOutbound: boolean;
  m365CategoryName: string | null;
  isDeletedInSource: boolean;
  deletedAtInSource: Date | null;
  createdAt: Date;
  contact: {
    fullName: string | null;
    firstName: string | null;
    lastName: string | null;
    phoneNumbers: unknown;
  } | null;
  opportunity: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  documents: Array<{
    id: string;
    name: string;
    mimeType: string | null;
    sizeBytes: number | null;
    source: string;
    contentBase64: string | null;
  }>;
}): EmailMessageIntelligenceDto {
  const senderIsInternal = isInternalEmail(message.senderEmail);
  const senderIsExternal = isExternalEmail(message.senderEmail);
  const recipientDomains = message.recipientEmails.map((email) => ({
    email,
    isInternal: isInternalEmail(email),
    isExternal: isExternalEmail(email),
  }));
  const participantEmails = [message.senderEmail, ...message.recipientEmails];
  const isInternalOnly =
    participantEmails.length > 0 &&
    participantEmails.every((address) => isInternalEmail(address));

  return {
    id: message.id,
    externalMessageId: message.externalMessageId,
    conversationId: message.conversationId,
    opportunityId: message.opportunityId,
    opportunityName: message.opportunity?.name ?? null,
    opportunityCode: message.opportunity?.code ?? null,
    projectId: message.projectId,
    projectName: message.projectName,
    contactId: message.contactId,
    contactName: contactDisplayName(message.contact),
    contactPhone: contactPrimaryPhone(message.contact?.phoneNumbers),
    subject: message.subject,
    bodyPreview: message.bodyPreview,
    webLink: message.webLink,
    senderEmail: message.senderEmail,
    recipientEmails: message.recipientEmails,
    sentAt: message.sentAt.toISOString(),
    sentiment: message.sentiment,
    isOutbound: message.isOutbound,
    senderIsInternal,
    senderIsExternal,
    isInternalOnly,
    recipientDomains,
    // Only surface intentional tags (intent:…); hide legacy sync pollution.
    m365CategoryName: message.m365CategoryName?.startsWith("intent:")
      ? message.m365CategoryName.slice("intent:".length) || null
      : null,
    isDeletedInSource: message.isDeletedInSource,
    deletedAtInSource: message.deletedAtInSource?.toISOString() ?? null,
    createdAt: message.createdAt.toISOString(),
    attachments: message.documents.map(toAttachmentDto),
  };
}

function contactEmailsFromJson(emails: unknown): string[] {
  if (!Array.isArray(emails)) return [];
  return [
    ...new Set(
      emails
        .map((entry) => {
          if (!entry || typeof entry !== "object") return "";
          const address = (entry as { address?: unknown }).address;
          return typeof address === "string" ? address.trim().toLowerCase() : "";
        })
        .filter(Boolean),
    ),
  ];
}

/**
 * Resolve CRM contact UUID from route key (UUID, CT-… tracking code, or email).
 */
export async function resolveContactIdForEmails(
  contactKey: string,
): Promise<string | null> {
  const prismaContact = await findPrismaContactByIdOrEmail(contactKey);
  return prismaContact?.id ?? null;
}

/**
 * Build a SmartAssist thread summary from message evidence (advisory only).
 */
export function buildEmailThreadSummary(
  messages: EmailMessageIntelligenceDto[],
): EmailThreadSummary | null {
  if (messages.length === 0) return null;

  const sorted = [...messages].sort(
    (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
  );
  const latest = sorted[sorted.length - 1]!;
  const sentimentMix: Record<SentimentGrade, number> = {
    positive: 0,
    neutral: 0,
    cautious: 0,
    negative: 0,
  };
  for (const message of sorted) {
    sentimentMix[message.sentiment] += 1;
  }

  const takeaways: string[] = [];
  const riskAlerts: string[] = [];

  const subjects = new Set(sorted.map((m) => m.subject.replace(/^Re:\s*/i, "").trim()));
  takeaways.push(
    `Thread covers: ${[...subjects].slice(0, 2).join("; ") || latest.subject}.`,
  );

  if (sentimentMix.positive > 0) {
    takeaways.push("Positive commercial progress signals appear in outbound/inbound exchange.");
  }
  if (sorted.some((m) => /capex|payback|contract|power/i.test(`${m.subject} ${m.bodyPreview ?? ""}`))) {
    takeaways.push(
      "Open commercial topics include CAPEX payback, site power requirements, and/or contract review.",
    );
  }

  const attachmentCount = sorted.reduce((sum, m) => sum + m.attachments.length, 0);
  if (attachmentCount > 0) {
    takeaways.push(`${attachmentCount} commercial attachment(s) linked from Outlook.`);
  }

  if (sentimentMix.cautious > 0 || sentimentMix.negative > 0) {
    riskAlerts.push(
      "Cautious or negative tone detected — validate unresolved objections before next gate.",
    );
  }
  if (sentimentMix.negative > 0) {
    riskAlerts.push("Negative sentiment present — elevated disengagement / deal-risk alert.");
  }

  const lastInbound = [...sorted].reverse().find((m) => !m.isOutbound);
  if (lastInbound && (lastInbound.sentiment === "cautious" || lastInbound.sentiment === "negative")) {
    riskAlerts.push(
      `Latest customer reply (${lastInbound.senderEmail}) is ${lastInbound.sentiment} — follow up promptly to prevent stall.`,
    );
  }

  const signals = extractCorrespondenceActionSignals(
    sorted.map((message) => ({
      id: message.id,
      conversationId: message.conversationId,
      subject: message.subject,
      bodyPreview: message.bodyPreview,
      sentAt: message.sentAt,
      isOutbound: message.isOutbound,
    })),
  );
  for (const ask of signals.actionAsks.slice(0, 2)) {
    const tone =
      ask.sentiment !== "neutral" ? ` [${ask.sentiment}]` : "";
    takeaways.push(`Action requested in mail${tone}: ${ask.excerpt}`);
  }
  for (const promise of signals.openPromises.slice(0, 2)) {
    takeaways.push(`Open promise in our outbound mail: ${promise.excerpt}`);
  }
  for (const followUp of signals.proposalFollowUps.slice(0, 2)) {
    riskAlerts.push(
      followUp.kind === "proposal_requested"
        ? `Proposal/quote requested ${followUp.daysSince} days ago with no reply — follow-up required.`
        : `Proposal/quotation sent ${followUp.daysSince} days ago with no reply — follow-up required.`,
    );
  }

  // Commitment cues from previews (advisory).
  const commitmentCues = sorted.flatMap((message) =>
    extractEmailCommitments(message.subject, message.bodyPreview, message.isOutbound),
  );
  for (const cue of commitmentCues.slice(0, 2)) {
    if (cue.kind === "deadline") {
      takeaways.push(`Deadline language detected: ${cue.text}`);
    }
  }

  const daysSinceLatest =
    (Date.now() - new Date(latest.sentAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceLatest >= 5 && latest.isOutbound) {
    riskAlerts.push(
      "No inbound reply after outbound message for 5+ days — possible disengagement risk.",
    );
  }

  if (riskAlerts.length === 0) {
    takeaways.push("No elevated disengagement risk from current sentiment evidence.");
  }

  return {
    conversationId: latest.conversationId,
    subject: latest.subject.replace(/^Re:\s*/i, "").trim() || latest.subject,
    messageCount: sorted.length,
    latestSentAt: latest.sentAt,
    takeaways,
    riskAlerts,
    sentimentMix,
  };
}

/**
 * Load EmailMessageRecord rows for an opportunity, oldest → newest within threads.
 */
export async function readEmailsForOpportunity(
  opportunityKey: string,
): Promise<EmailMessageIntelligenceDto[]> {
  const prisma = getPrisma();
  const opportunityId = await resolveOpportunityId(opportunityKey);
  if (!opportunityId) return [];

  const messages = await prisma.emailMessageRecord.findMany({
    where: { opportunityId },
    include: emailMessageInclude,
    orderBy: [{ conversationId: "asc" }, { sentAt: "asc" }],
  });

  return messages.map(toEmailDto);
}

/**
 * Load EmailMessageRecord rows linked to a project workspace.
 */
export async function readEmailsForProject(
  projectId: string,
): Promise<EmailMessageIntelligenceDto[]> {
  const id = projectId.trim();
  if (!id) return [];

  const prisma = getPrisma();
  const messages = await prisma.emailMessageRecord.findMany({
    where: { projectId: id },
    include: emailMessageInclude,
    orderBy: [{ conversationId: "asc" }, { sentAt: "asc" }],
  });

  return messages.map(toEmailDto);
}

/**
 * Load EmailMessageRecord rows for a contact (person lens).
 * Matches by contactId and by known email addresses (when attribution left contact null).
 */
export async function readEmailsForContact(
  contactKey: string,
): Promise<EmailMessageIntelligenceDto[]> {
  const prisma = getPrisma();
  const contact = await findPrismaContactByIdOrEmail(contactKey);
  if (!contact) return [];

  const addresses = contactEmailsFromJson(contact.emails);
  const messages = await prisma.emailMessageRecord.findMany({
    where: {
      OR: [
        { contactId: contact.id },
        ...(addresses.length > 0
          ? [
              { senderEmail: { in: addresses } },
              { recipientEmails: { hasSome: addresses } },
            ]
          : []),
      ],
    },
    include: emailMessageInclude,
    orderBy: [{ sentAt: "desc" }],
    take: 80,
  });

  // Return chronological within conversation for thread grouping.
  return [...messages]
    .sort((a, b) => {
      const conv = a.conversationId.localeCompare(b.conversationId);
      if (conv !== 0) return conv;
      return a.sentAt.getTime() - b.sentAt.getTime();
    })
    .map(toEmailDto);
}

/**
 * Soft-tombstone when Outlook reports the message removed.
 */
export async function markEmailDeletedInSource(
  externalMessageId: string,
  deletedAt: Date = new Date(),
): Promise<void> {
  const prisma = getPrisma();
  await prisma.emailMessageRecord.updateMany({
    where: { externalMessageId },
    data: {
      isDeletedInSource: true,
      deletedAtInSource: deletedAt,
    },
  });
}

/**
 * Permanently remove a SmartCRM email record (user sovereignty / accidental sync).
 * Also records ingest exclusions so Graph delta does not re-create private mail.
 */
export async function purgeEmailFromSmartCrm(
  opportunityKey: string,
  emailId: string,
): Promise<boolean> {
  const prisma = getPrisma();
  const opportunityId = await resolveOpportunityId(opportunityKey);
  if (!opportunityId) return false;

  const existing = await prisma.emailMessageRecord.findFirst({
    where: { id: emailId, opportunityId },
    select: {
      id: true,
      externalMessageId: true,
      conversationId: true,
    },
  });
  if (!existing) return false;

  await recordEmailIngestExclusions([
    {
      externalMessageId: existing.externalMessageId,
      conversationId: existing.conversationId,
    },
  ]);
  await prisma.emailMessageRecord.delete({ where: { id: existing.id } });
  return true;
}

/** Purge one synced message from a project lens (same sovereignty rules as opportunity). */
export async function purgeEmailFromProject(
  projectId: string,
  emailId: string,
): Promise<boolean> {
  const prisma = getPrisma();
  const id = projectId.trim();
  if (!id) return false;

  const existing = await prisma.emailMessageRecord.findFirst({
    where: { id: emailId, projectId: id },
    select: {
      id: true,
      externalMessageId: true,
      conversationId: true,
    },
  });
  if (!existing) return false;

  await recordEmailIngestExclusions([
    {
      externalMessageId: existing.externalMessageId,
      conversationId: existing.conversationId,
    },
  ]);
  await prisma.emailMessageRecord.delete({ where: { id: existing.id } });
  return true;
}

/**
 * Purge a whole conversation for a contact (private / irrelevant sync).
 * Removes every matching EmailMessageRecord and blocks re-ingest.
 */
export async function purgeConversationForContact(
  contactKey: string,
  conversationId: string,
): Promise<{ purged: number }> {
  const prisma = getPrisma();
  const contact = await findPrismaContactByIdOrEmail(contactKey);
  if (!contact || !conversationId.trim()) return { purged: 0 };

  const addresses = contactEmailsFromJson(contact.emails);
  const messages = await prisma.emailMessageRecord.findMany({
    where: {
      conversationId,
      OR: [
        { contactId: contact.id },
        ...(addresses.length > 0
          ? [
              { senderEmail: { in: addresses } },
              { recipientEmails: { hasSome: addresses } },
            ]
          : []),
      ],
    },
    select: {
      id: true,
      externalMessageId: true,
      conversationId: true,
    },
  });

  if (messages.length === 0) return { purged: 0 };

  await recordEmailIngestExclusions(
    messages.map((message) => ({
      externalMessageId: message.externalMessageId,
      conversationId: message.conversationId,
    })),
  );

  await prisma.emailMessageRecord.deleteMany({
    where: { id: { in: messages.map((message) => message.id) } },
  });

  return { purged: messages.length };
}

/**
 * Set or clear opportunity / project links for every message in a contact conversation.
 * When the conversation is not yet synced, optionally seed from the open Outlook item.
 */
export async function setConversationLinksForContact(
  contactKey: string,
  conversationId: string,
  links: {
    opportunityId?: string | null;
    projectId?: string | null;
  },
  options?: {
    seedMessage?: {
      externalMessageId: string;
      subject?: string;
      senderEmail?: string;
      recipientEmails?: string[];
      sentAt?: string;
      bodyPreview?: string;
      webLink?: string;
      isOutbound?: boolean;
    };
  },
): Promise<{
  updated: number;
  opportunityId: string | null | undefined;
  opportunityName: string | null;
  opportunityCode: string | null;
  projectId: string | null | undefined;
  projectName: string | null;
  seeded?: boolean;
}> {
  const prisma = getPrisma();
  const contact = await findPrismaContactByIdOrEmail(contactKey);
  if (!contact || !conversationId.trim()) {
    return {
      updated: 0,
      opportunityId: links.opportunityId,
      opportunityName: null,
      opportunityCode: null,
      projectId: links.projectId,
      projectName: null,
    };
  }

  const data: {
    opportunityId?: string | null;
    projectId?: string | null;
    projectName?: string | null;
  } = {};

  let opportunityName: string | null = null;
  let opportunityCode: string | null = null;
  if (links.opportunityId !== undefined) {
    if (links.opportunityId) {
      const opportunity = await prisma.opportunity.findUnique({
        where: { id: links.opportunityId },
        select: { id: true, name: true, code: true },
      });
      if (!opportunity) {
        return {
          updated: 0,
          opportunityId: links.opportunityId,
          opportunityName: null,
          opportunityCode: null,
          projectId: links.projectId,
          projectName: null,
        };
      }
      opportunityName = opportunity.name;
      opportunityCode = opportunity.code;
      data.opportunityId = opportunity.id;
    } else {
      data.opportunityId = null;
    }
  }

  let projectName: string | null = null;
  if (links.projectId !== undefined) {
    if (links.projectId) {
      const { readProjectById } = await import("@/lib/project-db");
      const project = await readProjectById(links.projectId);
      if (!project) {
        return {
          updated: 0,
          opportunityId: links.opportunityId,
          opportunityName,
          opportunityCode,
          projectId: links.projectId,
          projectName: null,
        };
      }
      projectName = project.name;
      data.projectId = project.id;
      data.projectName = project.name;
    } else {
      data.projectId = null;
      data.projectName = null;
    }
  }

  if (Object.keys(data).length === 0) {
    return {
      updated: 0,
      opportunityId: links.opportunityId,
      opportunityName,
      opportunityCode,
      projectId: links.projectId,
      projectName,
    };
  }

  const addresses = contactEmailsFromJson(contact.emails);
  let seeded = false;

  // If Outlook opened a thread that mail sync has not ingested yet, seed one
  // record from the open item so intentional tagging still works.
  const anyInConversation = await prisma.emailMessageRecord.findFirst({
    where: { conversationId },
    select: { id: true },
  });
  if (!anyInConversation && options?.seedMessage?.externalMessageId?.trim()) {
    const seed = options.seedMessage;
    const externalMessageId = seed.externalMessageId.trim();
    const isOutbound = Boolean(seed.isOutbound);
    const senderEmail =
      seed.senderEmail?.trim().toLowerCase() ||
      (isOutbound ? "" : addresses[0]) ||
      "";
    const recipientEmails = seed.recipientEmails?.length
      ? seed.recipientEmails.map((address) => address.trim().toLowerCase()).filter(Boolean)
      : isOutbound
        ? addresses
        : addresses.filter((address) => address !== senderEmail);
    const sentAt = seed.sentAt ? new Date(seed.sentAt) : new Date();
    await prisma.emailMessageRecord.upsert({
      where: { externalMessageId },
      create: {
        externalMessageId,
        conversationId,
        contactId: contact.id,
        subject: seed.subject?.trim() || "(no subject)",
        bodyPreview: seed.bodyPreview?.slice(0, 2000) ?? null,
        webLink: seed.webLink?.trim() || null,
        senderEmail: senderEmail || addresses[0] || "unknown@smartcrm.local",
        recipientEmails,
        sentAt: Number.isNaN(sentAt.getTime()) ? new Date() : sentAt,
        sentiment: gradeEmailSentiment(
          seed.subject?.trim() || "(no subject)",
          seed.bodyPreview,
        ),
        isOutbound,
        opportunityId: data.opportunityId ?? null,
        projectId: data.projectId ?? null,
        projectName: data.projectName ?? null,
      },
      update: {
        conversationId,
        contactId: contact.id,
        ...(seed.subject?.trim() ? { subject: seed.subject.trim() } : {}),
        ...(senderEmail ? { senderEmail } : {}),
        ...(recipientEmails.length > 0 ? { recipientEmails } : {}),
        isOutbound,
        ...data,
      },
    });
    seeded = true;
  }

  // Authorize: contact must appear on at least one message in this conversation.
  const participates = await prisma.emailMessageRecord.findFirst({
    where: {
      conversationId,
      OR: [
        { contactId: contact.id },
        ...(addresses.length > 0
          ? [
              { senderEmail: { in: addresses } },
              { recipientEmails: { hasSome: addresses } },
            ]
          : []),
      ],
    },
    select: { id: true },
  });
  if (!participates) {
    return {
      updated: 0,
      opportunityId: links.opportunityId,
      opportunityName,
      opportunityCode,
      projectId: links.projectId,
      projectName,
      seeded,
    };
  }

  // Apply links to the whole conversation so sync inheritance and other
  // participants stay consistent (clearing "Not linked" must stick).
  const result = await prisma.emailMessageRecord.updateMany({
    where: { conversationId },
    data,
  });

  // Resolve final link state for intentional Outlook category (user action only).
  const sample = await prisma.emailMessageRecord.findFirst({
    where: { conversationId },
    select: {
      opportunityId: true,
      projectId: true,
      projectName: true,
      opportunity: { select: { name: true } },
    },
  });
  const finalOpportunityName = sample?.opportunity?.name ?? opportunityName;
  const finalProjectName = sample?.projectName ?? projectName;
  const {
    buildOpportunityCategoryName,
    buildProjectCategoryName,
    applySmartCrmCategories,
    stripSmartCrmCategories,
    getActiveM365AccessToken,
    toIntentionalCategoryLabel,
  } = await import("@/lib/m365-client");

  let outlookCategoryName: string | null = null;
  if (sample?.opportunityId && finalOpportunityName) {
    outlookCategoryName = buildOpportunityCategoryName(finalOpportunityName);
  } else if (sample?.projectId && finalProjectName) {
    outlookCategoryName = buildProjectCategoryName(finalProjectName);
  }

  const storedCategoryName = outlookCategoryName
    ? toIntentionalCategoryLabel(outlookCategoryName)
    : null;

  await prisma.emailMessageRecord.updateMany({
    where: { conversationId },
    data: { m365CategoryName: storedCategoryName },
  });

  // Push intentional tag (or strip) to Outlook for every message we can reach.
  const graphMessages = await prisma.emailMessageRecord.findMany({
    where: { conversationId },
    select: { externalMessageId: true },
  });
  const token = await getActiveM365AccessToken();
  if (token) {
    for (const message of graphMessages) {
      try {
        if (outlookCategoryName && finalOpportunityName) {
          await applySmartCrmCategories(token.accessToken, message.externalMessageId, {
            opportunityName: finalOpportunityName,
          });
        } else if (outlookCategoryName && finalProjectName) {
          await applySmartCrmCategories(token.accessToken, message.externalMessageId, {
            projectName: finalProjectName,
          });
        } else {
          await stripSmartCrmCategories(token.accessToken, message.externalMessageId);
        }
      } catch (error) {
        console.warn(
          "[email-intelligence] Outlook category sync failed:",
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  return {
    updated: result.count,
    opportunityId: links.opportunityId,
    opportunityName: finalOpportunityName,
    opportunityCode,
    projectId: links.projectId,
    projectName: finalProjectName,
    seeded,
  };
}

/** @deprecated Prefer setConversationLinksForContact */
export async function setConversationOpportunityForContact(
  contactKey: string,
  conversationId: string,
  opportunityId: string | null,
): Promise<{ updated: number; opportunityName: string | null; opportunityCode: string | null }> {
  const result = await setConversationLinksForContact(contactKey, conversationId, {
    opportunityId,
  });
  return {
    updated: result.updated,
    opportunityName: result.opportunityName,
    opportunityCode: result.opportunityCode,
  };
}

async function recordEmailIngestExclusions(
  rows: Array<{ externalMessageId: string; conversationId: string }>,
): Promise<void> {
  const prisma = getPrisma();
  for (const row of rows) {
    if (row.externalMessageId) {
      await prisma.emailIngestExclusion.upsert({
        where: { externalMessageId: row.externalMessageId },
        create: {
          externalMessageId: row.externalMessageId,
          conversationId: row.conversationId,
          reason: "user_purge",
        },
        update: {
          conversationId: row.conversationId,
          reason: "user_purge",
        },
      });
    }
  }

  const conversationIds = [
    ...new Set(rows.map((row) => row.conversationId).filter(Boolean)),
  ];
  for (const conversationId of conversationIds) {
    const existing = await prisma.emailIngestExclusion.findFirst({
      where: { conversationId, externalMessageId: null },
      select: { id: true },
    });
    if (!existing) {
      await prisma.emailIngestExclusion.create({
        data: {
          conversationId,
          externalMessageId: null,
          reason: "user_purge",
        },
      });
    }
  }
}

/** True when the user previously purged this message or conversation. */
export async function isEmailIngestExcluded(input: {
  externalMessageId?: string | null;
  conversationId?: string | null;
}): Promise<boolean> {
  const prisma = getPrisma();
  const or: Array<{ externalMessageId?: string; conversationId?: string }> = [];
  if (input.externalMessageId) {
    or.push({ externalMessageId: input.externalMessageId });
  }
  if (input.conversationId) {
    or.push({ conversationId: input.conversationId });
  }
  if (or.length === 0) return false;

  const hit = await prisma.emailIngestExclusion.findFirst({
    where: { OR: or },
    select: { id: true },
  });
  return Boolean(hit);
}

export type { IngestedSmartDoc };
export { resolveOpportunityId };
