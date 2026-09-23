"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FilterTransparencyBar } from "@/components/ui/filter-transparency-bar";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import type { UserRole } from "@/types/auth";
import type { FilterSummaryChip } from "@/types/workspace-filters";
import type { SentimentGrade } from "@/generated/prisma";
import { SyncedMailPreview } from "@/components/emails/synced-mail-preview";
import { EmailMessageActions } from "@/components/emails/email-message-actions";
import { projectEmailsHref } from "@/types/relationship-navigation";

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
  webLink?: string | null;
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

const RELATIONSHIP_HINTS = [
  "reconnect",
  "reconnecting",
  "linkedin",
  "great to have you",
  "catching up",
  "how are you",
  "nice to meet",
  "good to see you",
  "welcome back",
  "coffee",
];

const COMMERCIAL_HINTS = [
  "opportunit",
  "quotation",
  "quote",
  "tilbud",
  "proposal",
  "invoice",
  "permit",
  "tillatelse",
  "contract",
  "nda",
  "feedstock",
  "pyrolysis",
  "digestate",
  "biochar",
  "arcipug",
  "arcipplug",
  "datasheet",
  "specification",
  "purchase order",
  "budget",
  "offer",
];

const SUGGEST_STOP_WORDS = new Set([
  "with",
  "from",
  "this",
  "that",
  "project",
  "opportunity",
  "standard",
  "standar",
  "and",
  "the",
  "for",
  "mail",
  "email",
]);

function formatCompactDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "date unknown";
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function latestMessage(thread: ContactEmailThread): ContactEmailMessage | null {
  return thread.messages[thread.messages.length - 1] ?? null;
}

function threadSubject(thread: ContactEmailThread): string {
  const latest = latestMessage(thread);
  if (!latest) return "Untitled conversation";
  return (
    thread.summary?.subject ||
    latest.subject.replace(/^Re:\s*/i, "").trim() ||
    latest.subject
  );
}

function threadStamp(thread: ContactEmailThread): string | null {
  const latest = latestMessage(thread);
  return thread.summary?.latestSentAt ?? latest?.sentAt ?? null;
}

