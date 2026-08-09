"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FilterTransparencyBar } from "@/components/ui/filter-transparency-bar";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import type { UserRole } from "@/types/auth";
import type { FilterSummaryChip } from "@/types/workspace-filters";
import type { SentimentGrade } from "@/generated/prisma";
import { project360Href } from "@/types/relationship-navigation";

type ContactEmailMessage = {
  id: string;
  conversationId: string;
  opportunityId: string | null;
  opportunityName: string | null;
  opportunityCode: string | null;
  projectId: string | null;
  projectName: string | null;
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

type LinkOption = {
  id: string;
  label: string;
  code?: string | null;
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
 * User sets opportunity and/or project relationship; no silent auto-link.
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
  const [opportunityOptions, setOpportunityOptions] = useState<LinkOption[]>([]);
  const [projectOptions, setProjectOptions] = useState<LinkOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [domainFilter, setDomainFilter] = useState<"all" | "external">("external");
  const [purgingId, setPurgingId] = useState<string | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

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
        opportunityOptions?: LinkOption[];
        projectOptions?: LinkOption[];
        error?: string;
        detail?: string;
      };
      if (!response.ok) {
        setThreads([]);
        setOpportunityOptions([]);
        setProjectOptions([]);
        throw new Error(payload.detail || payload.error || "Could not load emails");
      }
      setThreads(Array.isArray(payload.threads) ? payload.threads : []);
      setOpportunityOptions(
        Array.isArray(payload.opportunityOptions) ? payload.opportunityOptions : [],
      );
      setProjectOptions(
        Array.isArray(payload.projectOptions) ? payload.projectOptions : [],
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load emails");
      setThreads([]);
      setOpportunityOptions([]);
      setProjectOptions([]);
    } finally {
      setLoading(false);
    }
  }, [contactId, role]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyLinksToConversation = async (
    conversationId: string,
    links: { opportunityId?: string | null; projectId?: string | null },
  ): Promise<void> => {
    const response = await fetch(
      `/api/contacts/${encodeURIComponent(contactId)}/emails`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          [AUTH_ROLE_HEADER]: role,
        },
        body: JSON.stringify({ conversationId, ...links }),
      },
    );
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      detail?: string;
      opportunityName?: string | null;
      opportunityCode?: string | null;
      projectName?: string | null;
    };
    if (!response.ok) {
      throw new Error(payload.detail || payload.error || "Could not update link");
    }

    const oppOption =
      links.opportunityId !== undefined && links.opportunityId
        ? opportunityOptions.find((row) => row.id === links.opportunityId)
        : null;
    const projectOption =
      links.projectId !== undefined && links.projectId
        ? projectOptions.find((row) => row.id === links.projectId)
        : null;

    setThreads((current) =>
      current.map((thread) => {
        if (thread.conversationId !== conversationId) return thread;
        return {
          ...thread,
          messages: thread.messages.map((message) => ({
            ...message,
            ...(links.opportunityId !== undefined
              ? {
                  opportunityId: links.opportunityId,
                  opportunityName:
                    links.opportunityId == null
                      ? null
                      : (payload.opportunityName ?? oppOption?.name ?? null),
                  opportunityCode:
                    links.opportunityId == null
                      ? null
                      : (payload.opportunityCode ?? oppOption?.code ?? null),
                }
              : {}),
            ...(links.projectId !== undefined
              ? {
                  projectId: links.projectId,
                  projectName:
                    links.projectId == null
                      ? null
                      : (payload.projectName ?? projectOption?.name ?? null),
                }
              : {}),
          })),
        };
      }),
    );
  };

  const setThreadLinks = async (
    conversationId: string,
    links: { opportunityId?: string | null; projectId?: string | null },
  ) => {
    setLinkingId(conversationId);
    setError(null);
    setStatusMessage(null);
    try {
      await applyLinksToConversation(conversationId, links);
      setStatusMessage(
        links.opportunityId === null && links.projectId === undefined
          ? "Opportunity cleared — Not linked."
          : links.projectId === null && links.opportunityId === undefined
            ? "Project cleared — Not linked."
            : "Link updated.",
      );
    } catch (linkError) {
      setError(
        linkError instanceof Error ? linkError.message : "Could not update link",
      );
    } finally {
      setLinkingId(null);
    }
  };

  const applyBulkLinks = async (
    links: { opportunityId?: string | null; projectId?: string | null },
    successLabel: string,
  ) => {
    if (visibleThreads.length === 0) return;
    setBulkBusy(true);
    setError(null);
    setStatusMessage(null);
    try {
      for (const thread of visibleThreads) {
        await applyLinksToConversation(thread.conversationId, links);
      }
      setStatusMessage(successLabel);
    } catch (bulkError) {
      setError(
        bulkError instanceof Error
          ? bulkError.message
          : "Could not update all threads",
      );
      await load();
    } finally {
      setBulkBusy(false);
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
        Link each thread to the correct opportunity and/or project — or choose Not
        linked. Sync will not override your choice. Remove private or irrelevant mail
        from SmartCRM.
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

      {!loading && visibleThreads.length > 0 ? (
        <div className="mb-2 flex flex-wrap items-end gap-2 border border-carbon-blue/10 bg-white px-2 py-2">
          <p className="w-full text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Apply to all shown threads
          </p>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() =>
              void applyBulkLinks(
                { opportunityId: null },
                "Cleared opportunity on all shown threads (Not linked).",
              )
            }
            className="border border-carbon-blue/20 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/70 hover:border-upcycle-orange/50 hover:text-upcycle-orange disabled:opacity-50"
          >
            Clear opportunity
          </button>
          <label className="min-w-[12rem] flex-1">
            <span className="sr-only">Set project on all shown threads</span>
            <select
              disabled={bulkBusy || projectOptions.length === 0}
              defaultValue=""
              onChange={(event) => {
                const value = event.target.value;
                event.target.value = "";
                if (!value) return;
                if (value === "__clear__") {
                  void applyBulkLinks(
                    { projectId: null },
                    "Cleared project on all shown threads (Not linked).",
                  );
                  return;
                }
                const option = projectOptions.find((row) => row.id === value);
                void applyBulkLinks(
                  { projectId: value },
                  option
                    ? `Linked all shown threads to ${option.label}.`
                    : "Linked all shown threads to the selected project.",
                );
              }}
              className="w-full border border-carbon-blue/15 bg-white px-2 py-1 text-[11px] text-carbon-blue disabled:opacity-50"
            >
              <option value="">Set project…</option>
              <option value="__clear__">Not linked (clear project)</option>
              {projectOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {bulkBusy ? (
            <span className="text-[11px] text-carbon-blue/45">Updating…</span>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <p className="text-[12px] text-carbon-blue/45">Loading Outlook threads…</p>
      ) : null}

      {error ? <p className="text-[12px] text-red-700/80">{error}</p> : null}
      {statusMessage && !error ? (
        <p className="text-[12px] text-carbon-blue/70">{statusMessage}</p>
      ) : null}

      {!loading && !error && visibleThreads.length === 0 ? (
        <div className="space-y-1 text-[12px] leading-relaxed text-carbon-blue/55">
          <p>
            No synced Outlook mail for this person yet
            {contactEmail ? ` (${contactEmail})` : ""}.
          </p>
          <p>
            Connect Microsoft 365 and sync, then reopen this contact.
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
          const projectId = latest.projectId;
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

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="block min-w-0">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                    Opportunity
                  </span>
                  <select
                    value={dealId ?? ""}
                    disabled={busy || bulkBusy}
                    onChange={(event) => {
                      const value = event.target.value;
                      void setThreadLinks(thread.conversationId, {
                        opportunityId: value ? value : null,
                      });
                    }}
                    className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1 text-[11px] text-carbon-blue disabled:opacity-50"
                  >
                    <option value="">Not linked</option>
                    {dealId &&
                    !opportunityOptions.some((option) => option.id === dealId) ? (
                      <option value={dealId}>
                        {latest.opportunityCode
                          ? `${latest.opportunityCode} · ${latest.opportunityName ?? dealId}`
                          : (latest.opportunityName ?? dealId)}
                      </option>
                    ) : null}
                    {opportunityOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block min-w-0">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                    Project
                  </span>
                  <select
                    value={projectId ?? ""}
                    disabled={busy || bulkBusy}
                    onChange={(event) => {
                      const value = event.target.value;
                      void setThreadLinks(thread.conversationId, {
                        projectId: value ? value : null,
                      });
                    }}
                    className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1 text-[11px] text-carbon-blue disabled:opacity-50"
                  >
                    <option value="">Not linked</option>
                    {projectId &&
                    !projectOptions.some((option) => option.id === projectId) ? (
                      <option value={projectId}>
                        {latest.projectName ?? projectId}
                      </option>
                    ) : null}
                    {projectOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {dealId ? (
                  <Link
                    href={dealEmailsHref(dealId)}
                    className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/50 hover:text-upcycle-orange"
                  >
                    Open opportunity
                  </Link>
                ) : null}
                {projectId ? (
                  <Link
                    href={project360Href(projectId)}
                    className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/50 hover:text-upcycle-orange"
                  >
                    Open project
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
