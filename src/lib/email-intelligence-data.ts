import { getPrisma } from "@/lib/prisma";
import { resolveOpportunityId } from "@/lib/meeting-intelligence-data";
import type { SentimentGrade } from "@/generated/prisma";

export type EmailMessageIntelligenceDto = {
  id: string;
  externalMessageId: string;
  conversationId: string;
  opportunityId: string | null;
  contactId: string | null;
  contactName: string | null;
  subject: string;
  bodyPreview: string | null;
  senderEmail: string;
  recipientEmails: string[];
  sentAt: string;
  sentiment: SentimentGrade;
  isOutbound: boolean;
  createdAt: string;
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

function toEmailDto(message: {
  id: string;
  externalMessageId: string;
  conversationId: string;
  opportunityId: string | null;
  contactId: string | null;
  subject: string;
  bodyPreview: string | null;
  senderEmail: string;
  recipientEmails: string[];
  sentAt: Date;
  sentiment: SentimentGrade;
  isOutbound: boolean;
  createdAt: Date;
  contact: {
    fullName: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
}): EmailMessageIntelligenceDto {
  return {
    id: message.id,
    externalMessageId: message.externalMessageId,
    conversationId: message.conversationId,
    opportunityId: message.opportunityId,
    contactId: message.contactId,
    contactName: contactDisplayName(message.contact),
    subject: message.subject,
    bodyPreview: message.bodyPreview,
    senderEmail: message.senderEmail,
    recipientEmails: message.recipientEmails,
    sentAt: message.sentAt.toISOString(),
    sentiment: message.sentiment,
    isOutbound: message.isOutbound,
    createdAt: message.createdAt.toISOString(),
  };
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
    include: {
      contact: {
        select: { fullName: true, firstName: true, lastName: true },
      },
    },
    orderBy: [{ conversationId: "asc" }, { sentAt: "asc" }],
  });

  return messages.map(toEmailDto);
}

export { resolveOpportunityId };
