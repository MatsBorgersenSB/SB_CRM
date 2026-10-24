/**
 * SmartAssist mail check — what is open on an opportunity because of its mail.
 *
 * Reads the mail already linked to the opportunity and answers three questions:
 *   1. What do WE owe the client?   (they asked, or we promised, and nothing followed)
 *   2. What does the CLIENT owe us? (we asked or quoted, and they have not replied)
 *   3. What is still missing?       (facts we need — and whether the mail already holds them)
 *
 * Pure and deterministic. Reality First: only what the message text supports; facts found in
 * mail are suggestions the user confirms, never silent writes.
 */

import { detectEmailRequestExcerpt } from "@/lib/email-sentiment";
import {
  extractCorrespondenceActionSignals,
  type CorrespondenceMailSnippet,
} from "@/lib/correspondence-action-signals";

export type MailTodoSide = "we_owe" | "client_owes";

export type MailTodoSource =
  | "client_asked"
  | "our_promise"
  | "we_asked"
  | "quote_follow_up";

export type MailTodo = {
  id: string;
  side: MailTodoSide;
  source: MailTodoSource;
  /** Business-language what, e.g. "Client asked: can you send a quote…" */
  text: string;
  subject: string;
  sentAt: string;
  daysSince: number;
  conversationId: string;
};

export type MailFactSuggestion = {
  fieldId: string;
  label: string;
  /** The mail wording the suggestion comes from — shown so the user can verify. */
  excerpt: string;
  messageId: string;
  sentAt: string;
};

export type MissingFieldInput = { fieldId: string; label: string };

export type MailAnalysis = {
  messageCount: number;
  weOwe: MailTodo[];
  clientOwes: MailTodo[];
  /** Missing facts the client has already stated in mail — confirm to save. */
  suggestions: MailFactSuggestion[];
  /** Missing facts nobody has stated yet — ask the client. */
  askClient: MissingFieldInput[];
};

const ASK_REPLY_AFTER_DAYS = 2;
const MAX_PER_SIDE = 3;

const QUANTITY_PATTERN =
  /\b\d[\d\s.,]*\s?(tonnes?|tons?|tonn|kg\/h|t\/h|kg|m3|m³|litres?|liters?|bags?|big[\s-]?bags?|pallets?|paller|sekker|kw|mw|tpa|t\/år|tonn\/år)\b/i;

const MONTHS =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|mai|jun(?:e)?|juni|jul(?:y)?|juli|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|okt(?:ober)?|nov(?:ember)?|dec(?:ember)?|des(?:ember)?";

const NEEDED_BY_PATTERNS: RegExp[] = [
  new RegExp(
    `\\b(by|before|no later than|latest|deliver(?:y|ed)?|needed|need it|senest|innen|levering|trenger)\\b[^.\\n]{0,40}\\b(\\d{1,2}[./-]\\d{1,2}([./-]\\d{2,4})?|week\\s?\\d{1,2}|uke\\s?\\d{1,2}|q[1-4]\\b|(\\d{1,2}\\.?\\s)?(?:${MONTHS})\\b(\\s\\d{4})?|end of (the )?(month|year|week)|asap)`,
    "i",
  ),
  /\b(week|uke)\s?\d{1,2}\b/i,
];

function dateWindow(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const start = Math.max(0, (match.index ?? 0) - 15);
    return text.slice(start, start + 120).replace(/\s+/g, " ").trim();
  }
  return null;
}

function quantityWindow(text: string): string | null {
  const match = text.match(QUANTITY_PATTERN);
  if (!match) return null;
  const start = Math.max(0, (match.index ?? 0) - 25);
  return text.slice(start, start + 100).replace(/\s+/g, " ").trim();
}

function daysSince(iso: string, now: Date): number {
  const then = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(then.getTime())) return 0;
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / 86_400_000));
}

