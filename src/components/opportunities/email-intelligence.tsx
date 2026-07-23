"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FilterTransparencyBar } from "@/components/ui/filter-transparency-bar";
import { DraftInOutlookButton } from "@/components/opportunities/draft-in-outlook-button";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import type { UserRole } from "@/types/auth";
import type { FilterSummaryChip } from "@/types/workspace-filters";
import type { SentimentGrade } from "@/generated/prisma";

export type EmailAttachmentItem = {
  id: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
  source: string;
  hasContent: boolean;
  downloadUrl: string;
};

export type EmailIntelligenceItem = {
  id: string;
  externalMessageId: string;
  conversationId: string;
  opportunityId: string | null;
  contactId: string | null;
  contactName: string | null;
  subject: string;
  bodyPreview: string | null;
  senderEmail: string;
  recipientEmails: string[];
  sentAt: string;
  sentiment: SentimentGrade;
  isOutbound: boolean;
  senderIsInternal?: boolean;
  senderIsExternal?: boolean;
  isInternalOnly?: boolean;
  recipientDomains?: Array<{ email: string; isInternal: boolean; isExternal: boolean }>;
  m365CategoryName: string | null;
  isDeletedInSource: boolean;
  deletedAtInSource: string | null;
  createdAt: string;
  attachments: EmailAttachmentItem[];
};

export type EmailThreadPayload = {
  conversationId: string;
  summary: {
    conversationId: string;
    subject: string;
    messageCount: number;
    latestSentAt: string;
    takeaways: string[];
    riskAlerts: string[];
    sentimentMix: Record<SentimentGrade, number>;
  } | null;
  messages: EmailIntelligenceItem[];
};

function formatSentAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unknown";
  return date.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function labelize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function sentimentBadgeClass(sentiment: SentimentGrade): string {
  switch (sentiment) {
    case "positive":
      return "border-emerald-600/30 bg-emerald-50 text-emerald-700";
    case "cautious":
      return "border-amber-500/40 bg-amber-50 text-amber-800";
    case "negative":
      return "border-thermal-red/35 bg-thermal-red/[0.08] text-thermal-red";
    default:
      return "border-carbon-blue/15 bg-carbon-blue/[0.04] text-carbon-blue/60";
  }
}

