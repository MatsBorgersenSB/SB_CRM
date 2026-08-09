"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FilterTransparencyBar } from "@/components/ui/filter-transparency-bar";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import type { UserRole } from "@/types/auth";
import type { FilterSummaryChip } from "@/types/workspace-filters";
import type { SentimentGrade } from "@/generated/prisma";

type ContactEmailMessage = {
  id: string;
  conversationId: string;
  opportunityId: string | null;
  opportunityName: string | null;
  opportunityCode: string | null;
  subject: string;
  bodyPreview: string | null;
  senderEmail: string;
  sentAt: string;
  sentiment: SentimentGrade;
  isOutbound: boolean;
  isInternalOnly?: boolean;
  isDeletedInSource: boolean;
};

type ContactEmailThread = {
  conversationId: string;
  summary: {
    subject: string;
    messageCount: number;
    latestSentAt: string;
    riskAlerts: string[];
  } | null;
  messages: ContactEmailMessage[];
};

type OpportunityOption = {
  id: string;
  label: string;
  code: string | null;
  name: string;
};

function formatSentAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unknown";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dealEmailsHref(dealId: string): string {
  return `/deals/${encodeURIComponent(dealId)}?view=emails`;
}

/**
 * Compact person-lens Outlook threads for Contact 360.
 * Full deal Email Intelligence lives on the opportunity.
 */
