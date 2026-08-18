"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { openOutlookDraft } from "@/components/opportunities/draft-in-outlook-button";
import { telHref, teamsMeetingComposeHref } from "@/lib/compose-actions";
import { stashSmartAssistPrefill } from "@/lib/smart-assist-prefill";
import type { UserRole } from "@/types/auth";

const PRIMARY_ACTION_CLASS =
  "inline-flex items-center border border-upcycle-orange bg-upcycle-orange px-2.5 py-1 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50";

const SECONDARY_ACTION_CLASS =
  "inline-flex items-center border border-carbon-blue/20 bg-white px-2.5 py-1 text-[11px] font-semibold text-carbon-blue transition-colors hover:border-upcycle-orange/50 hover:text-upcycle-orange disabled:opacity-50";

function replySubject(subject: string): string {
  return /^re:/i.test(subject.trim()) ? subject : `Re: ${subject}`;
}

function replyBodyHtml(bodyPreview: string | null): string {
  const preview = bodyPreview
    ? `<blockquote style="border-left:3px solid #ccc;padding-left:8px;color:#555">${bodyPreview}</blockquote>`
    : "";
  return [
    `<p>Hi,</p>`,
    `<p>Thank you for your note. Following up on the points below and confirming next steps.</p>`,
    preview,
    `<p>Best regards</p>`,
  ].join("");
}

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
  projectId,
  role = "superuser",
  disabled = false,
  compact = false,
}: {
  toEmail: string;
  subject: string;
  bodyPreview: string | null;
  contactId?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  opportunityId?: string;
  projectId?: string;
  role?: UserRole;
  disabled?: boolean;
  /** Reply only — Call / meeting live on the contact header. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const phone = contactPhone?.trim() || "";
  const title = meetingSubject(subject, contactName);

  const reply = async () => {
    if (!toEmail.trim()) return;
    setReplyBusy(true);
    setReplyError(null);
    try {
      await openOutlookDraft(
        {
          toEmail,
          subject: replySubject(subject),
          bodyHtml: replyBodyHtml(bodyPreview),
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
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={disabled || replyBusy || !toEmail.trim()}
          onClick={() => void reply()}
          className={PRIMARY_ACTION_CLASS}
        >
          {replyBusy ? "Opening…" : "Reply"}
        </button>
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
      {replyError ? <p className="mt-1 text-[10px] text-thermal-red">{replyError}</p> : null}
    </div>
  );
}