function shortAddress(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local.replace(/\./g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatFileSize(bytes: number | null): string {
  if (bytes == null || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function replyDraftTarget(message: EmailIntelligenceItem): string {
  if (!message.isOutbound) return message.senderEmail;
  return message.recipientEmails[0] ?? message.senderEmail;
}

function replyDraftSubject(subject: string): string {
  return /^re:/i.test(subject.trim()) ? subject : `Re: ${subject}`;
}

function replyDraftHtml(message: EmailIntelligenceItem): string {
  const preview = message.bodyPreview
    ? `<blockquote style="border-left:3px solid #ccc;padding-left:8px;color:#555">${message.bodyPreview}</blockquote>`
    : "";
  return [
    `<p>Hi,</p>`,
    `<p>Thank you for your note. Following up on the points below and confirming next steps.</p>`,
    preview,
    `<p>Best regards</p>`,
  ].join("");
}

function threadFollowUpHtml(summary: {
  subject: string;
  takeaways: string[];
  riskAlerts: string[];
}): string {
  const takeaways = summary.takeaways.map((item) => `<li>${item}</li>`).join("");
  const risks = summary.riskAlerts.map((item) => `<li>${item}</li>`).join("");
  return [
    `<p>Hi,</p>`,
    `<p>Following up on our thread regarding <strong>${summary.subject}</strong>.</p>`,
    takeaways
      ? `<p>Key takeaways:</p><ul>${takeaways}</ul>`
      : "",
    risks ? `<p>Open items / risks to close:</p><ul>${risks}</ul>` : "",
    `<p>Could you confirm status and preferred next step?</p>`,
    `<p>Thanks</p>`,
  ].join("");
}

export function EmailIntelligence({
  opportunityId,
  role = "superuser",
  readOnly = false,
}: {
  opportunityId: string;
  role?: UserRole;
  readOnly?: boolean;
}) {
  const [threads, setThreads] = useState<EmailThreadPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purgingId, setPurgingId] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<EmailAttachmentItem | null>(
    null,
  );
  const [sentimentFilter, setSentimentFilter] = useState<"all" | SentimentGrade>("all");
  const [directionFilter, setDirectionFilter] = useState<"all" | "inbound" | "outbound">("all");
  const [deletedFilter, setDeletedFilter] = useState<"all" | "active" | "deleted">("all");
  const [domainFilter, setDomainFilter] = useState<"all" | "external" | "internal_only">(
    "all",
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/opportunities/${encodeURIComponent(opportunityId)}/emails`,
        {
          headers: { [AUTH_ROLE_HEADER]: role },
          cache: "no-store",
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        threads?: EmailThreadPayload[];
        emails?: EmailIntelligenceItem[];
        error?: string;
        detail?: string;
      };
      if (!response.ok) {
        setThreads([]);
        throw new Error(payload.detail || payload.error || "Could not load emails");
      }
      setThreads(
        Array.isArray(payload.threads)
          ? payload.threads.map((thread) => ({
              ...thread,
              messages: thread.messages.map((message) => ({
                ...message,
                attachments: message.attachments ?? [],
              })),
            }))
          : [],
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load emails");
    } finally {
      setLoading(false);
    }
  }, [opportunityId, role]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalMessages = useMemo(
    () => threads.reduce((sum, thread) => sum + thread.messages.length, 0),
    [threads],
  );

  const filteredThreads = useMemo(() => {
    return threads
      .map((thread) => {
        const messages = thread.messages.filter((message) => {
          if (sentimentFilter !== "all" && message.sentiment !== sentimentFilter) return false;
          if (directionFilter === "inbound" && message.isOutbound) return false;
          if (directionFilter === "outbound" && !message.isOutbound) return false;
          if (deletedFilter === "active" && message.isDeletedInSource) return false;
          if (deletedFilter === "deleted" && !message.isDeletedInSource) return false;
          const internalOnly = Boolean(message.isInternalOnly);
          if (domainFilter === "external" && internalOnly) return false;
          if (domainFilter === "internal_only" && !internalOnly) return false;
          return true;
        });
        return { ...thread, messages };
      })
      .filter((thread) => thread.messages.length > 0);
  }, [threads, sentimentFilter, directionFilter, deletedFilter, domainFilter]);

  const filteredCount = useMemo(
    () => filteredThreads.reduce((sum, thread) => sum + thread.messages.length, 0),
    [filteredThreads],
  );

  const activeFilters = useMemo((): FilterSummaryChip[] => {
    const chips: FilterSummaryChip[] = [];
    if (sentimentFilter !== "all") {
      chips.push({
        id: "sentiment",
        label: "Sentiment",
        value: labelize(sentimentFilter),
        onRemove: () => setSentimentFilter("all"),
      });
    }
    if (directionFilter !== "all") {
      chips.push({
        id: "direction",
        label: "Direction",
        value: labelize(directionFilter),
        onRemove: () => setDirectionFilter("all"),
      });
    }
    if (deletedFilter !== "all") {
      chips.push({
        id: "deleted",
        label: "Source",
        value: deletedFilter === "deleted" ? "Deleted in Outlook" : "Active in Outlook",
        onRemove: () => setDeletedFilter("all"),
      });
    }
    if (domainFilter !== "all") {
      chips.push({
        id: "domain",
        label: "Domain",
        value:
          domainFilter === "external"
            ? "Has external parties"
            : "Internal-only",
        onRemove: () => setDomainFilter("all"),
      });
    }
    return chips;
  }, [sentimentFilter, directionFilter, deletedFilter, domainFilter]);

  const purgeEmail = async (emailId: string) => {
    if (readOnly) return;
    const confirmed = window.confirm(
      "Purge this email from SmartCRM permanently? This does not change Outlook.",
    );
    if (!confirmed) return;

    setPurgingId(emailId);
    setError(null);
    try {
      const response = await fetch(
        `/api/opportunities/${encodeURIComponent(opportunityId)}/emails`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            [AUTH_ROLE_HEADER]: role,
          },
          body: JSON.stringify({ emailId, action: "purge" }),
        },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        throw new Error(payload.detail || payload.error || "Could not purge email");
      }
      setThreads((current) =>
        current
          .map((thread) => ({
            ...thread,
            messages: thread.messages.filter((message) => message.id !== emailId),
          }))
          .filter((thread) => thread.messages.length > 0),
      );
    } catch (purgeError) {
      setError(purgeError instanceof Error ? purgeError.message : "Purge failed");
    } finally {
      setPurgingId(null);
    }
  };

  return (
    <section aria-label="Email intelligence" className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] font-medium text-carbon-blue/45">
          FS-009 Email & Interaction Intelligence
        </p>
        <h3 className="mt-1 text-base font-semibold text-carbon-blue">
          Email threads & sentiment
        </h3>
        <p className="mt-1 text-[13px] text-carbon-blue/55">
          Review M365-linked conversation threads, sentiment evidence, and commercial
          takeaways. Sentiment is advisory — it does not change influence stance automatically.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 border border-carbon-blue/10 bg-white px-3 py-3">
        <label className="flex min-w-[10rem] flex-col gap-1 text-[11px] font-semibold text-carbon-blue/55">
          Sentiment
          <select
            value={sentimentFilter}
            onChange={(event) =>
              setSentimentFilter(event.target.value as "all" | SentimentGrade)
            }
            className="border border-carbon-blue/15 bg-white px-2 py-1.5 text-[12px] font-medium text-carbon-blue"
          >
            <option value="all">All sentiments</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="cautious">Cautious</option>
            <option value="negative">Negative</option>
          </select>
        </label>
        <label className="flex min-w-[10rem] flex-col gap-1 text-[11px] font-semibold text-carbon-blue/55">
          Direction
          <select
            value={directionFilter}
            onChange={(event) =>
              setDirectionFilter(event.target.value as "all" | "inbound" | "outbound")
            }
            className="border border-carbon-blue/15 bg-white px-2 py-1.5 text-[12px] font-medium text-carbon-blue"
          >
            <option value="all">Inbound + outbound</option>
            <option value="inbound">Inbound only</option>
            <option value="outbound">Outbound only</option>
          </select>
        </label>
        <label className="flex min-w-[10rem] flex-col gap-1 text-[11px] font-semibold text-carbon-blue/55">
          Outlook source
          <select
            value={deletedFilter}
            onChange={(event) =>
              setDeletedFilter(event.target.value as "all" | "active" | "deleted")
            }
            className="border border-carbon-blue/15 bg-white px-2 py-1.5 text-[12px] font-medium text-carbon-blue"
          >
            <option value="all">All (incl. deleted)</option>
            <option value="active">Active in Outlook</option>
            <option value="deleted">Deleted in Outlook</option>
          </select>
        </label>
        <label className="flex min-w-[10rem] flex-col gap-1 text-[11px] font-semibold text-carbon-blue/55">
          Domains
          <select
            value={domainFilter}
            onChange={(event) =>
              setDomainFilter(event.target.value as "all" | "external" | "internal_only")
            }
            className="border border-carbon-blue/15 bg-white px-2 py-1.5 text-[12px] font-medium text-carbon-blue"
          >
            <option value="all">All domains</option>
            <option value="external">Has external parties</option>
            <option value="internal_only">Internal-only</option>
          </select>
        </label>
      </div>

      <FilterTransparencyBar
        entityLabel="Emails"
        filteredCount={filteredCount}
        totalCount={totalMessages}
        activeFilters={activeFilters}
        onClearAll={
          activeFilters.length >= 2
            ? () => {
                setSentimentFilter("all");
                setDirectionFilter("all");
                setDeletedFilter("all");
                setDomainFilter("all");
              }
            : undefined
        }
      />

      {error ? (
        <p className="border border-thermal-red/25 bg-thermal-red/[0.06] px-3 py-2 text-[12px] text-thermal-red">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-[13px] text-carbon-blue/45">Loading emails…</p>
      ) : totalMessages === 0 ? (
        <p className="border border-carbon-blue/10 bg-white px-4 py-6 text-[13px] text-carbon-blue/55">
          No emails linked to this opportunity yet.
        </p>
      ) : filteredThreads.length === 0 ? (
        <p className="border border-carbon-blue/10 bg-white px-4 py-6 text-[13px] text-carbon-blue/55">
          No emails match the active filters.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {filteredThreads.map((thread) => {
            const summary = thread.summary;
            return (
              <article
                key={thread.conversationId}
                className="border border-carbon-blue/12 bg-white px-4 py-4"
              >
                <header className="border-b border-carbon-blue/8 pb-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-carbon-blue/40">
                    SmartAssist thread summary
                  </p>
                  <h4 className="mt-1 text-[15px] font-semibold text-carbon-blue">
                    {summary?.subject ?? thread.messages[0]?.subject ?? "Conversation"}
                  </h4>
                  <p className="mt-1 text-[12px] text-carbon-blue/55">
                    {summary?.messageCount ?? thread.messages.length} messages · Latest{" "}
                    {formatSentAt(
                      summary?.latestSentAt ??
                        thread.messages[thread.messages.length - 1]?.sentAt ??
                        "",
                    )}
                  </p>

                  {summary ? (
                    <div className="mt-3 border border-upcycle-orange/20 bg-upcycle-orange/[0.04] px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-upcycle-orange">
                        Key commercial takeaways
                      </p>
                      <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[13px] leading-relaxed text-carbon-blue">
                        {summary.takeaways.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>

                      {summary.riskAlerts.length > 0 ? (
                        <div className="mt-3 border-t border-amber-500/20 pt-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700">
                            Disengagement / risk alerts
                          </p>
                          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[13px] leading-relaxed text-amber-900">
                            {summary.riskAlerts.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                          {!readOnly ? (
                            <div className="mt-3">
                              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-carbon-blue/45">
                                Confirmed action — outbound execution
                              </p>
                              <DraftInOutlookButton
                                toEmail={
                                  [...thread.messages]
                                    .reverse()
                                    .find((m) => !m.isOutbound)?.senderEmail ??
                                  thread.messages[0]?.senderEmail ??
                                  ""
                                }
                                subject={`Follow-up: ${summary.subject}`}
                                bodyHtml={threadFollowUpHtml(summary)}
                                opportunityId={opportunityId}
                                role={role}
                              />
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </header>

                <section className="pt-3" aria-label="Email timeline">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-carbon-blue/40">
                    Interaction thread
                  </p>
                  <ol className="mt-3 flex flex-col gap-3">
                    {thread.messages.map((message) => {
                      const busy = purgingId === message.id;
                      return (
                        <li
                          key={message.id}
                          className={`border px-3 py-3 ${
                            message.isDeletedInSource
                              ? "border-carbon-blue/15 bg-carbon-blue/[0.03] opacity-90"
                              : "border-carbon-blue/10 bg-carbon-blue/[0.015]"
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] ${
                                    message.isOutbound
                                      ? "border-upcycle-orange/30 bg-upcycle-orange/[0.08] text-upcycle-orange"
                                      : "border-carbon-blue/20 bg-white text-carbon-blue/70"
                                  }`}
                                >
                                  {message.isOutbound ? "Outbound" : "Inbound"}
                                </span>
                                {message.isDeletedInSource ? (
                                  <span
                                    className="border border-carbon-blue/25 bg-white px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.04em] text-carbon-blue/65"
                                    title={
                                      message.deletedAtInSource
                                        ? `Deleted in Outlook at ${formatSentAt(message.deletedAtInSource)}`
                                        : "Deleted in Outlook"
                                    }
                                  >
                                    [Deleted in Outlook]
                                  </span>
                                ) : null}
                                {message.m365CategoryName ? (
                                  <span className="border border-carbon-blue/12 bg-white px-1.5 py-0.5 text-[10px] font-medium text-carbon-blue/55">
                                    {message.m365CategoryName}
                                  </span>
                                ) : null}
                                {(message.senderIsExternal ?? false) ? (
                                  <span className="border border-amber-500/30 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-amber-800">
                                    External sender
                                  </span>
                                ) : (
                                  <span className="border border-carbon-blue/15 bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-carbon-blue/50">
                                    Internal sender
                                  </span>
                                )}
                                {message.isInternalOnly ? (
                                  <span className="border border-carbon-blue/12 bg-carbon-blue/[0.03] px-1.5 py-0.5 text-[10px] font-medium text-carbon-blue/45">
                                    Internal-only thread
                                  </span>
                                ) : null}
                                <span className="border border-carbon-blue/12 bg-white px-1.5 py-0.5 text-[10px] font-medium text-carbon-blue/70">
                                  From {shortAddress(message.senderEmail)}
                                  {message.senderIsInternal ? " (internal)" : " (external)"}
                                </span>
                                {(message.recipientDomains ?? message.recipientEmails.map((email) => ({
                                  email,
                                  isInternal: false,
                                  isExternal: true,
                                }))).map((recipient) => (
                                  <span
                                    key={`${message.id}-${recipient.email}`}
                                    className="border border-carbon-blue/12 bg-white px-1.5 py-0.5 text-[10px] font-medium text-carbon-blue/55"
                                  >
                                    To {shortAddress(recipient.email)}
                                    {recipient.isInternal ? " (internal)" : " (external)"}
                                  </span>
                                ))}
                              </div>
                              <h5 className="mt-2 text-[13px] font-semibold text-carbon-blue">
                                {message.subject}
                              </h5>
                              <p className="mt-1 text-[12px] leading-relaxed text-carbon-blue/70">
                                {message.bodyPreview || "No preview available."}
                              </p>
                              {message.attachments?.length ? (
                                <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Attachments">
                                  {message.attachments.map((attachment) => (
                                    <li key={attachment.id}>
                                      <button
                                        type="button"
                                        onClick={() => setPreviewAttachment(attachment)}
                                        className="inline-flex max-w-full items-center gap-1 border border-carbon-blue/15 bg-white px-2 py-1 text-left text-[11px] font-medium text-carbon-blue hover:border-upcycle-orange/40 hover:text-upcycle-orange"
                                        title={
                                          attachment.hasContent
                                            ? "Open preview / download"
                                            : "Metadata only — content not stored"
                                        }
                                      >
                                        <span aria-hidden>📎</span>
                                        <span className="truncate">
                                          {attachment.name} [{formatFileSize(attachment.sizeBytes)}]
                                        </span>
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                              <p className="mt-2 text-[11px] text-carbon-blue/45">
                                {formatSentAt(message.sentAt)}
                                {message.contactName
                                  ? ` · Contact: ${message.contactName}`
                                  : ""}
                              </p>
                              {!readOnly ? (
                                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                  {(message.sentiment === "cautious" ||
                                    message.sentiment === "negative" ||
                                    !message.isOutbound) &&
                                  !message.isDeletedInSource ? (
                                    <DraftInOutlookButton
                                      toEmail={replyDraftTarget(message)}
                                      subject={replyDraftSubject(message.subject)}
                                      bodyHtml={replyDraftHtml(message)}
                                      opportunityId={opportunityId}
                                      role={role}
                                      disabled={busy}
                                    />
                                  ) : null}
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void purgeEmail(message.id)}
                                    className="border border-carbon-blue/20 bg-white px-2.5 py-1 text-[11px] font-semibold text-carbon-blue/70 hover:border-thermal-red/40 hover:text-thermal-red disabled:opacity-50"
                                  >
                                    {busy ? "Purging…" : "Purge from SmartCRM"}
                                  </button>
                                </div>
                              ) : null}
                            </div>
                            <span
                              className={`shrink-0 border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] ${sentimentBadgeClass(message.sentiment)}`}
                            >
                              {labelize(message.sentiment)}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              </article>
            );
          })}
        </div>
      )}

      {previewAttachment ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-carbon-blue/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Attachment preview"
          onClick={() => setPreviewAttachment(null)}
        >
          <div
            className="w-full max-w-3xl border border-carbon-blue/15 bg-white shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-carbon-blue/10 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-carbon-blue/40">
                  SmartDocs attachment
                </p>
                <h4 className="mt-1 truncate text-[15px] font-semibold text-carbon-blue">
                  {previewAttachment.name}
                </h4>
                <p className="mt-0.5 text-[12px] text-carbon-blue/55">
                  {previewAttachment.mimeType || "Unknown type"} ·{" "}
                  {formatFileSize(previewAttachment.sizeBytes)} · {previewAttachment.source}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewAttachment(null)}
                className="shrink-0 border border-carbon-blue/15 px-2 py-1 text-[11px] font-semibold text-carbon-blue/70"
              >
                Close
              </button>
            </div>
            <div className="px-4 py-3">
              {previewAttachment.hasContent &&
              (previewAttachment.mimeType?.startsWith("image/") ||
                previewAttachment.mimeType === "application/pdf") ? (
                <iframe
                  title={previewAttachment.name}
                  src={previewAttachment.downloadUrl}
                  className="h-[28rem] w-full border border-carbon-blue/10 bg-carbon-blue/[0.02]"
                />
              ) : (
                <p className="border border-carbon-blue/10 bg-carbon-blue/[0.02] px-3 py-6 text-[13px] text-carbon-blue/60">
                  {previewAttachment.hasContent
                    ? "Inline preview is not available for this file type. Download to open locally."
                    : "Only metadata is stored for this attachment. Re-sync from Outlook to fetch file bytes."}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {previewAttachment.hasContent ? (
                  <a
                    href={previewAttachment.downloadUrl}
                    download={previewAttachment.name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-[11px] font-semibold text-white"
                  >
                    Download
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  className="border border-carbon-blue/20 bg-white px-3 py-1.5 text-[11px] font-semibold text-carbon-blue/70"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
