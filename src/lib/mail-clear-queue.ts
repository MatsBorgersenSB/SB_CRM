/**
 * Clear My Mail — ordered open-commitment queue for the one-card focus loop.
 *
 * Automates detection, priority, and quieting. Never creates Activities or sends mail.
 * Reality First: only triage + message evidence; one item per conversation.
 */

import {
  detectInboundActionAsk,
  extractCorrespondenceActionSignals,
  type CorrespondenceMailSnippet,
} from "@/lib/correspondence-action-signals";
import {
  classifyMailMessage,
  describeMailThreadStatus,
  leadMessageOf,
  type MailThread,
  type MailThreadStatus,
  type MailTriageMessage,
} from "@/lib/mail-triage";

export const MAIL_CLEAR_QUEUE_CAP = 12;

export type MailClearKind = "delivery_failed" | "we_owe" | "waiting_on_them";

export type MailClearPrimaryAction =
  | "reply"
  | "resend"
  | "follow_up"
  | "check_contact";

export type MailClearItem = {
  conversationId: string;
  kind: MailClearKind;
  /** 1 = bounce … 4 = waiting on them */
  priority: 1 | 2 | 3 | 4;
  title: string;
  impact: string;
  subject: string;
  daysSince: number;
  contactName: string | null;
  companyName: string | null;
  askExcerpt: string | null;
  primaryAction: MailClearPrimaryAction;
};

type ClearMessage = MailTriageMessage & {
  contactName?: string | null;
  companyName?: string | null;
  contactEmails?: string[];
  opportunityId?: string | null;
  projectId?: string | null;
};