function clip(text: string, max = 110): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** Facts the client stated in mail, keyed by understanding field. */
function detectClientFacts(
  inbound: CorrespondenceMailSnippet[],
): Array<{ fieldId: string; excerpt: string; messageId: string; sentAt: string }> {
  const out: Array<{ fieldId: string; excerpt: string; messageId: string; sentAt: string }> =
    [];
  // Newest statement wins — the client may have revised an earlier figure.
  const newestFirst = [...inbound].sort(
    (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
  );
  for (const fieldId of ["capacity", "timeline"] as const) {
    for (const message of newestFirst) {
      const text = `${message.subject}\n${message.bodyPreview ?? ""}`;
      const excerpt =
        fieldId === "capacity" ? quantityWindow(text) : dateWindow(text, NEEDED_BY_PATTERNS);
      if (excerpt) {
        out.push({ fieldId, excerpt, messageId: message.id, sentAt: message.sentAt });
        break;
      }
    }
  }
  return out;
}

export function analyzeOpportunityMail(
  messages: CorrespondenceMailSnippet[],
  missingFields: MissingFieldInput[],
  now: Date = new Date(),
): MailAnalysis {
  const signals = extractCorrespondenceActionSignals(messages);
  const weOwe: MailTodo[] = [];
  const clientOwes: MailTodo[] = [];
  const taken = new Set<string>();

  for (const ask of signals.actionAsks) {
    weOwe.push({
      id: `ask-${ask.messageId}`,
      side: "we_owe",
      source: "client_asked",
      text: `Client asked: ${clip(ask.excerpt)}`,
      subject: ask.subject,
      sentAt: ask.sentAt,
      daysSince: daysSince(ask.sentAt, now),
      conversationId: ask.conversationId,
    });
    taken.add(ask.conversationId);
  }

  for (const promise of signals.openPromises) {
    weOwe.push({
      id: `promise-${promise.messageId}`,
      side: "we_owe",
      source: "our_promise",
      text: `We promised: ${clip(promise.excerpt)}`,
      subject: promise.subject,
      sentAt: promise.sentAt,
      daysSince: daysSince(promise.sentAt, now),
      conversationId: promise.conversationId,
    });
  }

  for (const followUp of signals.proposalFollowUps) {
    clientOwes.push({
      id: `quote-${followUp.messageId}`,
      side: "client_owes",
      source: "quote_follow_up",
      text:
        followUp.kind === "proposal_sent"
          ? "Quote sent — waiting for the client's answer"
          : "Quote requested — waiting for the client's answer",
      subject: followUp.subject,
      sentAt: followUp.sentAt,
      daysSince: followUp.daysSince,
      conversationId: followUp.conversationId,
    });
    taken.add(followUp.conversationId);
  }

  // What we asked the client for that they have not answered.
  const sorted = [...messages].sort(
    (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
  );
  const seenAsked = new Set<string>();
  for (const message of [...sorted].reverse()) {
    if (!message.isOutbound) continue;
    if (taken.has(message.conversationId) || seenAsked.has(message.conversationId)) continue;
    const excerpt = detectEmailRequestExcerpt(message.subject, message.bodyPreview);
    if (!excerpt) continue;
    const sentTime = new Date(message.sentAt).getTime();
    const replied = sorted.some(
      (row) =>
        row.conversationId === message.conversationId &&
        !row.isOutbound &&
        new Date(row.sentAt).getTime() > sentTime,
    );
    const age = daysSince(message.sentAt, now);
    if (replied || age < ASK_REPLY_AFTER_DAYS) continue;
    seenAsked.add(message.conversationId);
    clientOwes.push({
      id: `asked-${message.id}`,
      side: "client_owes",
      source: "we_asked",
      text: `We asked: ${clip(excerpt)}`,
      subject: message.subject,
      sentAt: message.sentAt,
      daysSince: age,
      conversationId: message.conversationId,
    });
  }

  const byAge = (a: MailTodo, b: MailTodo) => b.daysSince - a.daysSince;
  weOwe.sort(byAge);
  clientOwes.sort(byAge);

  // Missing facts: use what the client already told us before asking again.
  const facts = detectClientFacts(messages.filter((message) => !message.isOutbound));
  const suggestions: MailFactSuggestion[] = [];
  const askClient: MissingFieldInput[] = [];
  for (const missing of missingFields) {
    const fact = facts.find((entry) => entry.fieldId === missing.fieldId);
    if (fact) {
      suggestions.push({
        fieldId: missing.fieldId,
        label: missing.label,
        excerpt: fact.excerpt,
        messageId: fact.messageId,
        sentAt: fact.sentAt,
      });
    } else {
      askClient.push(missing);
    }
  }

  return {
    messageCount: messages.length,
    weOwe: weOwe.slice(0, MAX_PER_SIDE),
    clientOwes: clientOwes.slice(0, MAX_PER_SIDE),
    suggestions,
    askClient,
  };
}
