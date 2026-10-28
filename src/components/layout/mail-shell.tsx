"use client";

import { useEffect, useMemo, useState } from "react";
import { PenSquare } from "lucide-react";
import { ActivityCreateWizard } from "@/components/activities/activity-create-wizard";
import { useAuth } from "@/context/auth-context";
import { buildMailActivityPreset } from "@/lib/mail-activity-draft";
import type { CreateActivityInput } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { StandardBioUserRecord } from "@/types/user-access";
import {
  filterAndSortMailThreads,
  MailSmartFilterBar,
  useMailSmartFilters,
} from "@/components/emails/mail-smart-filters";
import {
  MailThreadRow,
  type MailLinkOption,
  type MailThreadLinks,
} from "@/components/emails/mail-thread-row";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { WorkspaceMain, WorkspaceStack } from "@/components/ui/workspace-main";
import { WorkspacePageTitle } from "@/components/ui/workspace-page-title";
import { WorkspaceTopBar } from "@/components/ui/workspace-top-bar";
import { WorkspacePanel } from "@/components/ui/smartcrm-icon";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import type { EmailMessageIntelligenceDto } from "@/lib/email-intelligence-data";
import {
  countMailViews,
  groupMailIntoThreads,
  leadMessageOf,
  MAIL_VIEW_LABELS,
  threadMatchesView,
  type MailThread,
  type MailView,
} from "@/lib/mail-triage";
import { outlookComposeUrl } from "@/lib/outlook-compose-link";
import type { UserRole } from "@/types/auth";
import type { FilterSummaryChip } from "@/types/workspace-filters";

export type { MailLinkOption };

type Thread = MailThread<EmailMessageIntelligenceDto>;

const VIEW_ORDER: MailView[] = ["all", "needs_you", "waiting", "unlinked", "system"];

const EMPTY_VIEW_COPY: Record<Exclude<MailView, "all">, string> = {
  needs_you: "Nothing needs your reply or attention right now.",
  waiting: "No mail is waiting on an answer from the other side.",
  unlinked: "Every conversation with a person is filed against work.",
  system: "No meeting responses or system mail in this list.",
};

async function readError(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    detail?: string;
  };
  return payload.detail || payload.error || fallback;
}

