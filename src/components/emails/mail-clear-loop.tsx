"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EmailMessageActions } from "@/components/emails/email-message-actions";
import type { EmailMessageIntelligenceDto } from "@/lib/email-intelligence-data";
import { isInternalEmail } from "@/lib/domain-rules";
import type { MailClearItem } from "@/lib/mail-clear-queue";
import { outlookComposeUrl } from "@/lib/outlook-compose-link";
import { leadMessageOf, type MailThread } from "@/lib/mail-triage";
import { company360Href } from "@/types/company-360";
import { contact360Href } from "@/types/relationship-navigation";
import type { SharePointPerson } from "@/types/company";
import type { UserRole } from "@/types/auth";

type Thread = MailThread<EmailMessageIntelligenceDto>;

function replyTarget(message: EmailMessageIntelligenceDto): string {
  if (!message.isOutbound) return message.senderEmail;
  return (
    message.recipientEmails.find((address) => !isInternalEmail(address)) ??
    message.recipientEmails[0] ??
    ""
  );
}

function ageLabel(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function resendAddress(thread: Thread): string | null {
  if (thread.status.kind !== "delivery_failed") return null;
  if (!thread.status.addressCorrected || thread.status.bouncedMail !== "mail") return null;
  const failed = thread.status.failedAddress?.toLowerCase() ?? null;
  const withContact = thread.messages.find((message) => message.contactId);
  return (
    (withContact?.contactEmails ?? []).find(
      (address) => address.toLowerCase() !== failed,
    ) ?? null
  );
}

/**
 * One-card Clear My Mail loop — what · why it matters · one next step.
 * Michelin: progress fraction only; no dashboard.
 */
export function MailClearLoop({
  items,
  threadsByConversationId,
  role,
  busyId,
  assignableOptions = [],
  onDone,
  onFollowUp,
  onAssignColleague,
  onExit,
}: {
  items: MailClearItem[];
  threadsByConversationId: Map<string, Thread>;
  role: UserRole;
  busyId: string | null;
  assignableOptions?: SharePointPerson[];
  onDone: (thread: Thread) => void;
  onFollowUp: (thread: Thread) => void;
  onAssignColleague?: (thread: Thread, assignee: SharePointPerson) => void;
  onExit: () => void;
}) {
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(() => new Set());
  const [index] = useState(0);

  const visible = useMemo(
    () => items.filter((item) => !skipped.has(item.conversationId)),
    [items, skipped],
  );

  const safeIndex = visible.length === 0 ? 0 : Math.min(index, visible.length - 1);
  const current = visible[safeIndex] ?? null;
  const thread = current
    ? (threadsByConversationId.get(current.conversationId) ?? null)
    : null;
  const lead = thread ? leadMessageOf(thread.messages) : null;
  const withContact = thread?.messages.find((message) => message.contactId);
  const dealMessage = thread?.messages.find((message) => message.opportunityId);
  const projectMessage = thread?.messages.find((message) => message.projectId);
  const busy = Boolean(current && busyId === current.conversationId);
  const toEmail = lead ? replyTarget(lead) : "";
  const resendTo = thread ? resendAddress(thread) : null;

  const skipCurrent = () => {
    if (!current) return;
    setSkipped((prev) => new Set(prev).add(current.conversationId));
  };

  if (!current || !thread || !lead) {
    return (
      <section
        aria-label="Clear my mail"
        className="border border-carbon-blue/10 bg-white px-6 py-10"
      >
        <p className="text-[15px] font-semibold text-carbon-blue">You’re clear</p>
        <p className="mt-1 max-w-lg text-[13px] text-carbon-blue/65">
          Nothing in this list needs a decision right now. Open conversations anytime.
        </p>
        <button
          type="button"
          onClick={onExit}
          className="mt-5 inline-flex items-center border border-carbon-blue/20 bg-white px-3.5 py-2 text-[13px] font-semibold text-carbon-blue hover:border-upcycle-orange hover:text-upcycle-orange"
        >
          Exit to list
        </button>
      </section>
    );
  }

  const companyKey = withContact?.companyCode ?? withContact?.companyId ?? null;
  const contactId = withContact?.contactId ?? null;

  return (
    <section aria-label="Clear my mail" className="border border-carbon-blue/10 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-carbon-blue/10 px-5 py-3">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-carbon-blue/55">
          Clear my mail · {safeIndex + 1} of {visible.length}
        </p>
        <button
          type="button"
          onClick={onExit}
          className="text-[12px] font-semibold text-carbon-blue/60 hover:text-upcycle-orange"
        >
          Exit to list
        </button>
      </div>

      <div className="px-5 py-6 sm:px-8 sm:py-8">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-upcycle-orange">
          {current.kind === "delivery_failed"
            ? "Delivery"
            : current.kind === "waiting_on_them"
              ? "Waiting"
              : "You owe"}
        </p>
        <h2 className="mt-2 max-w-2xl text-[22px] font-semibold leading-snug text-carbon-blue">
          {current.title}
        </h2>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-carbon-blue/75">
          {current.impact}
        </p>

        <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-carbon-blue/60">
          {companyKey && current.companyName ? (
            <Link
              href={company360Href(companyKey)}
              className="font-semibold text-carbon-blue hover:text-upcycle-orange hover:underline"
            >
              {current.companyName}
            </Link>
          ) : current.companyName ? (
            <span className="font-semibold text-carbon-blue">{current.companyName}</span>
          ) : null}
          {contactId && current.contactName ? (
            <Link
              href={contact360Href(contactId, companyKey ?? undefined)}
              className="font-medium text-upcycle-orange hover:underline"
            >
              {current.contactName}
            </Link>
          ) : current.contactName ? (
            <span>{current.contactName}</span>
          ) : null}
          <span>· {current.subject}</span>
          <span>· {ageLabel(current.daysSince)}</span>
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {current.primaryAction === "resend" && resendTo ? (
            <a
              href={outlookComposeUrl({ to: resendTo, subject: current.subject })}
              className="inline-flex items-center border border-upcycle-orange bg-upcycle-orange px-3.5 py-2 text-[13px] font-semibold text-white hover:opacity-90"
            >
              Resend
            </a>
          ) : null}

          {current.primaryAction === "check_contact" && contactId ? (
            <Link
              href={contact360Href(contactId, companyKey ?? undefined)}
              className="inline-flex items-center border border-upcycle-orange bg-upcycle-orange px-3.5 py-2 text-[13px] font-semibold text-white hover:opacity-90"
            >
              Check contact
            </Link>
          ) : null}

          {current.primaryAction === "reply" && toEmail ? (
            <EmailMessageActions
              toEmail={toEmail}
              subject={lead.subject}
              bodyPreview={lead.bodyPreview}
              contactId={contactId}
              contactName={withContact?.contactName ?? null}
              contactPhone={withContact?.contactPhone ?? null}
              opportunityId={dealMessage?.opportunityId ?? undefined}
              opportunityName={dealMessage?.opportunityName ?? null}
              projectId={projectMessage?.projectId ?? undefined}
              projectName={projectMessage?.projectName ?? null}
              status={thread.status}
              role={role}
              disabled={busy}
              compact
            />
          ) : null}

          {current.primaryAction === "follow_up" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onFollowUp(thread)}
              className="inline-flex items-center border border-upcycle-orange bg-upcycle-orange px-3.5 py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              Follow up
            </button>
          ) : null}

          <button
            type="button"
            disabled={busy}
            onClick={() => onDone(thread)}
            className="inline-flex items-center border border-carbon-blue/20 bg-white px-3.5 py-2 text-[13px] font-semibold text-carbon-blue hover:border-upcycle-orange hover:text-upcycle-orange disabled:opacity-50"
          >
            Done
          </button>

          {onAssignColleague && assignableOptions.length > 0 ? (
            <label className="inline-flex items-center gap-1.5 text-[12px] text-carbon-blue/65">
              <span className="sr-only">Assign to colleague</span>
              <select
                disabled={busy}
                defaultValue=""
                onChange={(event) => {
                  const id = Number(event.target.value);
                  event.target.value = "";
                  const assignee = assignableOptions.find((option) => option.Id === id);
                  if (!assignee) return;
                  onAssignColleague(thread, assignee);
                  skipCurrent();
                }}
                className="border border-carbon-blue/15 bg-white px-2 py-1.5 text-[12px] font-semibold text-carbon-blue disabled:opacity-50"
              >
                <option value="">Assign…</option>
                {assignableOptions.map((option) => (
                  <option key={option.Id} value={option.Id}>
                    {option.Title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <button
            type="button"
            disabled={busy}
            onClick={skipCurrent}
            className="text-[12px] font-medium text-carbon-blue/50 hover:text-carbon-blue disabled:opacity-50"
          >
            Skip
          </button>
        </div>
      </div>
    </section>
  );
}
