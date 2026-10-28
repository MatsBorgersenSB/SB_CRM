"use client";

import { formatShortDate, formatTime } from "@/lib/regional-format-preference";
import { useEffect, useState } from "react";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import { readableMailText } from "@/lib/mail-preview-text";
import { classifyMailMessage } from "@/lib/mail-triage";
import {
  compareMailDates,
  newestMessageInList,
  type MailDateSortOrder,
} from "@/components/emails/mail-smart-filters";
import type { UserRole } from "@/types/auth";

export type CorrespondenceMessage = {
  id: string;
  sentAt: string;
  isOutbound: boolean;
  senderEmail: string;
  subject?: string;
  bodyPreview: string | null;
  webLink?: string | null;
};

function formatSentAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unknown";
  return `${formatShortDate(date)}, ${formatTime(date)}`;
}

function messageLabel(message: CorrespondenceMessage, contactName: string | null): string {
  if (message.isOutbound) return "Sent";
  // System mail is labelled for what it is — never attributed to the contact.
  if (message.subject !== undefined) {
    const kind = classifyMailMessage({
      subject: message.subject,
      senderEmail: message.senderEmail,
    });
    if (kind === "delivery_failure") return "Delivery notice";
    if (kind === "meeting_notice") return "Calendar response";
    if (kind === "automatic") return "Automatic message";
  }
  const name = contactName?.trim();
  return name ? `From ${name}` : `From ${message.senderEmail}`;
}

/**
 * One block per mail in the thread, oldest first.
 * Each block is that message only — not the signature or the quoted earlier mail.
 */
export function ThreadCorrespondencePreview({
  messages,
  contactName = null,
  role = "superuser",
  autoExpand = false,
  presentation = "default",
  dateSort = "desc",
}: {
  messages: CorrespondenceMessage[];
  contactName?: string | null;
  role?: UserRole;
  autoExpand?: boolean;
  /** reader = the thread is already open, so the mails stay visible. */
  presentation?: "default" | "reader";
  dateSort?: MailDateSortOrder;
}) {
  const ordered = [...messages].sort((a, b) =>
    compareMailDates(a.sentAt, b.sentAt, dateSort),
  );
  const latest = newestMessageInList(messages);
  const [expanded, setExpanded] = useState(presentation === "reader" || autoExpand);
  const [bodies, setBodies] = useState<Record<string, string>>({});
  const [outlookUrl, setOutlookUrl] = useState(latest?.webLink ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textFor = (message: CorrespondenceMessage) =>
    readableMailText(bodies[message.id] || message.bodyPreview);

  const loadMessage = async (message: CorrespondenceMessage) => {
    const response = await fetch(
      `/api/emails/${encodeURIComponent(message.id)}/view?enrich=1`,
      { headers: { [AUTH_ROLE_HEADER]: role }, cache: "no-store" },
    );
    const payload = (await response.json().catch(() => ({}))) as {
      bodyText?: string | null;
      bodyPreview?: string | null;
      webLink?: string | null;
      error?: string;
      detail?: string;
    };
    if (!response.ok) {
      throw new Error(payload.detail || payload.error || "Could not load preview");
    }
    const text = (payload.bodyText || payload.bodyPreview || "").trim();
    if (text) {
      setBodies((current) => ({ ...current, [message.id]: text }));
    }
    if (message.id === latest?.id && payload.webLink) setOutlookUrl(payload.webLink);
  };

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- begin async fetch when correspondence expands
    setLoading(true);
    setError(null);
    void Promise.allSettled(ordered.map((message) => loadMessage(message))).then((results) => {
      if (cancelled) return;
      const failure = results.find((result) => result.status === "rejected");
      const loaded = results.some((result) => result.status === "fulfilled");
      if (failure && !loaded && failure.status === "rejected") {
        const reason = failure.reason;
        setError(reason instanceof Error ? reason.message : "Could not load preview");
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // Load once when the correspondence is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, latest?.id, ordered.map((message) => message.id).join("|")]);

  if (!latest) return null;

  const latestText = textFor(latest);
  const short =
    latestText.length > 140 ? `${latestText.slice(0, 140)}…` : latestText;

  const openInOutlook = () => {
    const link = outlookUrl || latest.webLink;
    if (link) window.open(link, "_blank", "noopener,noreferrer");
    else setError("Outlook link is not available for this message yet.");
  };

  return (
    <div className="mt-1.5">
      {!expanded && ordered.length > 1 ? (
        <ol className="flex flex-col gap-0.5">
          {ordered.map((message) => (
            <li key={message.id} className="text-[12px] text-carbon-blue/70">
              <span className="font-semibold text-carbon-blue">
                {messageLabel(message, contactName)}
              </span>
              <span className="text-carbon-blue/50"> · {formatSentAt(message.sentAt)}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {!expanded && ordered.length === 1 && short ? (
        <p className="text-[12px] leading-relaxed text-carbon-blue/55">{short}</p>
      ) : null}

      {expanded ? (
        <ol className="mt-1 flex flex-col gap-3">
          {ordered.map((message) => {
            const text = textFor(message);
            return (
              <li
                key={message.id}
                className={`border-l-2 pl-3 ${
                  message.isOutbound ? "border-upcycle-orange/50" : "border-carbon-blue/25"
                }`}
              >
                <p className="text-[12px] font-semibold text-carbon-blue">
                  {messageLabel(message, contactName)}
                  <span className="font-normal text-carbon-blue/50">
                    {" "}
                    · {formatSentAt(message.sentAt)}
                  </span>
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed text-carbon-blue/80">
                  {text || (loading ? "Loading…" : "No message text.")}
                </p>
              </li>
            );
          })}
        </ol>
      ) : null}

      {error ? <p className="mt-1 text-[12px] text-red-700/80">{error}</p> : null}

      {/* In the reader the row already offers Open in Outlook. */}
      <div
        className={`mt-1.5 flex flex-wrap items-center gap-1.5 ${presentation === "reader" ? "hidden" : ""}`}
      >
        {presentation === "reader" ? null : (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex items-center border border-carbon-blue/15 bg-white px-2.5 py-1 text-[12px] font-semibold text-carbon-blue/75 transition-colors hover:border-upcycle-orange/40 hover:text-upcycle-orange"
          >
            {expanded
              ? ordered.length > 1
                ? "Hide correspondence"
                : "Hide preview"
              : ordered.length > 1
                ? "Show correspondence"
                : "Preview in SmartCRM"}
          </button>
        )}
        <button
          type="button"
          onClick={openInOutlook}
          className="inline-flex items-center border border-carbon-blue/15 bg-white px-2.5 py-1 text-[12px] font-semibold text-carbon-blue/75 transition-colors hover:border-upcycle-orange/40 hover:text-upcycle-orange"
        >
          Open in Outlook
        </button>
      </div>
    </div>
  );
}
