"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type {
  AskSearchResult,
  SearchIndexItem,
  SearchResultGroup,
  SmartSearchMode,
} from "@/types/universal-search";
import {
  filterSearchIndexForUser,
  flattenSearchGroups,
  querySearchIndex,
  topScoredItems,
} from "@/lib/universal-search-query";
import {
  answerSmartSearchQuestion,
  getSuggestedAskQuestions,
  isAskStyleQuery,
  matchSearchCommands,
} from "@/lib/smart-search-ask-engine";
import { buildRelationshipBundles } from "@/lib/smart-search-relationship";
import { useAuth } from "@/context/auth-context";
import { SearchEntityIcon, SmartCRMIcon } from "@/components/ui/smartcrm-icon";
import { FilterTransparencyBar } from "@/components/ui/filter-transparency-bar";
import type { FilterSummaryChip } from "@/types/workspace-filters";

type UniversalSearchDialogProps = {
  open: boolean;
  onClose: () => void;
  index: SearchIndexItem[];
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  commercialPackages: CommercialPackage[];
};

function platformShortcutLabel(): string {
  if (typeof navigator === "undefined") return "Ctrl+K";
  return navigator.platform.toLowerCase().includes("mac") ? "⌘K" : "Ctrl+K";
}

function SmartResultMeta({ item }: { item: SearchIndexItem }) {
  const meta = item.smartMeta;
  if (!meta || item.entityType !== "company") return null;

  return (
    <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px]" style={{ color: "var(--command-muted)" }}>
      {meta.locationLabel ? <span>📍 {meta.locationLabel}</span> : null}
      {meta.openOpportunities !== undefined ? (
        <span>🎯 {meta.openOpportunities} Active Opportunit{meta.openOpportunities === 1 ? "y" : "ies"}</span>
      ) : null}
      {meta.pipelineValueLabel && meta.pipelineValueLabel !== "—" ? (
        <span>💰 {meta.pipelineValueLabel} Pipeline</span>
      ) : null}
      {meta.contactCount !== undefined ? <span>👤 {meta.contactCount} Contacts</span> : null}
      {meta.attentionCount !== undefined && meta.attentionCount > 0 ? (
        <span>⚠ {meta.attentionCount} Attention Item{meta.attentionCount === 1 ? "" : "s"}</span>
      ) : null}
    </span>
  );
}

