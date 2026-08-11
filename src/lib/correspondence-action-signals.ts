/**
 * Detect actionable asks and proposal/RFP follow-up needs from mail text.
 * Reality First — only surface what the message evidence supports.
 */

import {
  extractEmailCommitments,
  gradeEmailSentiment,
  type EmailCommitmentSignal,
  type EmailSentimentGrade,
} from "@/lib/email-sentiment";

export type CorrespondenceActionAsk = {
  messageId: string;
  subject: string;
  excerpt: string;
  sentAt: string;
  conversationId: string;
  sentiment: EmailSentimentGrade;
};

export type CorrespondenceProposalFollowUp = {
  messageId: string;
  subject: string;
  sentAt: string;
  daysSince: number;
  conversationId: string;
  kind: "proposal_sent" | "proposal_requested";
};

export type CorrespondenceOpenPromise = {
  messageId: string;
  subject: string;
  excerpt: string;
  sentAt: string;
  conversationId: string;
};

export type CorrespondenceMailSnippet = {
  id: string;
  conversationId: string;
  subject: string;
  bodyPreview: string | null;
  sentAt: string;
  isOutbound: boolean;
  sentiment?: EmailSentimentGrade;
};

const PROPOSAL_SENT_PATTERNS: RegExp[] = [
  /\b(please find|attached|enclosed).{0,40}\b(proposal|quotation|quote|tilbud|forslag|offer)\b/i,
  /\b(sending|sent|here is|hereby).{0,40}\b(proposal|quotation|quote|tilbud|forslag)\b/i,
  /\b(proposal|quotation|quote|tilbud|forslag)\b.{0,30}\b(attached|enclosed|for your review)\b/i,
];

const PROPOSAL_REQUEST_PATTERNS: RegExp[] = [
  /\b(request(ing)?|ask(ing)? for|need|trenger|ber om).{0,40}\b(proposal|quotation|quote|tilbud|forslag|offer|pris)\b/i,
  /\b(RFP|request for proposal|quote request|tilbudsforespørsel)\b/i,
  /\b(can you|could you|please).{0,30}\b(send|provide|prepare).{0,30}\b(proposal|quotation|quote|tilbud|forslag)\b/i,
  /\b(kan du|kan dere).{0,30}\b(sende|lage).{0,30}\b(tilbud|forslag|pris)\b/i,
];

const FOLLOW_UP_AFTER_DAYS = 3;

function haystack(message: CorrespondenceMailSnippet): string {
  return `${message.subject}\n${message.bodyPreview ?? ""}`;
}

function daysSinceIso(iso: string): number {
  const then = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(then.getTime())) return 0;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  return Math.round((start.getTime() - end.getTime()) / 86_400_000);
}

function excerptFrom(message: CorrespondenceMailSnippet): string {
  const preview = (message.bodyPreview ?? message.subject).replace(/\s+/g, " ").trim();
  return preview.slice(0, 140);
}

function messageSentiment(message: CorrespondenceMailSnippet): EmailSentimentGrade {
  return (
    message.sentiment ?? gradeEmailSentiment(message.subject, message.bodyPreview)
  );
}

export function detectInboundActionAsk(
  message: CorrespondenceMailSnippet,
): CorrespondenceActionAsk | null {
  if (message.isOutbound) return null;
  const commitments = extractEmailCommitments(
    message.subject,
    message.bodyPreview,
    false,
  );
  const ask = commitments.find((item) => item.kind === "action_ask");
  if (!ask) return null;
  return {
    messageId: message.id,
    subject: message.subject,
    excerpt: ask.text || excerptFrom(message),
    sentAt: message.sentAt,
    conversationId: message.conversationId,
    sentiment: messageSentiment(message),
  };
}

