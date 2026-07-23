"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FilterTransparencyBar } from "@/components/ui/filter-transparency-bar";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import type { UserRole } from "@/types/auth";
import type { FilterSummaryChip } from "@/types/workspace-filters";
import type { SentimentGrade } from "@/generated/prisma";

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
  createdAt: string;
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

export function EmailIntelligence({
  opportunityId,
  role = "superuser",
}: {
  opportunityId: string;
  role?: UserRole;
}) {
  const [threads, setThreads] = useState<EmailThreadPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sentimentFilter, setSentimentFilter] = useState<"all" | SentimentGrade>("all");
  const [directionFilter, setDirectionFilter] = useState<"all" | "inbound" | "outbound">("all");

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
      setThreads(Array.isArray(payload.threads) ? payload.threads : []);
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
          return true;
        });
        return { ...thread, messages };
      })
      .filter((thread) => thread.messages.length > 0);
  }, [threads, sentimentFilter, directionFilter]);

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
    return chips;
  }, [sentimentFilter, directionFilter]);

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
                {/* SmartAssist Thread Summary */}
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
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </header>

                {/* Interaction thread timeline */}
                <section className="pt-3" aria-label="Email timeline">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-carbon-blue/40">
                    Interaction thread
                  </p>
                  <ol className="mt-3 flex flex-col gap-3">
                    {thread.messages.map((message) => (
                      <li
                        key={message.id}
                        className="border border-carbon-blue/10 bg-carbon-blue/[0.015] px-3 py-3"
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
                              <span className="border border-carbon-blue/12 bg-white px-1.5 py-0.5 text-[10px] font-medium text-carbon-blue/70">
                                From {shortAddress(message.senderEmail)}
                              </span>
                              {message.recipientEmails.map((recipient) => (
                                <span
                                  key={`${message.id}-${recipient}`}
                                  className="border border-carbon-blue/12 bg-white px-1.5 py-0.5 text-[10px] font-medium text-carbon-blue/55"
                                >
                                  To {shortAddress(recipient)}
                                </span>
                              ))}
                            </div>
                            <h5 className="mt-2 text-[13px] font-semibold text-carbon-blue">
                              {message.subject}
                            </h5>
                            <p className="mt-1 text-[12px] leading-relaxed text-carbon-blue/70">
                              {message.bodyPreview || "No preview available."}
                            </p>
                            <p className="mt-2 text-[11px] text-carbon-blue/45">
                              {formatSentAt(message.sentAt)}
                              {message.contactName
                                ? ` · Contact: ${message.contactName}`
                                : ""}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] ${sentimentBadgeClass(message.sentiment)}`}
                          >
                            {labelize(message.sentiment)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