export function ContactRecentOutlook({
  contactId,
  contactEmail,
  role = "superuser",
}: {
  contactId: string;
  contactEmail?: string;
  role?: UserRole;
}) {
  const [threads, setThreads] = useState<ContactEmailThread[]>([]);
  const [opportunityOptions, setOpportunityOptions] = useState<OpportunityOption[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [domainFilter, setDomainFilter] = useState<"all" | "external">("external");
  const [purgingId, setPurgingId] = useState<string | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/contacts/${encodeURIComponent(contactId)}/emails`,
        {
          headers: { [AUTH_ROLE_HEADER]: role },
          cache: "no-store",
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        threads?: ContactEmailThread[];
        opportunityOptions?: OpportunityOption[];
        error?: string;
        detail?: string;
      };
      if (!response.ok) {
        setThreads([]);
        setOpportunityOptions([]);
        throw new Error(payload.detail || payload.error || "Could not load emails");
      }
      setThreads(Array.isArray(payload.threads) ? payload.threads : []);
      setOpportunityOptions(
        Array.isArray(payload.opportunityOptions) ? payload.opportunityOptions : [],
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load emails");
      setThreads([]);
      setOpportunityOptions([]);
    } finally {
      setLoading(false);
    }
  }, [contactId, role]);

  useEffect(() => {
    void load();
  }, [load]);

  const setThreadOpportunity = async (
    conversationId: string,
    opportunityId: string | null,
  ) => {
    setLinkingId(conversationId);
    setError(null);
    try {
      const response = await fetch(
        `/api/contacts/${encodeURIComponent(contactId)}/emails`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            [AUTH_ROLE_HEADER]: role,
          },
          body: JSON.stringify({ conversationId, opportunityId }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
        opportunityName?: string | null;
        opportunityCode?: string | null;
      };
      if (!response.ok) {
        throw new Error(payload.detail || payload.error || "Could not update link");
      }

      const option = opportunityId
        ? opportunityOptions.find((row) => row.id === opportunityId)
        : null;

      setThreads((current) =>
        current.map((thread) => {
          if (thread.conversationId !== conversationId) return thread;
          return {
            ...thread,
            messages: thread.messages.map((message) => ({
              ...message,
              opportunityId,
              opportunityName:
                payload.opportunityName ?? option?.name ?? null,
              opportunityCode:
                payload.opportunityCode ?? option?.code ?? null,
            })),
          };
        }),
      );
    } catch (linkError) {
      setError(
        linkError instanceof Error ? linkError.message : "Could not update link",
      );
    } finally {
      setLinkingId(null);
    }
  };

  const removeThread = async (conversationId: string) => {
    const confirmed = window.confirm(
      "Remove this conversation from SmartCRM? Use this for private or irrelevant mail. Outlook is not changed, and it will not come back on the next sync.",
    );
    if (!confirmed) return;

    setPurgingId(conversationId);
    setError(null);
    try {
      const response = await fetch(
        `/api/contacts/${encodeURIComponent(contactId)}/emails`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            [AUTH_ROLE_HEADER]: role,
          },
          body: JSON.stringify({ conversationId, action: "purge" }),
        },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        throw new Error(payload.detail || payload.error || "Could not remove mail");
      }
      setThreads((current) =>
        current.filter((thread) => thread.conversationId !== conversationId),
      );
    } catch (purgeError) {
      setError(
        purgeError instanceof Error ? purgeError.message : "Could not remove mail",
      );
    } finally {
      setPurgingId(null);
    }
  };

  const visibleThreads = useMemo(() => {
    return threads
      .filter((thread) => {
        if (domainFilter !== "external") return true;
        return thread.messages.some((message) => !message.isInternalOnly);
      })
      .slice(0, 8);
  }, [threads, domainFilter]);

  const filterChips = useMemo((): FilterSummaryChip[] => {
    if (domainFilter === "all") return [];
    return [
      {
        id: "domain",
        label: "Domain",
        value: "External",
        onRemove: () => setDomainFilter("all"),
      },
    ];
  }, [domainFilter]);

  return (
    <div className="border-t border-carbon-blue/10 pt-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          Recent Outlook
        </p>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor={`contact-mail-domain-${contactId}`}>
            Domain filter
          </label>
          <select
            id={`contact-mail-domain-${contactId}`}
            value={domainFilter}
            onChange={(event) =>
              setDomainFilter(event.target.value as "all" | "external")
            }
            className="border border-carbon-blue/15 bg-white px-2 py-1 text-[10px] text-carbon-blue"
          >
            <option value="external">External (default)</option>
            <option value="all">All domains</option>
          </select>
          <button
            type="button"
            onClick={() => void load()}
            className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45 hover:text-upcycle-orange"
          >
            Refresh
          </button>
        </div>
      </div>

      <p className="mb-2 text-[11px] leading-relaxed text-carbon-blue/50">
        Mail is not auto-linked to opportunities. Link the correct deal below, or remove
        private / irrelevant threads from SmartCRM.
      </p>

      {!loading && threads.length > 0 ? (
        <FilterTransparencyBar
          entityLabel="threads"
          filteredCount={visibleThreads.length}
          totalCount={threads.length}
          activeFilters={filterChips}
          onClearAll={() => setDomainFilter("external")}
          className="mb-2 border border-carbon-blue/10 px-2 py-1.5 sm:px-2"
        />
      ) : null}

      {loading ? (
        <p className="text-[12px] text-carbon-blue/45">Loading Outlook threads…</p>
      ) : null}

      {error ? <p className="text-[12px] text-red-700/80">{error}</p> : null}

      {!loading && !error && visibleThreads.length === 0 ? (
        <div className="space-y-1 text-[12px] leading-relaxed text-carbon-blue/55">
          <p>
            No synced Outlook mail for this person yet
            {contactEmail ? ` (${contactEmail})` : ""}.
          </p>
          <p>
            Connect Microsoft 365 and sync on{" "}
            <Link
              href="/m365-preview"
              className="font-semibold text-upcycle-orange underline-offset-2 hover:underline"
            >
              /m365-preview
            </Link>
            , then reopen this contact.
          </p>
        </div>
      ) : null}

      <ul className="mt-2 flex flex-col gap-2">
        {visibleThreads.map((thread) => {
          const latest = thread.messages[thread.messages.length - 1]!;
          const subject =
            thread.summary?.subject ||
            latest.subject.replace(/^Re:\s*/i, "").trim() ||
            latest.subject;
          const risk = thread.summary?.riskAlerts?.[0];
          const dealId = latest.opportunityId;
          const busy =
            purgingId === thread.conversationId ||
            linkingId === thread.conversationId;

          return (
            <li
              key={thread.conversationId}
              className="border border-carbon-blue/10 bg-carbon-blue/[0.02] px-3 py-2"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[13px] font-semibold text-carbon-blue">
                  {latest.isDeletedInSource ? (
                    <span className="mr-1 text-carbon-blue/40">[Deleted in Outlook]</span>
                  ) : null}
                  {subject}
                </p>
                <p className="text-[10px] text-carbon-blue/45">
                  {formatSentAt(thread.summary?.latestSentAt ?? latest.sentAt)}
                </p>
              </div>
              <p className="mt-0.5 text-[11px] text-carbon-blue/50">
                {latest.isOutbound ? "Outbound" : "Inbound"} ·{" "}
                {thread.summary?.messageCount ?? thread.messages.length} message
                {(thread.summary?.messageCount ?? thread.messages.length) === 1
                  ? ""
                  : "s"}
                {latest.bodyPreview
                  ? ` · ${latest.bodyPreview.slice(0, 120)}${
                      latest.bodyPreview.length > 120 ? "…" : ""
                    }`
                  : ""}
              </p>
              {risk ? (
                <p className="mt-1 text-[11px] text-amber-800/90">Attention: {risk}</p>
              ) : null}

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor={`link-${thread.conversationId}`}>
                  Link to opportunity
                </label>
                <select
                  id={`link-${thread.conversationId}`}
                  value={dealId ?? ""}
                  disabled={busy}
                  onChange={(event) => {
                    const value = event.target.value;
                    void setThreadOpportunity(
                      thread.conversationId,
                      value ? value : null,
                    );
                  }}
                  className="min-w-[12rem] flex-1 border border-carbon-blue/15 bg-white px-2 py-1 text-[11px] text-carbon-blue disabled:opacity-50"
                >
                  <option value="">Not linked to an opportunity</option>
                  {opportunityOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {dealId ? (
                  <Link
                    href={dealEmailsHref(dealId)}
                    className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/50 hover:text-upcycle-orange"
                  >
                    Open
                  </Link>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void removeThread(thread.conversationId)}
                  className="border border-carbon-blue/20 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/65 hover:border-thermal-red/40 hover:text-thermal-red disabled:opacity-50"
                >
                  {purgingId === thread.conversationId
                    ? "Removing…"
                    : "Remove from SmartCRM"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