function snippetText(preview: string | null, max = 110): string {
  const text = (preview ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function mailLooksCommercial(subject: string, preview: string | null): boolean {
  const hay = `${subject} ${preview ?? ""}`.toLowerCase();
  if (COMMERCIAL_HINTS.some((hint) => hay.includes(hint))) return true;
  if (RELATIONSHIP_HINTS.some((hint) => hay.includes(hint))) return false;
  return false;
}

function isThreadLinked(latest: ContactEmailMessage): boolean {
  return Boolean(latest.opportunityId || latest.projectId);
}

/** Reality First: only suggest a deal whose distinctive name appears in the subject. */
function suggestWorkLink(subject: string, options: LinkOption[]): LinkOption | null {
  if (options.length === 0) return null;
  const hay = subject.toLowerCase();
  let best: { option: LinkOption; hits: number; longest: number } | null = null;
  for (const option of options) {
    const tokens = option.label
      .toLowerCase()
      .split(/[^a-z0-9æøå]+/i)
      .filter((token) => token.length >= 4 && !SUGGEST_STOP_WORDS.has(token));
    const hits = tokens.filter((token) => hay.includes(token));
    if (hits.length === 0) continue;
    const longest = Math.max(...hits.map((hit) => hit.length));
    if (
      !best ||
      hits.length > best.hits ||
      (hits.length === best.hits && longest > best.longest)
    ) {
      best = { option, hits: hits.length, longest };
    }
  }
  return best && best.longest >= 5 ? best.option : null;
}

function dealEmailsHref(dealId: string): string {
  return `/opportunities/${encodeURIComponent(dealId)}?view=emails`;
}

export type ContactMailWorkLink = {
  id: string;
  name: string;
};

/**
 * Person-lens Outlook conversations for Contact 360.
 * Lead with last talk and Reply; filing is progressive, never a tagging console.
 */
export function ContactRecentOutlook({
  contactId,
  contactEmail,
  contactName,
  contactPhone,
  role = "superuser",
  onLatestMailAt,
  onLinkedWork,
}: {
  contactId: string;
  contactEmail?: string;
  contactName?: string;
  contactPhone?: string;
  role?: UserRole;
  onLatestMailAt?: (iso: string | null) => void;
  onLinkedWork?: (links: {
    opportunities: ContactMailWorkLink[];
    projects: ContactMailWorkLink[];
  }) => void;
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const onLatestMailAtRef = useRef(onLatestMailAt);
  onLatestMailAtRef.current = onLatestMailAt;
  const onLinkedWorkRef = useRef(onLinkedWork);
  onLinkedWorkRef.current = onLinkedWork;

  useEffect(() => {
    const stamps = threads.flatMap((thread) =>
      thread.messages
        .map((message) => message.sentAt)
        .concat(thread.summary?.latestSentAt ? [thread.summary.latestSentAt] : []),
    );
    let latest: string | null = null;
    for (const stamp of stamps) {
      if (!latest || Date.parse(stamp) > Date.parse(latest)) latest = stamp;
    }
    onLatestMailAtRef.current?.(latest);

    const opportunities = new Map<string, string>();
    const projects = new Map<string, string>();
    for (const thread of threads) {
      for (const message of thread.messages) {
        if (message.opportunityId) {
          opportunities.set(
            message.opportunityId,
            message.opportunityName || message.opportunityCode || message.opportunityId,
          );
        }
        if (message.projectId) {
          projects.set(message.projectId, message.projectName || message.projectId);
        }
      }
    }
    onLinkedWorkRef.current?.({
      opportunities: [...opportunities.entries()].map(([id, name]) => ({ id, name })),
      projects: [...projects.entries()].map(([id, name]) => ({ id, name })),
    });
  }, [threads]);

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
          ? "Opportunity cleared."
          : links.projectId === null && links.opportunityId === undefined
            ? "Project cleared."
            : "Linked to work.",
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
    targets: ContactEmailThread[],
    links: { opportunityId?: string | null; projectId?: string | null },
    successLabel: string,
  ) => {
    if (targets.length === 0) return;
    setBulkBusy(true);
    setError(null);
    setStatusMessage(null);
    try {
      for (const thread of targets) {
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
      setExpandedId((current) => (current === conversationId ? null : current));
    } catch (purgeError) {
      setError(
        purgeError instanceof Error ? purgeError.message : "Could not remove mail",
      );
    } finally {
      setPurgingId(null);
    }
  };

  const domainMatched = useMemo(() => {
    return threads.filter((thread) => {
      if (domainFilter !== "external") return true;
      return thread.messages.some((message) => !message.isInternalOnly);
    });
  }, [threads, domainFilter]);

  const visibleThreads = useMemo(() => domainMatched.slice(0, 8), [domainMatched]);

  const hasInternalMail = useMemo(
    () => threads.some((thread) => thread.messages.every((message) => message.isInternalOnly)),
    [threads],
  );

  const domainFilterHidesRows =
    domainFilter === "external" && domainMatched.length < threads.length;

  const filterChips = useMemo((): FilterSummaryChip[] => {
    if (!domainFilterHidesRows) return [];
    return [
      {
        id: "domain",
        label: "Domain",
        value: "External",
        onRemove: () => setDomainFilter("all"),
      },
    ];
  }, [domainFilterHidesRows]);

  const commercialUnlinked = useMemo(() => {
    return visibleThreads.filter((thread) => {
      const latest = latestMessage(thread);
      if (!latest || isThreadLinked(latest)) return false;
      return mailLooksCommercial(threadSubject(thread), latest.bodyPreview);
    });
  }, [visibleThreads]);

  const headline = useMemo(() => {
    if (loading) return "Loading conversations…";
    if (visibleThreads.length === 0) return null;
    let newest: { at: string; outbound: boolean } | null = null;
    for (const thread of visibleThreads) {
      const latest = latestMessage(thread);
      const at = threadStamp(thread);
      if (!at || !latest) continue;
      if (!newest || Date.parse(at) > Date.parse(newest.at)) {
        newest = { at, outbound: latest.isOutbound };
      }
    }
    if (!newest) return `${visibleThreads.length} conversations`;
    const count = visibleThreads.length;
    return `Last mail ${formatCompactDate(newest.at)} · ${newest.outbound ? "outbound" : "inbound"} · ${count} conversation${count === 1 ? "" : "s"}`;
  }, [loading, visibleThreads]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        {headline ? (
          <p className="text-[13px] text-carbon-blue/70">{headline}</p>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-3">
          {hasInternalMail ? (
            <button
              type="button"
              onClick={() =>
                setDomainFilter((current) =>
                  current === "external" ? "all" : "external",
                )
              }
              className="text-[11px] font-medium text-carbon-blue/50 hover:text-upcycle-orange"
            >
              {domainFilter === "external" ? "Include internal" : "Hide internal"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void load()}
            className="text-[11px] font-medium text-carbon-blue/50 hover:text-upcycle-orange"
          >
            Refresh
          </button>
        </div>
      </div>

      {!loading && domainFilterHidesRows ? (
        <FilterTransparencyBar
          entityLabel="conversations"
          filteredCount={domainMatched.length}
          totalCount={threads.length}
          activeFilters={filterChips}
          onClearAll={() => setDomainFilter("all")}
          className="mb-2 border border-carbon-blue/10 px-2 py-1.5 sm:px-2"
        />
      ) : null}

      {!loading && commercialUnlinked.length >= 3 ? (
        <div className="mb-2 flex flex-wrap items-end gap-2 border border-carbon-blue/10 bg-white px-2 py-2">
          <p className="w-full text-[12px] text-carbon-blue/70">
            {commercialUnlinked.length} commercial conversations are not linked to
            work.
          </p>
          <label className="min-w-[12rem] flex-1">
            <span className="sr-only">Link commercial conversations to an opportunity</span>
            <select
              disabled={bulkBusy || opportunityOptions.length === 0}
              defaultValue=""
              onChange={(event) => {
                const value = event.target.value;
                event.target.value = "";
                if (!value) return;
                const option = opportunityOptions.find((row) => row.id === value);
                void applyBulkLinks(
                  commercialUnlinked,
                  { opportunityId: value },
                  option
                    ? `Linked ${commercialUnlinked.length} conversations to ${option.label}.`
                    : "Linked commercial conversations to the selected opportunity.",
                );
              }}
              className="w-full border border-carbon-blue/15 bg-white px-2 py-1 text-[11px] text-carbon-blue disabled:opacity-50"
            >
              <option value="">Link to opportunity…</option>
              {opportunityOptions.map((option) => (
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
            Save the open mail from the Outlook add-in, or connect Microsoft 365 and
            sync, then refresh.
          </p>
        </div>
      ) : null}

      {domainMatched.length > visibleThreads.length ? (
        <p className="mb-1 text-[11px] text-carbon-blue/45">
          Showing the latest 8 of {domainMatched.length} conversations.
        </p>
      ) : null}

      <ul className="divide-y divide-carbon-blue/10">
        {visibleThreads.map((thread) => {
          const latest = latestMessage(thread);
          if (!latest) return null;
          const subject = threadSubject(thread);
          const stamp = threadStamp(thread);
          const risk = thread.summary?.riskAlerts?.[0];
          const dealId = latest.opportunityId;
          const projectId = latest.projectId;
          const busy =
            purgingId === thread.conversationId ||
            linkingId === thread.conversationId;
          const expanded = expandedId === thread.conversationId;
          const commercial = mailLooksCommercial(subject, latest.bodyPreview);
          const linked = isThreadLinked(latest);
          const suggestion =
            !dealId && commercial
              ? suggestWorkLink(subject, opportunityOptions)
              : null;
          const showCollapsedLinkCta = commercial && !linked;
          const messageCount = thread.summary?.messageCount ?? thread.messages.length;
          const snippet = snippetText(latest.bodyPreview);

          return (
            <li key={thread.conversationId} className="py-2.5 first:pt-1">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() =>
                    setExpandedId((current) =>
                      current === thread.conversationId ? null : thread.conversationId,
                    )
                  }
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="min-w-0 text-[13px] font-semibold text-carbon-blue">
                      <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                        {latest.isOutbound ? "Out" : "In"}
                      </span>
                      {latest.isDeletedInSource ? (
                        <span className="mr-1 text-carbon-blue/40">[Deleted in Outlook]</span>
                      ) : null}
                      {subject}
                    </p>
                    <p className="shrink-0 text-[11px] text-carbon-blue/45">
                      {stamp ? formatCompactDate(stamp) : "Date unknown"}
                    </p>
                  </div>
                  {expanded ? null : snippet ? (
                    <p className="mt-0.5 text-[12px] leading-relaxed text-carbon-blue/55">
                      {snippet}
                    </p>
                  ) : null}
                </button>
                {!latest.isDeletedInSource ? (
                  <div className="shrink-0 pt-0.5">
                    <EmailMessageActions
                      toEmail={
                        latest.isOutbound
                          ? contactEmail?.trim() || latest.senderEmail
                          : latest.senderEmail
                      }
                      subject={latest.subject}
                      bodyPreview={latest.bodyPreview}
                      contactId={contactId}
                      contactName={contactName ?? null}
                      contactPhone={contactPhone ?? null}
                      opportunityId={dealId || undefined}
                      projectId={projectId || undefined}
                      role={role}
                      compact
                    />
                  </div>
                ) : null}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                {dealId && (latest.opportunityCode || latest.opportunityName) ? (
                  <Link
                    href={dealEmailsHref(dealId)}
                    className="text-[11px] font-medium text-upcycle-orange hover:underline"
                  >
                    {latest.opportunityCode
                      ? `${latest.opportunityCode} · ${latest.opportunityName ?? ""}`
                      : latest.opportunityName}
                  </Link>
                ) : null}
                {projectId && latest.projectName ? (
                  <Link
                    href={projectEmailsHref(projectId)}
                    className="text-[11px] font-medium text-upcycle-orange hover:underline"
                  >
                    {latest.projectName}
                  </Link>
                ) : null}
                {showCollapsedLinkCta && !expanded ? (
                  <button
                    type="button"
                    onClick={() => setExpandedId(thread.conversationId)}
                    className="text-[11px] font-medium text-carbon-blue/55 hover:text-upcycle-orange"
                  >
                    Link to work
                  </button>
                ) : null}
                {messageCount > 1 ? (
                  <span className="text-[11px] text-carbon-blue/40">
                    {messageCount} messages
                  </span>
                ) : null}
              </div>

              {expanded ? (
                <div className="mt-2 space-y-2">
                  {risk ? (
                    <p className="text-[11px] text-amber-800/90">Attention: {risk}</p>
                  ) : null}

                  {suggestion && !dealId ? (
                    <p className="text-[12px] leading-relaxed text-carbon-blue/75">
                      This looks like {suggestion.label}.{" "}
                      <button
                        type="button"
                        disabled={busy || bulkBusy}
                        onClick={() =>
                          void setThreadLinks(thread.conversationId, {
                            opportunityId: suggestion.id,
                          })
                        }
                        className="font-semibold text-upcycle-orange hover:underline disabled:opacity-50"
                      >
                        Link it
                      </button>
                    </p>
                  ) : null}

                  <SyncedMailPreview
                    emailId={latest.id}
                    bodyPreview={latest.bodyPreview}
                    webLink={latest.webLink}
                    role={role}
                    compact
                    presentation="reader"
                  />

                  <div className="grid gap-2 sm:grid-cols-2">
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

                  <div className="flex flex-wrap items-center gap-3">
                    {dealId ? (
                      <Link
                        href={dealEmailsHref(dealId)}
                        className="text-[11px] font-medium text-carbon-blue/55 hover:text-upcycle-orange"
                      >
                        Open opportunity
                      </Link>
                    ) : null}
                    {projectId ? (
                      <Link
                        href={projectEmailsHref(projectId)}
                        className="text-[11px] font-medium text-carbon-blue/55 hover:text-upcycle-orange"
                      >
                        Open project emails
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void removeThread(thread.conversationId)}
                      className="text-[11px] font-medium text-carbon-blue/45 hover:text-thermal-red disabled:opacity-50"
                    >
                      {purgingId === thread.conversationId
                        ? "Removing…"
                        : "Remove from SmartCRM"}
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