export function MailShell({
  messages,
  role = "superuser",
  opportunityOptions = [],
  projectOptions = [],
  assignableUsers = [],
}: {
  messages: EmailMessageIntelligenceDto[];
  role?: UserRole;
  opportunityOptions?: MailLinkOption[];
  projectOptions?: MailLinkOption[];
  assignableUsers?: StandardBioUserRecord[];
}) {
  const { user } = useAuth();
  const {
    state: filterState,
    searchQuery,
    setSearchQuery,
    sentimentFilter,
    setSentimentFilter,
    directionFilter,
    setDirectionFilter,
    deletedFilter,
    setDeletedFilter,
    domainFilter,
    setDomainFilter,
    dateSort,
    setDateSort,
    activeFilters,
    resetFilters,
  } = useMailSmartFilters();

  const [localMessages, setLocalMessages] = useState(messages);
  // Decide first: open on what needs the user, when anything does.
  const [view, setView] = useState<MailView>(() =>
    countMailViews(groupMailIntoThreads(messages)).needs_you > 0 ? "needs_you" : "all",
  );
  const [undoHandledId, setUndoHandledId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Task from a mail. Companies and deals are only fetched the first time one is opened.
  const [activityPreset, setActivityPreset] = useState<Partial<CreateActivityInput> | null>(null);
  const [activityCompanies, setActivityCompanies] = useState<Company[] | null>(null);
  const [activityPipelines, setActivityPipelines] = useState<PipelineRow[] | null>(null);

  useEffect(() => {
    if (!activityPreset) return;
    if (activityCompanies !== null && activityPipelines !== null) return;
    let cancelled = false;
    Promise.all([
      fetch("/api/companies", { credentials: "include" }).then((res) => (res.ok ? res.json() : [])),
      fetch("/api/pipelines", { credentials: "include" }).then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([companies, pipelines]) => {
        if (cancelled) return;
        setActivityCompanies(Array.isArray(companies) ? (companies as Company[]) : []);
        setActivityPipelines(Array.isArray(pipelines) ? (pipelines as PipelineRow[]) : []);
      })
      .catch(() => {
        if (cancelled) return;
        setActivityCompanies((current) => current ?? []);
        setActivityPipelines((current) => current ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [activityPreset, activityCompanies, activityPipelines]);

  const openActivityFromThread = (thread: Thread) => {
    const lead = leadMessageOf(thread.messages);
    if (!lead) return;
    const withContact = thread.messages.find((message) => message.contactId);
    const dealMessage = thread.messages.find((message) => message.opportunityId);
    const projectMessage = thread.messages.find((message) => message.projectId);
    setActivityPreset(
      buildMailActivityPreset({
        lead,
        status: thread.status,
        contactId: withContact?.contactId ?? null,
        contactName: withContact?.contactName ?? null,
        companyId: withContact?.companyId ?? null,
        companyCode: withContact?.companyCode ?? null,
        opportunityId: dealMessage?.opportunityId ?? null,
        projectId: projectMessage?.projectId ?? null,
        projectName: projectMessage?.projectName ?? null,
      }),
    );
  };

  const allThreads = useMemo(() => groupMailIntoThreads(localMessages), [localMessages]);

  // Message filters first; the conversation keeps the status worked out from the whole thread.
  const filteredThreads = useMemo(
    () =>
      filterAndSortMailThreads<EmailMessageIntelligenceDto, Thread & {
        summary: null;
      }>(
        allThreads.map((thread) => ({ ...thread, summary: null })),
        filterState,
      ),
    [allThreads, filterState],
  );

  const viewCounts = useMemo(() => countMailViews(filteredThreads), [filteredThreads]);
  const visibleThreads = useMemo(
    () => filteredThreads.filter((thread) => threadMatchesView(thread, view)),
    [filteredThreads, view],
  );

  const chips: FilterSummaryChip[] =
    view === "all"
      ? activeFilters
      : [
          {
            id: "view",
            label: "Show",
            value: MAIL_VIEW_LABELS[view],
            onRemove: () => setView("all"),
          },
          ...activeFilters,
        ];

  const clearAll = () => {
    resetFilters();
    setView("all");
  };

  const linkThread = async (
    thread: Thread,
    contactId: string | null,
    links: MailThreadLinks,
  ) => {
    setBusyId(thread.conversationId);
    setError(null);
    setNotice(null);
    try {
      // With a contact the contact API also files the company on the project.
      // Without one, the conversation is addressed directly.
      const response = contactId
        ? await fetch(`/api/contacts/${encodeURIComponent(contactId)}/emails`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", [AUTH_ROLE_HEADER]: role },
            body: JSON.stringify({ conversationId: thread.conversationId, ...links }),
          })
        : await fetch(
            `/api/emails/conversations/${encodeURIComponent(thread.conversationId)}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json", [AUTH_ROLE_HEADER]: role },
              body: JSON.stringify(links),
            },
          );
      if (!response.ok) throw new Error(await readError(response, "Could not update link"));
      const payload = (await response.json().catch(() => ({}))) as {
        opportunityName?: string | null;
        opportunityCode?: string | null;
        projectName?: string | null;
      };
      const deal =
        links.opportunityId != null
          ? opportunityOptions.find((option) => option.id === links.opportunityId)
          : null;
      const project =
        links.projectId != null
          ? projectOptions.find((option) => option.id === links.projectId)
          : null;

      setLocalMessages((current) =>
        current.map((message) => {
          if (message.conversationId !== thread.conversationId) return message;
          return {
            ...message,
            ...(links.opportunityId !== undefined
              ? {
                  opportunityId: links.opportunityId,
                  opportunityName:
                    links.opportunityId == null
                      ? null
                      : (payload.opportunityName ?? deal?.name ?? null),
                  opportunityCode:
                    links.opportunityId == null
                      ? null
                      : (payload.opportunityCode ?? deal?.code ?? null),
                }
              : {}),
            ...(links.projectId !== undefined
              ? {
                  projectId: links.projectId,
                  projectName:
                    links.projectId == null
                      ? null
                      : (payload.projectName ?? project?.name ?? null),
                }
              : {}),
          };
        }),
      );
      setNotice(
        (links.opportunityId === null && links.projectId === undefined) ||
          (links.projectId === null && links.opportunityId === undefined)
          ? "Link removed."
          : "Conversation filed against work.",
      );
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : "Could not update link");
    } finally {
      setBusyId(null);
    }
  };

  const setHandledLocally = (conversationId: string, handledAt: string | null) =>
    setLocalMessages((current) =>
      current.map((message) =>
        message.conversationId === conversationId ? { ...message, handledAt } : message,
      ),
    );

  const markHandled = async (thread: Thread) => {
    setBusyId(thread.conversationId);
    setError(null);
    setNotice(null);
    setUndoHandledId(null);
    try {
      const response = await fetch(
        `/api/emails/conversations/${encodeURIComponent(thread.conversationId)}/handled`,
        { method: "POST", headers: { [AUTH_ROLE_HEADER]: role } },
      );
      if (!response.ok) throw new Error(await readError(response, "Could not update conversation"));
      const payload = (await response.json().catch(() => ({}))) as { handledAt?: string };
      setHandledLocally(thread.conversationId, payload.handledAt ?? new Date().toISOString());
      setNotice("Marked as no reply needed. It comes back if they write again.");
      setUndoHandledId(thread.conversationId);
    } catch (handledError) {
      setError(
        handledError instanceof Error ? handledError.message : "Could not update conversation",
      );
    } finally {
      setBusyId(null);
    }
  };

  const undoHandled = async (conversationId: string) => {
    setError(null);
    try {
      const response = await fetch(
        `/api/emails/conversations/${encodeURIComponent(conversationId)}/handled`,
        { method: "DELETE", headers: { [AUTH_ROLE_HEADER]: role } },
      );
      if (!response.ok) throw new Error(await readError(response, "Could not undo"));
      setHandledLocally(conversationId, null);
      setUndoHandledId(null);
      setNotice("Back in your list.");
    } catch (undoError) {
      setError(undoError instanceof Error ? undoError.message : "Could not undo");
    }
  };

  const removeThread = async (thread: Thread, contactId: string | null) => {
    const confirmed = window.confirm(
      `Remove “${leadMessageOf(thread.messages)?.subject ?? "this conversation"}” from SmartCRM?\n\nUse this for private or irrelevant mail. It stays in Outlook, and it will not come back on the next sync.`,
    );
    if (!confirmed) return;
    setBusyId(thread.conversationId);
    setError(null);
    setNotice(null);
    try {
      const response = contactId
        ? await fetch(`/api/contacts/${encodeURIComponent(contactId)}/emails`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json", [AUTH_ROLE_HEADER]: role },
            body: JSON.stringify({ conversationId: thread.conversationId, action: "purge" }),
          })
        : await fetch(
            `/api/emails/conversations/${encodeURIComponent(thread.conversationId)}`,
            { method: "DELETE", headers: { [AUTH_ROLE_HEADER]: role } },
          );
      if (!response.ok) throw new Error(await readError(response, "Could not remove mail"));
      setLocalMessages((current) =>
        current.filter((message) => message.conversationId !== thread.conversationId),
      );
      setExpandedId((current) => (current === thread.conversationId ? null : current));
      setNotice("Conversation removed from SmartCRM.");
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Could not remove mail");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <WorkspaceChrome>
      <WorkspaceTopBar icon="document" title="Mail" />

      <WorkspaceMain>
        <WorkspaceStack>
          <section className="flex flex-wrap items-center justify-between gap-3">
            <WorkspacePageTitle
              icon="document"
              title="Mail"
              subtitle="What needs you first — then everything SmartCRM has tied to your work."
            />
            <a
              href={outlookComposeUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-upcycle-orange bg-upcycle-orange px-4 py-2 text-[13px] font-semibold text-white hover:bg-upcycle-orange/90"
            >
              <PenSquare className="size-4" aria-hidden />
              New mail
            </a>
          </section>

          <nav
            aria-label="Mail views"
            className="flex flex-wrap items-center gap-2"
          >
            {VIEW_ORDER.map((id) => {
              const active = view === id;
              const urgent = id === "needs_you" && viewCounts.needs_you > 0;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setView(id)}
                  className={`inline-flex items-center gap-2 border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                    active
                      ? "border-upcycle-orange bg-upcycle-orange text-white"
                      : "border-carbon-blue/15 bg-white text-carbon-blue/75 hover:border-upcycle-orange/40 hover:text-upcycle-orange"
                  }`}
                >
                  {MAIL_VIEW_LABELS[id]}
                  <span
                    className={`px-1.5 text-[11px] ${
                      active
                        ? "bg-white/20 text-white"
                        : urgent
                          ? "bg-upcycle-orange/[0.12] text-upcycle-orange"
                          : "bg-carbon-blue/[0.06] text-carbon-blue/60"
                    }`}
                  >
                    {viewCounts[id]}
                  </span>
                </button>
              );
            })}
          </nav>

          <MailSmartFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sentimentFilter={sentimentFilter}
            onSentimentChange={setSentimentFilter}
            directionFilter={directionFilter}
            onDirectionChange={setDirectionFilter}
            deletedFilter={deletedFilter}
            onDeletedChange={setDeletedFilter}
            domainFilter={domainFilter}
            onDomainChange={setDomainFilter}
            dateSort={dateSort}
            onDateSortChange={setDateSort}
            filteredCount={visibleThreads.length}
            totalCount={allThreads.length}
            activeFilters={chips}
            onClearAll={clearAll}
            entityLabel="Conversations"
            collapseSecondary
          />

          {notice ? (
            <p role="status" className="text-[12px] text-carbon-blue/70">
              {notice}
              {undoHandledId && notice.startsWith("Marked as no reply") ? (
                <button
                  type="button"
                  onClick={() => void undoHandled(undoHandledId)}
                  className="ml-2 font-semibold text-upcycle-orange hover:underline"
                >
                  Undo
                </button>
              ) : null}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-[12px] text-thermal-red">
              {error}
            </p>
          ) : null}

          <WorkspacePanel title="Conversations" count={visibleThreads.length}>
            {allThreads.length === 0 ? (
              <p className="text-[13px] text-carbon-blue/60">
                No mail is linked to your relationships yet. Sync your mailbox or tag a
                mail in Outlook and it appears here.
              </p>
            ) : visibleThreads.length === 0 ? (
              <p className="text-[13px] text-carbon-blue/60">
                {view !== "all" && activeFilters.length === 0
                  ? EMPTY_VIEW_COPY[view]
                  : "No conversations match the active filters."}
              </p>
            ) : (
              <ul className="-mx-6 -my-5 divide-y divide-border/60">
                {visibleThreads.map((thread) => (
                  <MailThreadRow
                    key={thread.conversationId}
                    thread={thread}
                    role={role}
                    expanded={expandedId === thread.conversationId}
                    busy={busyId === thread.conversationId}
                    dateSort={dateSort}
                    opportunityOptions={opportunityOptions}
                    projectOptions={projectOptions}
                    onToggle={() =>
                      setExpandedId((current) =>
                        current === thread.conversationId ? null : thread.conversationId,
                      )
                    }
                    onLink={linkThread}
                    onRemove={removeThread}
                    onCreateActivity={openActivityFromThread}
                    onHandled={markHandled}
                  />
                ))}
              </ul>
            )}
          </WorkspacePanel>
        </WorkspaceStack>
      </WorkspaceMain>
      <ActivityCreateWizard
        key={activityPreset?.OutlookMessageId ?? "closed"}
        open={activityPreset !== null}
        onClose={() => setActivityPreset(null)}
        onCreated={() => {
          setActivityPreset(null);
          setNotice("Task created from this mail.");
        }}
        companies={activityCompanies ?? []}
        pipelines={activityPipelines ?? []}
        preset={activityPreset ?? undefined}
        defaultOwner={user}
        assignableUsers={assignableUsers}
      />
    </WorkspaceChrome>
  );
}
