"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { openOutlookDraft } from "@/components/opportunities/draft-in-outlook-button";
import { telHref, teamsMeetingComposeHref } from "@/lib/compose-actions";
import { buildSmartMailReplyDraft } from "@/lib/mail-reply-draft";
import type { MailThreadStatus } from "@/lib/mail-triage";
import { stashSmartAssistPrefill } from "@/lib/smart-assist-prefill";
import type { UserRole } from "@/types/auth";

const PRIMARY_ACTION_CLASS =
  "inline-flex items-center border border-upcycle-orange bg-upcycle-orange px-2.5 py-1 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50";

const SECONDARY_ACTION_CLASS =
  "inline-flex items-center border border-carbon-blue/20 bg-white px-2.5 py-1 text-[12px] font-semibold text-carbon-blue transition-colors hover:border-upcycle-orange/50 hover:text-upcycle-orange disabled:opacity-50";

function meetingSubject(subject: string, contactName: string | null): string {
  const topic = subject.replace(/^re:\s*/i, "").trim() || "follow-up";
  if (contactName?.trim()) return `Meeting with ${contactName.trim()} — ${topic}`;
  return `Meeting — ${topic}`;
}

function meetingBody(subject: string, bodyPreview: string | null): string {
  const lines = [
    `Regarding: ${subject}`,
    "",
    bodyPreview?.trim() || "Follow up from SmartCRM correspondence.",
  ];
  return lines.join("\n");
}

/**
 * Primary actions when reading a synced mail — Reply, Call, Plan meeting, Create meeting.
 * Reality First: Call dials only when a phone is known; otherwise plans a Phone Call activity.
 */
export function EmailMessageActions({
  toEmail,
  subject,
  bodyPreview,
  contactId = null,
  contactName = null,
  contactPhone = null,
  opportunityId,
  opportunityName = null,
  projectId,
  projectName = null,
  status,
  role = "superuser",
  disabled = false,
  compact = false,
  trailing = null,
}: {
  toEmail: string;
  subject: string;
  bodyPreview: string | null;
  contactId?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  opportunityId?: string;
  opportunityName?: string | null;
  projectId?: string;
  projectName?: string | null;
  status?: MailThreadStatus;
  role?: UserRole;
  disabled?: boolean;
  /** Reply only — Call / meeting live on the contact header. */
  compact?: boolean;
  /** Sits on the same row as Reply. */
  trailing?: ReactNode;
}) {
  const router = useRouter();
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const phone = contactPhone?.trim() || "";
  const title = meetingSubject(subject, contactName);
  const replyDraft = buildSmartMailReplyDraft({
    subject,
    bodyPreview,
    contactName,
    status,
    opportunityName,
    projectName,
  });

  const reply = async () => {
    if (!toEmail.trim()) return;
    setReplyBusy(true);
    setReplyError(null);
    try {
      await openOutlookDraft(
        {
          toEmail,
          subject: replyDraft.subject,
          bodyHtml: replyDraft.bodyHtml,
          opportunityId,
          projectId,
        },
        role,
      );
    } catch (error) {
      setReplyError(error instanceof Error ? error.message : "Could not open reply");
    } finally {
      setReplyBusy(false);
    }
  };

  const planMeeting = () => {
    stashSmartAssistPrefill({
      ActivityType: "Meeting",
      Subject: title,
      ...(contactId ? { contactId } : {}),
      ...(opportunityId ? { dealId: opportunityId } : {}),
    });
    router.push("/activities");
  };

  const planCall = () => {
    stashSmartAssistPrefill({
      ActivityType: "Phone Call",
      Subject: contactName?.trim()
        ? `Call ${contactName.trim()}`
        : `Call regarding ${subject.replace(/^re:\s*/i, "").trim() || "email"}`,
      ...(contactId ? { contactId } : {}),
      ...(opportunityId ? { dealId: opportunityId } : {}),
    });
    router.push("/activities");
  };

  return (
    <div className={compact ? undefined : "mt-2"}>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={disabled || replyBusy || !toEmail.trim()}
          onClick={() => void reply()}
          title={replyDraft.objective}
          className={PRIMARY_ACTION_CLASS}
        >
          {replyBusy ? "Opening…" : "Reply"}
        </button>
        {trailing}
        {compact ? null : (
          <>
            {phone ? (
              <a href={telHref(phone)} className={SECONDARY_ACTION_CLASS}>
                Call
              </a>
            ) : (
              <button
                type="button"
                disabled={disabled}
                onClick={planCall}
                className={SECONDARY_ACTION_CLASS}
                title="No phone on file — plan a call in Activities"
              >
                Call
              </button>
            )}
            <button
              type="button"
              disabled={disabled}
              onClick={planMeeting}
              className={SECONDARY_ACTION_CLASS}
            >
              Plan meeting
            </button>
            <a
              href={teamsMeetingComposeHref(title, meetingBody(subject, bodyPreview))}
              target="_blank"
              rel="noopener noreferrer"
              className={SECONDARY_ACTION_CLASS}
            >
              Create meeting
            </a>
          </>
        )}
      </div>
      {replyError ? <p className="mt-1 text-[11px] text-thermal-red">{replyError}</p> : null}
    </div>
  );
}
