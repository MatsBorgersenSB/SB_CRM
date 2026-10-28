/**
 * Mail triage — turns a flat list of synced messages into conversations and says,
 * per conversation, whether anything needs the user.
 *
 * Pure and deterministic. Reality First: a status is only produced when the message
 * evidence supports it. Unknown stays quiet — no status, no invented urgency.
 */

import { detectInboundActionAsk } from "@/lib/correspondence-action-signals";
import { isInternalEmail } from "@/lib/domain-rules";

export type MailTriageMessage = {
  id: string;
  conversationId: string;
  subject: string;
  bodyPreview: string | null;
  senderEmail: string;
  sentAt: string;
  isOutbound: boolean;
  isDeletedInSource?: boolean;
  recipientEmails?: string[];
  /** Current addresses on the linked contact, when one is linked. */
  contactEmails?: string[];
  /** When someone marked the thread "no reply needed" — an older ask stays quiet after this. */
  handledAt?: string | null;
};

/** What a single message is, regardless of who sent it. */
export type MailMessageKind =
  | "human"
  | "meeting_notice"
  | "delivery_failure"
  | "automatic";

const DELIVERY_FAILURE_SUBJECT =
  /^(undeliverable|delivery (has )?failed|delivery status notification|returned mail|mail delivery (failed|subsystem)|failure notice|kunne ikke leveres|ikke levert)\b/i;
const SYSTEM_SENDER = /^(postmaster|mailer-daemon|microsoftexchange)/i;
const MEETING_NOTICE_SUBJECT =
  /^(accepted|declined|tentatively accepted|tentative|canceled|cancelled|godtatt|avsl[åa]tt|avvist|forel[øo]pig godtatt|tentativt godtatt|avlyst)\s*:/i;
const AUTOMATIC_SUBJECT =
  /^(automatic reply|automatisk svar|autosvar|out of office|frav[æa]rsmelding|order\s*confirmation|ordre\s*bekreftelse|ordrebekreftelse|takk for (din |deres )?(bestilling|ordre)|thank you for your (order|purchase))\b|\b(verification|security|login|log-?in|sign-?in|one-?time|confirmation) code\b|\byour .{0,30} code is\b/i;
const AUTOMATIC_BODY =
  /do not reply to this (e-?mail|message)|please do not reply|ikke svar p[åa] denne|this is an automated|automatisk generert|sendt automatisk/i;
const NO_REPLY_SENDER = /(^|[._-])(no-?reply|do-?not-?reply|donotreply)([._-]|@)/i;
/** Mailboxes that only ever send machine mail — notices, receipts, newsletters. */
const AUTOMATED_SENDER_LOCALPART =
  /^(notifications?|alerts?|mailer|newsletters?|news|orders?|ordre|bestilling|kunde\.no|autosvar|system|receipts?|updates?)@/i;

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/** Days without an answer before an outbound mail is worth a follow-up. */
export const WAITING_AFTER_DAYS = 3;

export function classifyMailMessage(
  message: Pick<MailTriageMessage, "subject" | "senderEmail"> & {
    bodyPreview?: string | null;
  },
): MailMessageKind {
  const subject = message.subject.trim();
  const sender = message.senderEmail.trim().toLowerCase();
  if (DELIVERY_FAILURE_SUBJECT.test(subject) || SYSTEM_SENDER.test(sender)) {
    return "delivery_failure";
  }
  if (MEETING_NOTICE_SUBJECT.test(subject)) return "meeting_notice";
  if (
    AUTOMATIC_SUBJECT.test(subject) ||
    NO_REPLY_SENDER.test(sender) ||
    AUTOMATED_SENDER_LOCALPART.test(sender) ||
    AUTOMATIC_BODY.test(message.bodyPreview ?? "")
  ) {
    return "automatic";
  }
  return "human";
}

/** "Undeliverable: Re: Quote" → "Re: Quote". Null when nothing is left. */
export function bouncedSubject(subject: string): string | null {
  const trimmed = subject.trim();
  const stripped = DELIVERY_FAILURE_SUBJECT.test(trimmed)
    ? trimmed.replace(/^[^:]{0,60}:\s*/, "")
    : trimmed;
  return stripped.trim() || null;
}

/**
 * The address a bounce says could not be reached. Null when the text does not name one —
 * never guessed.
 */
export function failedRecipientFromBounce(
  message: Pick<MailTriageMessage, "senderEmail" | "bodyPreview" | "subject">,
): string | null {
  const text = `${message.bodyPreview ?? ""}`;
  const sender = message.senderEmail.trim().toLowerCase();
  const found = text.match(EMAIL_PATTERN) ?? [];
  for (const raw of found) {
    const address = raw.toLowerCase();
    if (address === sender) continue;
    if (SYSTEM_SENDER.test(address)) continue;
    // The failed recipient is the outside party — our own address is the sender of the original.
    if (isInternalEmail(address)) continue;
    return address;
  }
  return null;
}