export function detectOutboundProposalSignal(
  message: CorrespondenceMailSnippet,
): "proposal_sent" | "proposal_requested" | null {
  if (!message.isOutbound) return null;
  const text = haystack(message);
  if (PROPOSAL_SENT_PATTERNS.some((pattern) => pattern.test(text))) {
    return "proposal_sent";
  }
  if (PROPOSAL_REQUEST_PATTERNS.some((pattern) => pattern.test(text))) {
    return "proposal_requested";
  }
  if (/\b(proposal|quotation|quote|tilbud|forslag|RFP)\b/i.test(message.subject)) {
    return /request|forespørsel|RFP|ber om|trenger/i.test(message.subject)
      ? "proposal_requested"
      : "proposal_sent";
  }
  return null;
}

/**
 * Scan a company's mail snippets for open action asks and proposal follow-ups.
 */
export function extractCorrespondenceActionSignals(
  messages: CorrespondenceMailSnippet[],
): {
  actionAsks: CorrespondenceActionAsk[];
  proposalFollowUps: CorrespondenceProposalFollowUp[];
  openPromises: CorrespondenceOpenPromise[];
  commitments: EmailCommitmentSignal[];
} {
  const sorted = [...messages].sort(
    (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
  );

  const actionAsks: CorrespondenceActionAsk[] = [];
  const proposalFollowUps: CorrespondenceProposalFollowUp[] = [];
  const openPromises: CorrespondenceOpenPromise[] = [];
  const commitments: EmailCommitmentSignal[] = [];
  const seenAskConversations = new Set<string>();
  const seenFollowUpConversations = new Set<string>();
  const seenPromiseConversations = new Set<string>();

  for (const message of sorted) {
    commitments.push(
      ...extractEmailCommitments(
        message.subject,
        message.bodyPreview,
        message.isOutbound,
      ),
    );

    const ask = detectInboundActionAsk(message);
    if (ask && !seenAskConversations.has(ask.conversationId)) {
      const laterOutbound = sorted.some(
        (row) =>
          row.conversationId === ask.conversationId &&
          row.isOutbound &&
          new Date(row.sentAt).getTime() > new Date(ask.sentAt).getTime(),
      );
      if (!laterOutbound) {
        seenAskConversations.add(ask.conversationId);
        actionAsks.push(ask);
      }
    }

    if (message.isOutbound && !seenPromiseConversations.has(message.conversationId)) {
      const promise = extractEmailCommitments(
        message.subject,
        message.bodyPreview,
        true,
      ).find((item) => item.kind === "promise");
      if (promise) {
        const laterInbound = sorted.some(
          (row) =>
            row.conversationId === message.conversationId &&
            !row.isOutbound &&
            new Date(row.sentAt).getTime() > new Date(message.sentAt).getTime(),
        );
        const days = daysSinceIso(message.sentAt);
        if (!laterInbound && days >= 1) {
          seenPromiseConversations.add(message.conversationId);
          openPromises.push({
            messageId: message.id,
            subject: message.subject,
            excerpt: promise.text,
            sentAt: message.sentAt,
            conversationId: message.conversationId,
          });
        }
      }
    }

    const proposalKind = detectOutboundProposalSignal(message);
    if (!proposalKind) continue;
    if (seenFollowUpConversations.has(message.conversationId)) continue;

    const days = daysSinceIso(message.sentAt);
    if (days < FOLLOW_UP_AFTER_DAYS) continue;

    const laterInbound = sorted.some(
      (row) =>
        row.conversationId === message.conversationId &&
        !row.isOutbound &&
        new Date(row.sentAt).getTime() > new Date(message.sentAt).getTime(),
    );
    if (laterInbound) continue;

    seenFollowUpConversations.add(message.conversationId);
    proposalFollowUps.push({
      messageId: message.id,
      subject: message.subject,
      sentAt: message.sentAt,
      daysSince: days,
      conversationId: message.conversationId,
      kind: proposalKind,
    });
  }

  return {
    actionAsks: actionAsks.reverse().slice(0, 3),
    proposalFollowUps: proposalFollowUps.reverse().slice(0, 3),
    openPromises: openPromises.reverse().slice(0, 3),
    commitments: commitments.slice(0, 12),
  };
}
