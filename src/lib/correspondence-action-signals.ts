/**
 * Detect actionable asks and proposal/RFP follow-up needs from mail text.
 * Reality First — only surface what the message evidence supports.
 */

export type CorrespondenceActionAsk = {
  messageId: string;
  subject: string;
  excerpt: string;
  sentAt: string;
  conversationId: string;
};

export type CorrespondenceProposalFollowUp = {
  messageId: string;
  subject: string;
  sentAt: string;
  daysSince: number;
  conversationId: string;
  kind: "proposal_sent" | "proposal_requested";
};

export type CorrespondenceMailSnippet = {
  id: string;
  conversationId: string;
  subject: string;
  bodyPreview: string | null;
  sentAt: string;
  isOutbound: boolean;
};

const ACTION_ASK_PATTERNS: RegExp[] = [
  /\b(please|kindly)\s+(send|provide|confirm|review|share|call|reply|advise|update|clarify)/i,
  /\b(can you|could you|would you|will you)\s+/i,
  /\b(we need|we require|requesting|looking for|waiting for|awaiting)\b/i,
  /\b(action required|next steps?|please advise|as soon as possible|\basap\b)\b/i,
  // Norwegian
  /\b(kan du|kan dere|vennligst|trenger|ber om|send(e)?\s+(oss|meg)|følg\s+opp|oppdatere?)\b/i,
  /\b(trenger\s+(dokumentasjon|tilbud|svar|bekreftelse)|send\s+dokumentasjon)\b/i,
];

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

export function detectInboundActionAsk(
  message: CorrespondenceMailSnippet,
): CorrespondenceActionAsk | null {
  if (message.isOutbound) return null;
  const text = haystack(message);
  if (!ACTION_ASK_PATTERNS.some((pattern) => pattern.test(text))) return null;
  return {
    messageId: message.id,
    subject: message.subject,
    excerpt: excerptFrom(message),
    sentAt: message.sentAt,
    conversationId: message.conversationId,
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
  // Subject-only commercial package cues
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
} {
  const sorted = [...messages].sort(
    (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
  );

  const actionAsks: CorrespondenceActionAsk[] = [];
  const proposalFollowUps: CorrespondenceProposalFollowUp[] = [];
  const seenAskConversations = new Set<string>();
  const seenFollowUpConversations = new Set<string>();

  for (const message of sorted) {
    const ask = detectInboundActionAsk(message);
    if (ask && !seenAskConversations.has(ask.conversationId)) {
      // Only keep if no later outbound reply in same thread after the ask.
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

  // Prefer newest asks / follow-ups first; cap noise.
  return {
    actionAsks: actionAsks.reverse().slice(0, 3),
    proposalFollowUps: proposalFollowUps.reverse().slice(0, 3),
  };
}