function SearchResultRow({
  item,
  active,
  index,
  onSelect,
  onHover,
}: {
  item: SearchIndexItem;
  active: boolean;
  index: number;
  onSelect: (item: SearchIndexItem) => void;
  onHover: (index: number) => void;
}) {
  return (
    <li>
      <button
        type="button"
        data-active={active ? "true" : "false"}
        onClick={() => onSelect(item)}
        onMouseEnter={() => onHover(index)}
        className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors duration-100"
        style={{
          background: active ? "var(--command-hover)" : "transparent",
          color: "var(--command-text)",
        }}
      >
        <span
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center border text-base"
          style={{
            borderColor: active
              ? "color-mix(in srgb, #e65125 35%, var(--command-border))"
              : "var(--command-border)",
            background: active
              ? "color-mix(in srgb, #e65125 12%, transparent)"
              : "var(--command-subtle)",
          }}
        >
          <SearchEntityIcon entityType={item.entityType} size="md" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span className="truncate text-sm font-semibold leading-snug">{item.name}</span>
            <span
              className="shrink-0 text-[10px] font-medium uppercase tracking-wide"
              style={{ color: "var(--command-muted)" }}
            >
              {item.typeLabel}
            </span>
          </span>

          <span
            className="mt-0.5 line-clamp-1 text-[11px] leading-relaxed"
            style={{ color: "var(--command-muted)" }}
          >
            {item.contextPreview}
          </span>

          <SmartResultMeta item={item} />

          <span className="mt-1 flex items-center gap-1.5 text-[10px]">
            <SmartCRMIcon name="meeting" size="xs" />
            <span style={{ color: "var(--command-muted)" }}>{item.lastActivityLabel}</span>
          </span>

          {item.actions && item.actions.length > 0 ? (
            <span className="mt-2 flex flex-wrap gap-1.5">
              {item.actions.slice(0, 3).map((action) => (
                <Link
                  key={`${item.id}-${action.kind}`}
                  href={action.href ?? "#"}
                  onClick={(event) => event.stopPropagation()}
                  className="border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide transition-colors hover:border-upcycle-orange/40 hover:text-upcycle-orange"
                  style={{
                    borderColor: "var(--command-border)",
                    color: "var(--command-muted)",
                  }}
                >
                  {action.label}
                </Link>
              ))}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

export function UniversalSearchDialog({
  open,
  onClose,
  index,
  companies,
  pipelines,
  activities,
  commercialPackages,
}: UniversalSearchDialogProps) {
  const router = useRouter();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SmartSearchMode>("search");
  const [activeIndex, setActiveIndex] = useState(0);

  const scopedIndex = useMemo(
    () => filterSearchIndexForUser(index, user, companies, pipelines),
    [index, user, companies, pipelines],
  );

  const searchContext = useMemo(
    () => ({
      companies,
      pipelines,
      activities,
      commercialPackages,
      index: scopedIndex,
      user,
    }),
    [companies, pipelines, activities, commercialPackages, scopedIndex, user],
  );

  const askResult: AskSearchResult | null = useMemo(() => {
    if (mode !== "ask" || !query.trim()) return null;
    return answerSmartSearchQuestion(query, searchContext);
  }, [mode, query, searchContext]);

  const groups: SearchResultGroup[] = useMemo(() => {
    if (mode === "ask") return [];
    return querySearchIndex(scopedIndex, query);
  }, [scopedIndex, query, mode]);

  const relationshipBundles = useMemo(() => {
    if (mode !== "search" || !query.trim()) return [];
    const top = topScoredItems(scopedIndex, query, 6);
    return buildRelationshipBundles(top, query, scopedIndex);
  }, [mode, query, scopedIndex]);

  const flatResults = useMemo(() => {
    if (mode === "ask") return askResult?.items ?? [];
    return flattenSearchGroups(groups);
  }, [mode, groups, askResult]);

  const isSuggested = !query.trim() && mode === "search";
  const suggestedQuestions = getSuggestedAskQuestions();
  const commandMatches = useMemo(() => matchSearchCommands(query), [query]);

  const searchActiveFilters = useMemo<FilterSummaryChip[]>(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    return [
      {
        id: "search",
        label: "Search",
        value: trimmed,
        onRemove: () => setQuery(""),
      },
    ];
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setMode("search");
    setActiveIndex(0);
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, mode]);

  useEffect(() => {
    if (mode === "search" && isAskStyleQuery(query) && query.trim().length > 12) {
      setMode("ask");
    }
  }, [query, mode]);

  const navigate = useCallback(
    (item: SearchIndexItem) => {
      router.push(item.href);
      onClose();
    },
    [router, onClose],
  );

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) =>
          flatResults.length === 0 ? 0 : Math.min(flatResults.length - 1, current + 1),
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) => Math.max(0, current - 1));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        if (flatResults[activeIndex]) {
          navigate(flatResults[activeIndex]);
          return;
        }
        if (mode === "ask" && askResult?.actionHref) {
          router.push(askResult.actionHref);
          onClose();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, flatResults, activeIndex, navigate, onClose, mode, askResult, router]);

  useEffect(() => {
    const activeEl = listRef.current?.querySelector('[data-active="true"]');
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  let runningIndex = -1;
  const shortcut = platformShortcutLabel();

  return (
    <div
      className="command-palette-backdrop fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[8vh] backdrop-blur-md"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="SmartCRM Command Center"
        className="command-palette flex max-h-[min(78vh,640px)] w-full max-w-3xl flex-col overflow-hidden"
      >
        <div
          className="flex items-center gap-2 border-b px-3 py-2"
          style={{ borderColor: "var(--command-border)" }}
        >
          <button
            type="button"
            onClick={() => setMode("search")}
            className={`px-3 py-1.5 text-[11px] font-semibold transition-colors ${
              mode === "search"
                ? "bg-upcycle-orange/12 text-upcycle-orange"
                : "text-[var(--command-muted)] hover:text-[var(--command-text)]"
            }`}
          >
            🔍 Search
          </button>
          <button
            type="button"
            onClick={() => setMode("ask")}
            className={`px-3 py-1.5 text-[11px] font-semibold transition-colors ${
              mode === "ask"
                ? "bg-upcycle-orange/12 text-upcycle-orange"
                : "text-[var(--command-muted)] hover:text-[var(--command-text)]"
            }`}
          >
            ✨ Ask SmartCRM
          </button>
        </div>

        <div
          className="flex items-center gap-3 border-b px-4 py-3.5"
          style={{ borderColor: "var(--command-border)" }}
        >
          <SmartCRMIcon name={mode === "ask" ? "search" : "search"} size="md" className="shrink-0 opacity-60" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              mode === "ask"
                ? "Ask a question — e.g. Which opportunities need attention?"
                : "Find companies, contacts, opportunities, documents, attention…"
            }
            aria-label={mode === "ask" ? "Ask SmartCRM" : "Search SmartCRM"}
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:opacity-45"
            style={{ color: "var(--command-text)" }}
          />
          <kbd
            className="hidden shrink-0 border px-1.5 py-0.5 font-mono text-[10px] sm:inline"
            style={{
              borderColor: "var(--command-border)",
              color: "var(--command-muted)",
            }}
          >
            esc
          </kbd>
        </div>

        {mode === "search" && query.trim() ? (
          <FilterTransparencyBar
            entityLabel="Results"
            filteredCount={flatResults.length}
            totalCount={scopedIndex.length}
            activeFilters={searchActiveFilters}
            onClearAll={() => setQuery("")}
            className="border-x-0 border-t-0 bg-[var(--command-subtle)]"
          />
        ) : null}

        {mode === "ask" && query.trim() && askResult?.items.length ? (
          <FilterTransparencyBar
            entityLabel="Related Results"
            filteredCount={askResult.items.length}
            totalCount={scopedIndex.length}
            activeFilters={searchActiveFilters}
            onClearAll={() => setQuery("")}
            className="border-x-0 border-t-0 bg-[var(--command-subtle)]"
          />
        ) : null}

        <div ref={listRef} className="flex-1 overflow-y-auto py-2">
          {mode === "ask" && !query.trim() ? (
            <div className="px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--command-muted)" }}>
                Suggested questions
              </p>
              <ul className="mt-2 space-y-1">
                {suggestedQuestions.map((question) => (
                  <li key={question}>
                    <button
                      type="button"
                      onClick={() => setQuery(question)}
                      className="w-full px-2 py-2 text-left text-[12px] transition-colors hover:bg-[var(--command-hover)]"
                      style={{ color: "var(--command-text)" }}
                    >
                      {question}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {mode === "ask" && askResult ? (
            <section className="px-4 py-3">
              <div
                className="border px-4 py-3"
                style={{
                  borderColor: "var(--command-border)",
                  background: "var(--command-subtle)",
                }}
              >
                <p className="text-sm font-medium leading-relaxed" style={{ color: "var(--command-text)" }}>
                  {askResult.answer}
                </p>
                <p className="mt-2 text-[11px]" style={{ color: "var(--command-muted)" }}>
                  Recommended:{" "}
                  {askResult.actionHref ? (
                    <Link
                      href={askResult.actionHref}
                      onClick={onClose}
                      className="font-semibold text-upcycle-orange hover:underline"
                    >
                      {askResult.recommendedAction}
                    </Link>
                  ) : (
                    <span className="font-semibold">{askResult.recommendedAction}</span>
                  )}
                </p>
              </div>
            </section>
          ) : null}

          {mode === "search" && commandMatches.length > 0 && query.trim() ? (
            <section className="px-2 py-1">
              <h3
                className="px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: "var(--command-muted)" }}
              >
                Commands
              </h3>
              <ul>
                {commandMatches.map((command, idx) => {
                  runningIndex += 1;
                  const item: SearchIndexItem = {
                    id: `command-${command.id}`,
                    entityType: "company",
                    name: command.label,
                    typeLabel: "Command",
                    contextPreview: command.description,
                    lastActivityLabel: "Execute",
                    lastActivityAt: "",
                    href: command.href,
                    searchText: command.keywords.join(" "),
                  };
                  return (
                    <SearchResultRow
                      key={command.id}
                      item={item}
                      active={runningIndex === activeIndex}
                      index={runningIndex}
                      onSelect={navigate}
                      onHover={setActiveIndex}
                    />
                  );
                })}
              </ul>
            </section>
          ) : null}

          {mode === "search" && relationshipBundles.length > 0 ? (
            <section className="px-2 py-1">
              <h3
                className="px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: "var(--command-muted)" }}
              >
                Relationship Results
              </h3>
              {relationshipBundles.map((bundle) => (
                <div
                  key={bundle.companyId}
                  className="mx-2 mb-2 border px-3 py-3"
                  style={{ borderColor: "var(--command-border)", background: "var(--command-subtle)" }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      router.push(bundle.href);
                      onClose();
                    }}
                    className="text-left"
                  >
                    <p className="text-sm font-semibold" style={{ color: "var(--command-text)" }}>
                      🏢 {bundle.companyName}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px]" style={{ color: "var(--command-muted)" }}>
                      <span>📍 {bundle.locationLabel}</span>
                      <span>🎯 {bundle.openOpportunities} Opportunit{bundle.openOpportunities === 1 ? "y" : "ies"}</span>
                      <span>👤 {bundle.contactCount} Contacts</span>
                      <span>💰 {bundle.pipelineValueLabel}</span>
                      {bundle.attentionCount > 0 ? <span>⚠ {bundle.attentionCount} Attention</span> : null}
                    </p>
                  </button>
                </div>
              ))}
            </section>
          ) : null}

          {flatResults.length === 0 ? (
            <p
              className="px-4 py-10 text-center text-xs"
              style={{ color: "var(--command-muted)" }}
            >
              {mode === "ask"
                ? query.trim()
                  ? "No answer available — try rephrasing your question."
                  : "Ask SmartCRM about your portfolio, relationships, and commercial progress."
                : query.trim()
                  ? `No results for "${query}"`
                  : index.length === 0
                    ? "Loading command center…"
                    : "Start typing to find anything…"}
            </p>
          ) : (
            (mode === "ask"
              ? [{ entityType: "company" as const, label: "Related Results", items: flatResults }]
              : groups
            ).map((group) => (
              <section key={`${group.entityType}-${group.label}`} className="px-2 py-1">
                <h3
                  className="px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em]"
                  style={{ color: "var(--command-muted)" }}
                >
                  {isSuggested ? `Recent ${group.label}` : group.label}
                </h3>
                <ul>
                  {group.items.map((item) => {
                    runningIndex += 1;
                    const idx = runningIndex;
                    return (
                      <SearchResultRow
                        key={item.id}
                        item={item}
                        active={idx === activeIndex}
                        index={idx}
                        onSelect={navigate}
                        onHover={setActiveIndex}
                      />
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>

        <footer
          className="flex items-center justify-between border-t px-4 py-2.5 text-[10px]"
          style={{
            borderColor: "var(--command-border)",
            background: "var(--command-subtle)",
            color: "var(--command-muted)",
          }}
        >
          <span className="font-medium">SmartCRM Command Center · Find · Ask · Do</span>
          <span className="flex items-center gap-2">
            <kbd className="border px-1 font-mono" style={{ borderColor: "var(--command-border)" }}>
              ↑↓
            </kbd>
            navigate
            <kbd className="border px-1 font-mono" style={{ borderColor: "var(--command-border)" }}>
              ↵
            </kbd>
            open
            <kbd className="hidden border px-1 font-mono sm:inline" style={{ borderColor: "var(--command-border)" }}>
              {shortcut}
            </kbd>
          </span>
        </footer>
      </div>
    </div>
  );
}