function clip(text: string, max = 120): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trimEnd()}…`;
}

function daysBetween(iso: string, now: Date): number {
  const then = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(then.getTime())) return 0;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  return Math.max(0, Math.round((start.getTime() - end.getTime()) / 86_400_000));
}

function whoLabel(messages: readonly ClearMessage[]): string | null {
  const withContact = messages.find((message) => message.contactName?.trim());
  return withContact?.contactName?.trim() || null;
}

function companyLabel(messages: readonly ClearMessage[]): string | null {
  const withCompany = messages.find((message) => message.companyName?.trim());
  return withCompany?.companyName?.trim() || null;
}

function toSnippet(message: ClearMessage): CorrespondenceMailSnippet {
  return {
    id: message.id,
    conversationId: message.conversationId,
    subject: message.subject,
    bodyPreview: message.bodyPreview,
    sentAt: message.sentAt,
    isOutbound: message.isOutbound,
  };
}

function cleanSubject(subject: string): string {
  return subject.replace(/^(re|fw|fwd|undeliverable|delivery failure):\s*/i, "").trim() || subject;
}

function bouncePrimary(status: Extract<MailThreadStatus, { kind: "delivery_failed" }>, messages: readonly ClearMessage[]): MailClearPrimaryAction {
  if (status.addressCorrected && status.bouncedMail === "mail") {
    const failed = status.failedAddress?.toLowerCase() ?? null;
    const emails = messages.find((message) => (message.contactEmails?.length ?? 0) > 0)?.contactEmails ?? [];
    const hasResend = emails.some((address) => address.toLowerCase() !== failed);
    if (hasResend) return "resend";
  }
  return "check_contact";
}

function itemFromStatus(
  thread: MailThread<ClearMessage>,
  now: Date,
): MailClearItem | null {
  const { status, conversationId, messages } = thread;
  const lead = leadMessageOf(messages);
  if (!lead) return null;

  const contactName = whoLabel(messages);
  const companyName = companyLabel(messages);
  const copy = describeMailThreadStatus(status, contactName);
  const subject = cleanSubject(
    status.kind === "delivery_failed" && status.originalSubject
      ? status.originalSubject
      : lead.subject,
  );

  if (status.kind === "delivery_failed") {
    if (!copy) return null;
    return {
      conversationId,
      kind: "delivery_failed",
      priority: 1,
      title: copy.label,
      impact: copy.impact,
      subject,
      daysSince: daysBetween(status.sentAt, now),
      contactName,
      companyName,
      askExcerpt: null,
      primaryAction: bouncePrimary(status, messages),
    };
  }

  if (status.kind === "reply_needed") {
    if (!copy) return null;
    const ask =
      status.ask ??
      detectInboundActionAsk(toSnippet(lead))?.excerpt ??
      null;
    return {
      conversationId,
      kind: "we_owe",
      priority: 2,
      title: ask ? `They asked: ${clip(ask, 80)}` : "Reply needed",
      impact: copy.impact,
      subject,
      daysSince: status.days,
      contactName,
      companyName,
      askExcerpt: ask,
      primaryAction: "reply",
    };
  }

  if (status.kind === "waiting_on_them") {
    if (!copy) return null;
    return {
      conversationId,
      kind: "waiting_on_them",
      priority: 4,
      title: "Waiting on them",
      impact: copy.impact,
      subject,
      daysSince: status.days,
      contactName,
      companyName,
      askExcerpt: null,
      primaryAction: "follow_up",
    };
  }

  return null;
}

/**
 * Open we-owe from promises when triage is quiet but evidence still says we promised.
 * Skips conversations already covered by reply_needed / delivery_failed / waiting.
 */
function isHandledQuiet(messages: readonly ClearMessage[]): boolean {
  let handledAt = 0;
  let lastHuman = 0;
  for (const message of messages) {
    if (message.isDeletedInSource) continue;
    if (message.handledAt) {
      const t = Date.parse(message.handledAt);
      if (!Number.isNaN(t)) handledAt = Math.max(handledAt, t);
    }
    if (classifyMailMessage(message) !== "human") continue;
    const sent = Date.parse(message.sentAt);
    if (!Number.isNaN(sent)) lastHuman = Math.max(lastHuman, sent);
  }
  return handledAt > 0 && handledAt >= lastHuman;
}

function promiseItems(
  threads: ReadonlyArray<MailThread<ClearMessage>>,
  taken: ReadonlySet<string>,
  now: Date,
): MailClearItem[] {
  const out: MailClearItem[] = [];
  for (const thread of threads) {
    if (taken.has(thread.conversationId)) continue;
    if (thread.status.kind !== "none" && thread.status.kind !== "meeting_notice") continue;
    if (isHandledQuiet(thread.messages)) continue;

    const snippets = thread.messages.map(toSnippet);
    const signals = extractCorrespondenceActionSignals(snippets);
    const promise = signals.openPromises.find(
      (item) => item.conversationId === thread.conversationId,
    );
    const ask = signals.actionAsks.find(
      (item) => item.conversationId === thread.conversationId,
    );
    const open = promise ?? (ask
      ? {
          excerpt: ask.excerpt,
          subject: ask.subject,
          sentAt: ask.sentAt,
          conversationId: ask.conversationId,
        }
      : null);
    if (!open) continue;

    const contactName = whoLabel(thread.messages);
    const companyName = companyLabel(thread.messages);
    const daysSince = daysBetween(open.sentAt, now);
    out.push({
      conversationId: thread.conversationId,
      kind: "we_owe",
      priority: 3,
      title: ask
        ? `They asked: ${clip(open.excerpt, 80)}`
        : `We promised: ${clip(open.excerpt, 80)}`,
      impact: ask
        ? "They asked for something — the conversation stalls until you answer."
        : "We said we would follow through — silence now looks like a broken promise.",
      subject: cleanSubject(open.subject),
      daysSince,
      contactName,
      companyName,
      askExcerpt: open.excerpt,
      primaryAction: "reply",
    });
  }
  return out;
}

function byPriorityThenAge(a: MailClearItem, b: MailClearItem): number {
  if (a.priority !== b.priority) return a.priority - b.priority;
  return b.daysSince - a.daysSince;
}

/**
 * Build the Clear My Mail queue from already-triaged conversation threads.
 * Auto-drops resolved work: triage `none` / handled quiet / machine-only never enter.
 */
export function buildMailClearQueue(
  threads: ReadonlyArray<MailThread<ClearMessage>>,
  now: Date = new Date(),
  cap: number = MAIL_CLEAR_QUEUE_CAP,
): MailClearItem[] {
  const items: MailClearItem[] = [];
  const taken = new Set<string>();

  for (const thread of threads) {
    const item = itemFromStatus(thread, now);
    if (!item) continue;
    items.push(item);
    taken.add(item.conversationId);
  }

  items.push(...promiseItems(threads, taken, now));
  return items.sort(byPriorityThenAge).slice(0, Math.max(0, cap));
}
