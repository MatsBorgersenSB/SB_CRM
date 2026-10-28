"use client";

import { useCallback, useMemo, useState } from "react";
import { ArrowDownUp, Search, X } from "lucide-react";
import { FilterTransparencyBar } from "@/components/ui/filter-transparency-bar";
import type { SentimentGrade } from "@/generated/prisma";
import type { FilterSummaryChip } from "@/types/workspace-filters";

export type MailSentimentFilter = "all" | SentimentGrade;
export type MailDirectionFilter = "all" | "inbound" | "outbound";
export type MailDeletedFilter = "all" | "active" | "deleted";
export type MailDomainFilter = "all" | "external" | "internal_only";
export type MailDateSortOrder = "desc" | "asc";

export type MailFilterableMessage = {
  id: string;
  subject: string;
  bodyPreview?: string | null;
  senderEmail: string;
  recipientEmails?: string[];
  sentAt: string;
  sentiment?: SentimentGrade;
  isOutbound: boolean;
  isInternalOnly?: boolean;
  isDeletedInSource?: boolean;
  contactName?: string | null;
  opportunityName?: string | null;
  opportunityCode?: string | null;
  projectName?: string | null;
};

export type MailFilterableThread<TMessage extends MailFilterableMessage> = {
  conversationId: string;
  summary: {
    subject: string;
    messageCount: number;
    latestSentAt: string;
  } | null;
  messages: TMessage[];
};

export type MailSmartFilterState = {
  searchQuery: string;
  sentimentFilter: MailSentimentFilter;
  directionFilter: MailDirectionFilter;
  deletedFilter: MailDeletedFilter;
  domainFilter: MailDomainFilter;
  dateSort: MailDateSortOrder;
};

function labelize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseTimestamp(iso: string | null | undefined): number {
  if (!iso) return 0;
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function compareMailDates(
  aIso: string | null | undefined,
  bIso: string | null | undefined,
  dateSort: MailDateSortOrder,
): number {
  const aTime = parseTimestamp(aIso);
  const bTime = parseTimestamp(bIso);
  return dateSort === "asc" ? aTime - bTime : bTime - aTime;
}

export function newestMessageInList<TMessage extends { sentAt: string }>(
  messages: readonly TMessage[],
): TMessage | null {
  if (messages.length === 0) return null;
  let best = messages[0]!;
  let bestTime = parseTimestamp(best.sentAt);
  for (let i = 1; i < messages.length; i += 1) {
    const candidate = messages[i]!;
    const candidateTime = parseTimestamp(candidate.sentAt);
    if (candidateTime >= bestTime) {
      best = candidate;
      bestTime = candidateTime;
    }
  }
  return best;
}

export function matchesMailSmartFilters(
  message: MailFilterableMessage,
  state: MailSmartFilterState,
): boolean {
  if (state.sentimentFilter !== "all" && message.sentiment !== state.sentimentFilter) {
    return false;
  }
  if (state.directionFilter === "inbound" && message.isOutbound) return false;
  if (state.directionFilter === "outbound" && !message.isOutbound) return false;
  if (state.deletedFilter === "active" && message.isDeletedInSource) return false;
  if (state.deletedFilter === "deleted" && !message.isDeletedInSource) return false;

  const internalOnly = Boolean(message.isInternalOnly);
  if (state.domainFilter === "external" && internalOnly) return false;
  if (state.domainFilter === "internal_only" && !internalOnly) return false;

  const query = state.searchQuery.trim().toLowerCase();
  if (query) {
    const haystack = [
      message.subject,
      message.bodyPreview ?? "",
      message.senderEmail,
      ...(message.recipientEmails ?? []),
      message.contactName ?? "",
      message.opportunityName ?? "",
      message.opportunityCode ?? "",
      message.projectName ?? "",
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(query)) return false;
  }

  return true;
}

export function filterAndSortMailMessages<TMessage extends MailFilterableMessage>(
  messages: readonly TMessage[],
  state: MailSmartFilterState,
): TMessage[] {
  return messages
    .filter((message) => matchesMailSmartFilters(message, state))
    .sort((a, b) => compareMailDates(a.sentAt, b.sentAt, state.dateSort));
}

export function filterAndSortMailThreads<
  TMessage extends MailFilterableMessage,
  TThread extends MailFilterableThread<TMessage>,
>(threads: readonly TThread[], state: MailSmartFilterState): TThread[] {
  const filtered = threads
    .map((thread) => {
      const messages = thread.messages
        .filter((message) => matchesMailSmartFilters(message, state))
        .sort((a, b) => compareMailDates(a.sentAt, b.sentAt, state.dateSort));
      return { ...thread, messages };
    })
    .filter((thread) => thread.messages.length > 0);

  return filtered.sort((a, b) => {
    const aAnchor =
      state.dateSort === "asc"
        ? (a.messages[0]?.sentAt ?? a.summary?.latestSentAt ?? "")
        : (newestMessageInList(a.messages)?.sentAt ?? a.summary?.latestSentAt ?? "");
    const bAnchor =
      state.dateSort === "asc"
        ? (b.messages[0]?.sentAt ?? b.summary?.latestSentAt ?? "")
        : (newestMessageInList(b.messages)?.sentAt ?? b.summary?.latestSentAt ?? "");
    return compareMailDates(aAnchor, bAnchor, state.dateSort);
  });
}

export function useMailSmartFilters(initial?: Partial<MailSmartFilterState>) {
  const [searchQuery, setSearchQuery] = useState(initial?.searchQuery ?? "");
  const [sentimentFilter, setSentimentFilter] = useState<MailSentimentFilter>(
    initial?.sentimentFilter ?? "all",
  );
  const [directionFilter, setDirectionFilter] = useState<MailDirectionFilter>(
    initial?.directionFilter ?? "all",
  );
  const [deletedFilter, setDeletedFilter] = useState<MailDeletedFilter>(
    initial?.deletedFilter ?? "all",
  );
  // FS-009 Privacy First — exclude internal-only by default (AD-001 chip: Domain · External).
  const [domainFilter, setDomainFilter] = useState<MailDomainFilter>(
    initial?.domainFilter ?? "external",
  );
  const [dateSort, setDateSort] = useState<MailDateSortOrder>(
    initial?.dateSort ?? "desc",
  );

  const state: MailSmartFilterState = useMemo(
    () => ({
      searchQuery,
      sentimentFilter,
      directionFilter,
      deletedFilter,
      domainFilter,
      dateSort,
    }),
    [searchQuery, sentimentFilter, directionFilter, deletedFilter, domainFilter, dateSort],
  );

  const activeFilters = useMemo((): FilterSummaryChip[] => {
    const chips: FilterSummaryChip[] = [];
    if (searchQuery.trim()) {
      chips.push({
        id: "search",
        label: "Search",
        value: searchQuery.trim(),
        onRemove: () => setSearchQuery(""),
      });
    }
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
        value: domainFilter === "external" ? "External" : "Internal-only",
        onRemove: () => setDomainFilter("all"),
      });
    }
    return chips;
  }, [searchQuery, sentimentFilter, directionFilter, deletedFilter, domainFilter]);

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setSentimentFilter("all");
    setDirectionFilter("all");
    setDeletedFilter("all");
    // Restore constitutional privacy default (not unfiltered "all").
    setDomainFilter("external");
  }, []);

  const toggleDateSort = useCallback(() => {
    setDateSort((current) => (current === "desc" ? "asc" : "desc"));
  }, []);

  return {
    state,
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
    toggleDateSort,
    activeFilters,
    resetFilters,
  };
}

