"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { openOutlookDraft } from "@/components/opportunities/draft-in-outlook-button";
import { telHref, teamsMeetingComposeHref } from "@/lib/compose-actions";
import { buildSmartMailReplyDraft } from "@/lib/mail-reply-draft";
import type { MailThreadStatus } from "@/lib/mail-triage";
import { stashSmartAssistPrefill } from "@/lib/smart-assist-prefill";
import type { UserRole } from "@/types/auth";

const PRIMARY_ACTION_CLASS =
  "inline-flex items-center border border-upcycle-orange bg-upcycle-orange px-2.5 py-1 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50";

const SECONDARY_ACTION_CLASS =
  "inline-flex items-center gap-1 border border-carbon-blue/20 bg-white px-2.5 py-1 text-[12px] font-semibold text-carbon-blue transition-colors hover:border-upcycle-orange/50 hover:text-upcycle-orange disabled:opacity-50";

const MENU_ITEM_CLASS =
  "flex w-full items-center px-3 py-2 text-left text-[12px] font-semibold text-carbon-blue hover:bg-carbon-blue/[0.04] hover:text-upcycle-orange disabled:opacity-50";

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
 * Primary: Reply. Everything else lives under Actions (Michelin).
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
  extraMenuItems = null,
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
  /** Reply only — Call / meeting live elsewhere. */
  compact?: boolean;
  /** Sits on the same row as Reply (e.g. Ask a teammate). */
  trailing?: ReactNode;
  /** Extra rows inside the Actions menu (tasks, file, Outlook…). */
  extraMenuItems?: ReactNode;
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

  const showActionsMenu = !compact;

  return (
    <div>
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
        {showActionsMenu ? (
          <details className="relative">
            <summary
              className={`${SECONDARY_ACTION_CLASS} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
            >
              Actions
              <ChevronDown className="size-3.5 opacity-60" aria-hidden />
            </summary>
            <div
              role="menu"
              className="absolute left-0 z-30 mt-1 min-w-[13.5rem] border border-carbon-blue/15 bg-white py-1 shadow-lg"
            >
              {phone ? (
                <a href={telHref(phone)} role="menuitem" className={MENU_ITEM_CLASS}>
                  Call
                </a>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  disabled={disabled}
                  onClick={planCall}
                  className={MENU_ITEM_CLASS}
                  title="No phone on file — plan a call in Activities"
                >
                  Call
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                disabled={disabled}
                onClick={planMeeting}
                className={MENU_ITEM_CLASS}
              >
                Plan meeting
              </button>
              <a
                href={teamsMeetingComposeHref(title, meetingBody(subject, bodyPreview))}
                target="_blank"
                rel="noopener noreferrer"
                role="menuitem"
                className={MENU_ITEM_CLASS}
              >
                Create meeting
              </a>
              {extraMenuItems}
            </div>
          </details>
        ) : null}
      </div>
      {replyError ? <p className="mt-1 text-[11px] text-thermal-red">{replyError}</p> : null}
    </div>
  );
}