export type MailThreadStatus =
  | {
      kind: "delivery_failed";
      failedAddress: string | null;
      sentAt: string;
      /** The contact no longer carries the failed address: it was fixed, but the mail was not resent. */
      addressCorrected: boolean;
      /** What bounced: a normal mail, or only our reply to a meeting invitation. */
      bouncedMail: "mail" | "calendar";
      /** Subject of the mail that bounced (bounce prefix removed). Null when unknown. */
      originalSubject: string | null;
    }
  | { kind: "reply_needed"; days: number; ask: string | null }
  | { kind: "waiting_on_them"; days: number }
  | { kind: "meeting_notice" }
  | { kind: "none" };

export type MailThreadTone = "alert" | "attention" | "quiet";

export type MailThreadStatusCopy = {
  label: string;
  /** Why it matters. A status without impact is not shown. */
  impact: string;
  tone: MailThreadTone;
};

function wholeDaysBetween(fromIso: string, now: Date): number {
  const then = new Date(fromIso);
  if (Number.isNaN(then.getTime())) return 0;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  return Math.max(0, Math.round((start.getTime() - end.getTime()) / 86_400_000));
}

function time(iso: string): number {
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Status of one conversation from all of its messages (oldest or newest first — either works).
 * `everyMessage` is the whole mailbox list. It lets a bounce clear when a later mail
 * reached the contact's corrected address from another conversation.
 */
export function triageMailThread(
  messages: readonly MailTriageMessage[],
  now: Date = new Date(),
  everyMessage: readonly MailTriageMessage[] = messages,
): MailThreadStatus {
  const live = messages.filter((message) => !message.isDeletedInSource);
  if (live.length === 0) return { kind: "none" };

  const sorted = [...live].sort((a, b) => time(a.sentAt) - time(b.sentAt));
  const human = sorted.filter((message) => classifyMailMessage(message) === "human");
  const failures = sorted.filter(
    (message) => classifyMailMessage(message) === "delivery_failure",
  );
  const lastHuman = human.at(-1) ?? null;
  const lastFailure = failures.at(-1) ?? null;

  // A bounce that nothing human followed means the person never got our mail.
  if (lastFailure && (!lastHuman || time(lastFailure.sentAt) >= time(lastHuman.sentAt))) {
    const failedAddress = failedRecipientFromBounce(lastFailure);
    const current = (
      live.find((message) => (message.contactEmails?.length ?? 0) > 0)?.contactEmails ?? []
    ).map((address) => address.trim().toLowerCase());
    const addressCorrected =
      failedAddress !== null && current.length > 0 && !current.includes(failedAddress);

    const originalSubject = bouncedSubject(lastFailure.subject);
    const bouncedMail =
      originalSubject !== null && MEETING_NOTICE_SUBJECT.test(originalSubject)
        ? "calendar"
        : "mail";

    // Only our meeting reply bounced and the address is fixed: nothing to resend.
    if (addressCorrected && bouncedMail === "calendar") return { kind: "none" };

    // Fixed and already resent to the corrected address: nothing left to do.
    if (addressCorrected) {
      const resent = everyMessage.some(
        (message) =>
          message.isOutbound &&
          !message.isDeletedInSource &&
          classifyMailMessage(message) === "human" &&
          time(message.sentAt) > time(lastFailure.sentAt) &&
          (message.recipientEmails ?? []).some((address) =>
            current.includes(address.trim().toLowerCase()),
          ),
      );
      if (resent) return { kind: "none" };
    }

    return {
      kind: "delivery_failed",
      failedAddress,
      sentAt: lastFailure.sentAt,
      addressCorrected,
      bouncedMail,
      originalSubject,
    };
  }

  if (!lastHuman) {
    return sorted.some((message) => classifyMailMessage(message) === "meeting_notice")
      ? { kind: "meeting_notice" }
      : { kind: "none" };
  }

  // Someone said "no reply needed" after this mail — stay quiet until something newer arrives.
  const handledAt = live.reduce(
    (latest, message) => Math.max(latest, message.handledAt ? time(message.handledAt) : 0),
    0,
  );
  if (handledAt > 0 && handledAt >= time(lastHuman.sentAt)) return { kind: "none" };

  const days = wholeDaysBetween(lastHuman.sentAt, now);

  if (!lastHuman.isOutbound) {
    const ask = detectInboundActionAsk({
      id: lastHuman.id,
      conversationId: lastHuman.conversationId,
      subject: lastHuman.subject,
      bodyPreview: lastHuman.bodyPreview,
      sentAt: lastHuman.sentAt,
      isOutbound: false,
    });
    // Only claim "reply needed" when the mail actually asks for something.
    return ask ? { kind: "reply_needed", days, ask: ask.excerpt } : { kind: "none" };
  }

  if (days >= WAITING_AFTER_DAYS) return { kind: "waiting_on_them", days };
  return { kind: "none" };
}

function dayWord(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

/** Business-language copy for a status. Null when there is nothing to say. */
export function describeMailThreadStatus(
  status: MailThreadStatus,
  who: string | null,
): MailThreadStatusCopy | null {
  const person = who?.trim() || "The recipient";
  switch (status.kind) {
    case "delivery_failed":
      if (status.bouncedMail === "calendar") {
        return {
          label: "Meeting reply not delivered",
          tone: "attention",
          impact: `${person} did not receive your reply to their meeting invitation. Check their address on the contact so the next invitation reaches you both.`,
        };
      }
      if (status.addressCorrected) {
        return {
          label: "Not delivered · resend",
          tone: "attention",
          impact: `${person} has not received this. The address on the contact has been corrected since. Send it again.`,
        };
      }
      return {
        label: "Delivery failed",
        tone: "alert",
        impact: status.failedAddress
          ? `${person} has not received this. The address “${status.failedAddress}” could not be reached — check it on the contact.`
          : `${person} has not received this. Check the contact’s email address.`,
      };
    case "reply_needed":
      return {
        label: status.days <= 0 ? "Reply needed · today" : `Reply needed · ${dayWord(status.days)}`,
        tone: "attention",
        impact: status.ask
          ? `They asked: “${status.ask}” — the conversation stalls until you answer.`
          : "They asked for something — the conversation stalls until you answer.",
      };
    case "waiting_on_them":
      return {
        label: `No reply · ${dayWord(status.days)}`,
        tone: "attention",
        impact:
          "Nothing has come back since our last mail. A short follow-up keeps it from going cold.",
      };
    case "meeting_notice":
      return {
        label: "Meeting response",
        tone: "quiet",
        impact: "Calendar traffic only — no message to answer.",
      };
    default:
      return null;
  }
}

export type MailThread<TMessage extends MailTriageMessage> = {
  conversationId: string;
  messages: TMessage[];
  status: MailThreadStatus;
};

/** Group messages by conversation (newest message first inside each thread). */
export function groupMailIntoThreads<TMessage extends MailTriageMessage>(
  messages: readonly TMessage[],
  now: Date = new Date(),
): MailThread<TMessage>[] {
  const byConversation = new Map<string, TMessage[]>();
  for (const message of messages) {
    const key = message.conversationId || message.id;
    const list = byConversation.get(key) ?? [];
    list.push(message);
    byConversation.set(key, list);
  }
  return [...byConversation.entries()].map(([conversationId, list]) => ({
    conversationId,
    messages: [...list].sort((a, b) => time(b.sentAt) - time(a.sentAt)),
    status: triageMailThread(list, now, messages),
  }));
}

/** The message a row should lead with — the newest real person-to-person mail. */
export function leadMessageOf<TMessage extends MailTriageMessage>(
  messages: readonly TMessage[],
): TMessage | null {
  const sorted = [...messages].sort((a, b) => time(b.sentAt) - time(a.sentAt));
  return (
    sorted.find(
      (message) =>
        !message.isDeletedInSource && classifyMailMessage(message) === "human",
    ) ??
    sorted[0] ??
    null
  );
}

export type MailView = "all" | "needs_you" | "waiting" | "unlinked" | "system";

export const MAIL_VIEW_LABELS: Record<MailView, string> = {
  all: "Conversations",
  needs_you: "Needs you",
  waiting: "Waiting on them",
  unlinked: "Not linked to work",
  system: "Meetings & system",
};

export function threadMatchesView(
  thread: {
    status: MailThreadStatus;
    messages: ReadonlyArray<MailTriageMessage & {
      opportunityId?: string | null;
      projectId?: string | null;
    }>;
  },
  view: MailView,
): boolean {
  switch (view) {
    case "needs_you":
      return (
        thread.status.kind === "reply_needed" || thread.status.kind === "delivery_failed"
      );
    case "waiting":
      return thread.status.kind === "waiting_on_them";
    case "unlinked":
      return (
        thread.messages.some((m) => classifyMailMessage(m) === "human") &&
        !thread.messages.some((m) => m.opportunityId || m.projectId)
      );
    case "system":
      return thread.messages.every((m) => classifyMailMessage(m) !== "human");
    default:
      // Real conversations only — notices, receipts and newsletters live under "Meetings & system".
      return thread.messages.some((m) => classifyMailMessage(m) === "human");
  }
}

export function countMailViews(
  threads: ReadonlyArray<Parameters<typeof threadMatchesView>[0]>,
): Record<MailView, number> {
  const counts: Record<MailView, number> = {
    all: 0,
    needs_you: 0,
    waiting: 0,
    unlinked: 0,
    system: 0,
  };
  for (const thread of threads) {
    for (const view of ["all", "needs_you", "waiting", "unlinked", "system"] as const) {
      if (threadMatchesView(thread, view)) counts[view] += 1;
    }
  }
  return counts;
}