export type MailSmartFilterBarProps = {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  sentimentFilter: MailSentimentFilter;
  onSentimentChange: (value: MailSentimentFilter) => void;
  directionFilter: MailDirectionFilter;
  onDirectionChange: (value: MailDirectionFilter) => void;
  deletedFilter: MailDeletedFilter;
  onDeletedChange: (value: MailDeletedFilter) => void;
  domainFilter: MailDomainFilter;
  onDomainChange: (value: MailDomainFilter) => void;
  dateSort: MailDateSortOrder;
  onDateSortChange: (value: MailDateSortOrder) => void;
  filteredCount: number;
  totalCount: number;
  activeFilters: FilterSummaryChip[];
  onClearAll?: () => void;
  entityLabel?: string;
  compact?: boolean;
  /** Search stays visible; sentiment, direction, source, domain and sort sit behind "More filters". */
  collapseSecondary?: boolean;
};

export function MailSmartFilterBar({
  searchQuery,
  onSearchChange,
  sentimentFilter,
  onSentimentChange,
  directionFilter,
  onDirectionChange,
  deletedFilter,
  onDeletedChange,
  domainFilter,
  onDomainChange,
  dateSort,
  onDateSortChange,
  filteredCount,
  totalCount,
  activeFilters,
  onClearAll,
  entityLabel = "Emails",
  compact = false,
  collapseSecondary = false,
}: MailSmartFilterBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  // A filter that is doing something stays visible — never hide an active filter.
  const secondaryActive =
    sentimentFilter !== "all" ||
    directionFilter !== "all" ||
    deletedFilter !== "all" ||
    domainFilter !== "external" ||
    dateSort !== "desc";
  const showSecondary = !collapseSecondary || moreOpen || secondaryActive;
  return (
    <div className="flex flex-col gap-2">
      <div
        className={`flex flex-wrap items-end gap-3 border border-carbon-blue/10 bg-white ${
          compact ? "px-2.5 py-2.5" : "px-3 py-3"
        }`}
      >
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-[12px] font-semibold text-carbon-blue/55">
          Search
          <div className="relative flex items-center">
            <Search
              className="pointer-events-none absolute left-2.5 size-3.5 text-carbon-blue/40"
              aria-hidden
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Subject, sender, content…"
              aria-label="Search emails"
              className="w-full border border-carbon-blue/15 bg-white py-1.5 pl-8 pr-7 text-[13px] font-medium text-carbon-blue placeholder:font-normal placeholder:text-carbon-blue/40"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                aria-label="Clear email search"
                className="absolute right-2 text-carbon-blue/45 hover:text-carbon-blue"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
        </label>

        {collapseSecondary ? (
          <button
            type="button"
            aria-expanded={showSecondary}
            onClick={() => setMoreOpen((open) => !open)}
            className="inline-flex items-center gap-1.5 self-end border border-carbon-blue/15 bg-white px-2.5 py-1.5 text-[13px] font-semibold text-carbon-blue/75 transition-colors hover:border-upcycle-orange/40 hover:text-upcycle-orange"
          >
            {showSecondary ? "Fewer filters" : "More filters"}
          </button>
        ) : null}

        {showSecondary ? (
          <>
        <label className="flex min-w-[9.5rem] flex-col gap-1 text-[12px] font-semibold text-carbon-blue/55">
          Sentiment
          <select
            value={sentimentFilter}
            onChange={(event) =>
              onSentimentChange(event.target.value as MailSentimentFilter)
            }
            className="border border-carbon-blue/15 bg-white px-2 py-1.5 text-[13px] font-medium text-carbon-blue"
          >
            <option value="all">All sentiments</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="cautious">Cautious</option>
            <option value="negative">Negative</option>
          </select>
        </label>

        <label className="flex min-w-[9.5rem] flex-col gap-1 text-[12px] font-semibold text-carbon-blue/55">
          Direction
          <select
            value={directionFilter}
            onChange={(event) =>
              onDirectionChange(event.target.value as MailDirectionFilter)
            }
            className="border border-carbon-blue/15 bg-white px-2 py-1.5 text-[13px] font-medium text-carbon-blue"
          >
            <option value="all">Inbound + outbound</option>
            <option value="inbound">Inbound only</option>
            <option value="outbound">Outbound only</option>
          </select>
        </label>

        <label className="flex min-w-[9.5rem] flex-col gap-1 text-[12px] font-semibold text-carbon-blue/55">
          Outlook source
          <select
            value={deletedFilter}
            onChange={(event) =>
              onDeletedChange(event.target.value as MailDeletedFilter)
            }
            className="border border-carbon-blue/15 bg-white px-2 py-1.5 text-[13px] font-medium text-carbon-blue"
          >
            <option value="all">All (incl. deleted)</option>
            <option value="active">Active in Outlook</option>
            <option value="deleted">Deleted in Outlook</option>
          </select>
        </label>

        <label className="flex min-w-[9.5rem] flex-col gap-1 text-[12px] font-semibold text-carbon-blue/55">
          Domains
          <select
            value={domainFilter}
            onChange={(event) =>
              onDomainChange(event.target.value as MailDomainFilter)
            }
            className="border border-carbon-blue/15 bg-white px-2 py-1.5 text-[13px] font-medium text-carbon-blue"
          >
            <option value="external">External (default)</option>
            <option value="all">All domains</option>
            <option value="internal_only">Internal-only</option>
          </select>
        </label>

        <label className="flex min-w-[11rem] flex-col gap-1 text-[12px] font-semibold text-carbon-blue/55">
          Sort by date
          <select
            value={dateSort}
            onChange={(event) =>
              onDateSortChange(event.target.value as MailDateSortOrder)
            }
            aria-label="Sort emails by date"
            className="border border-carbon-blue/15 bg-white px-2 py-1.5 text-[13px] font-medium text-carbon-blue"
          >
            <option value="desc">Descending (newest first)</option>
            <option value="asc">Ascending (oldest first)</option>
          </select>
        </label>
          </>
        ) : null}
      </div>

      <FilterTransparencyBar
        entityLabel={entityLabel}
        filteredCount={filteredCount}
        totalCount={totalCount}
        activeFilters={activeFilters}
        onClearAll={activeFilters.length >= 2 ? onClearAll : undefined}
        endActions={
          <button
            type="button"
            onClick={() => onDateSortChange(dateSort === "desc" ? "asc" : "desc")}
            className="inline-flex items-center gap-1.5 border border-carbon-blue/15 bg-white px-2.5 py-1 text-[12px] font-semibold text-carbon-blue/75 transition-colors hover:border-upcycle-orange/40 hover:text-upcycle-orange"
            title={
              dateSort === "desc"
                ? "Sorted newest first (descending) — click for oldest first (ascending)"
                : "Sorted oldest first (ascending) — click for newest first (descending)"
            }
          >
            <ArrowDownUp className="size-3.5 shrink-0" aria-hidden />
            <span>
              Date: {dateSort === "desc" ? "Descending (newest)" : "Ascending (oldest)"}
            </span>
          </button>
        }
      />
    </div>
  );
}
