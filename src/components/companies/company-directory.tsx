"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Info, LayoutGrid, List, Search } from "lucide-react";
import { CompanyTable } from "@/components/companies/company-table";
import type { CompanyRelationshipSummary } from "@/lib/relationship-intelligence";
import { getHealthScoreExplanation } from "@/lib/relationship-health-engine";
import type { RelationshipHealthStatus } from "@/lib/relationship-health-engine";
import {
  HEALTH_STATUS_STYLES,
} from "@/components/relationship/relationship-health-display";
import { formatCompanyLocation, type CompanyIndustry } from "@/types/company";
import { CompanyIndustryOptions } from "@/components/companies/company-industry-options";

type SortKey = "score" | "name" | "contact";
type ViewMode = "grid" | "table";
type HealthFilter = "all" | "attention" | RelationshipHealthStatus;

const SORT_OPTIONS = [
  { key: "score", label: "Health" },
  { key: "name", label: "Name" },
  { key: "contact", label: "Recent" },
] as const satisfies ReadonlyArray<{ key: SortKey; label: string }>;

const HEALTH_FILTER_OPTIONS: Array<{ value: HealthFilter; label: string }> = [
  { value: "all", label: "All health" },
  { value: "attention", label: "Needs attention" },
  { value: "At Risk", label: "At Risk" },
  { value: "Weak", label: "Weak" },
  { value: "Healthy", label: "Healthy" },
  { value: "Strong", label: "Strong" },
  { value: "Strategic", label: "Strategic" },
];

function sortSummaries(
  items: CompanyRelationshipSummary[],
  sort: SortKey,
): CompanyRelationshipSummary[] {
  const next = [...items];
  switch (sort) {
    case "name":
      return next.sort((a, b) => a.company.Title.localeCompare(b.company.Title));
    case "contact":
      return next.sort((a, b) => {
        const aTime = a.lastContactAt ? new Date(a.lastContactAt).getTime() : 0;
        const bTime = b.lastContactAt ? new Date(b.lastContactAt).getTime() : 0;
        return bTime - aTime;
      });
    default:
      return next.sort((a, b) => a.healthScore - b.healthScore);
  }
}

function filterSummaries(
  summaries: CompanyRelationshipSummary[],
  search: string,
  healthFilter: HealthFilter,
  industryFilter: CompanyIndustry | "all",
): CompanyRelationshipSummary[] {
  const query = search.trim().toLowerCase();

  return summaries.filter((summary) => {
    if (healthFilter === "attention") {
      if (summary.healthStatus !== "Weak" && summary.healthStatus !== "At Risk") {
        return false;
      }
    } else if (healthFilter !== "all" && summary.healthStatus !== healthFilter) {
      return false;
    }

    if (industryFilter !== "all" && summary.company.Industry !== industryFilter) {
      return false;
    }

    if (!query) return true;

    const company = summary.company;
    const haystack = [
      company.Title,
      company.CompanyID,
      company.Industry,
      company.City,
      company.Domain,
      formatCompanyLocation(company),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

function toggleButtonClass(active: boolean): string {
  return `border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
    active
      ? "border-upcycle-orange/30 bg-upcycle-orange/10 text-upcycle-orange"
      : "border-carbon-blue/10 text-carbon-blue/45 hover:text-carbon-blue"
  }`;
}

export function CompanyDirectory({
  summaries,
  onSelect,
}: {
  summaries: CompanyRelationshipSummary[];
  onSelect: (companyId: string) => void;
}) {
  const [sort, setSort] = useState<SortKey>("score");
  const [view, setView] = useState<ViewMode>("table");
  const [search, setSearch] = useState("");
  const [healthFilter, setHealthFilter] = useState<HealthFilter>("all");
  const [industryFilter, setIndustryFilter] = useState<CompanyIndustry | "all">("all");
  const [showExplanation, setShowExplanation] = useState(false);

  const filtered = useMemo(
    () => filterSummaries(summaries, search, healthFilter, industryFilter),
    [summaries, search, healthFilter, industryFilter],
  );

  const sorted = useMemo(() => sortSummaries(filtered, sort), [filtered, sort]);

  const filtersActive =
    search.trim().length > 0 || healthFilter !== "all" || industryFilter !== "all";

  return (
    <section className="dashboard-card overflow-hidden">
      <header className="flex flex-col gap-3 border-b border-carbon-blue/8 px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-carbon-blue">All companies</h2>
            <p className="mt-0.5 text-[10px] text-carbon-blue/45">
              {filtersActive
                ? `${sorted.length} of ${summaries.length} shown`
                : `${summaries.length} companies`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowExplanation((value) => !value)}
              className="inline-flex items-center gap-1 border border-carbon-blue/10 px-2 py-1 text-[10px] font-semibold text-carbon-blue/55 hover:border-upcycle-orange/25 hover:text-upcycle-orange"
            >
              <Info className="size-3" />
              Score guide
            </button>
            <div className="flex items-center border border-carbon-blue/10">
              <button
                type="button"
                onClick={() => setView("grid")}
                aria-label="Card view"
                className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                  view === "grid"
                    ? "bg-upcycle-orange/10 text-upcycle-orange"
                    : "text-carbon-blue/45 hover:text-carbon-blue"
                }`}
              >
                <LayoutGrid className="size-3" />
                Cards
              </button>
              <button
                type="button"
                onClick={() => setView("table")}
                aria-label="Table view"
                className={`inline-flex items-center gap-1 border-l border-carbon-blue/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                  view === "table"
                    ? "bg-upcycle-orange/10 text-upcycle-orange"
                    : "text-carbon-blue/45 hover:text-carbon-blue"
                }`}
              >
                <List className="size-3" />
                Table
              </button>
            </div>
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setSort(option.key)}
                className={toggleButtonClass(sort === option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-carbon-blue/35" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, ID, industry, location…"
              className="w-full border border-carbon-blue/10 bg-white py-1.5 pl-7 pr-2 text-xs text-carbon-blue placeholder:text-carbon-blue/35"
            />
          </label>
          <select
            value={healthFilter}
            onChange={(event) => setHealthFilter(event.target.value as HealthFilter)}
            className="border border-carbon-blue/10 bg-white px-2 py-1.5 text-xs text-carbon-blue"
          >
            {HEALTH_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={industryFilter}
            onChange={(event) =>
              setIndustryFilter(event.target.value as CompanyIndustry | "all")
            }
            className="border border-carbon-blue/10 bg-white px-2 py-1.5 text-xs text-carbon-blue"
          >
            <option value="all">All industries</option>
            <CompanyIndustryOptions />
          </select>
          {filtersActive ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setHealthFilter("all");
                setIndustryFilter("all");
              }}
              className="shrink-0 text-[10px] font-semibold text-upcycle-orange hover:underline"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </header>

      {showExplanation ? (
        <div className="border-b border-carbon-blue/8 bg-carbon-blue/[0.02] px-4 py-3 text-[11px] leading-relaxed text-carbon-blue/55">
          {getHealthScoreExplanation()}
        </div>
      ) : null}

      {sorted.length === 0 ? (
        <p className="px-5 py-8 text-center text-[11px] text-carbon-blue/50">
          No companies match your filters.
        </p>
      ) : view === "table" ? (
        <CompanyTable summaries={sorted} onSelect={onSelect} />
      ) : (
        <div className="grid gap-px bg-carbon-blue/6 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((summary) => (
            <button
              key={summary.company.CompanyID}
              type="button"
              onClick={() => onSelect(summary.company.CompanyID)}
              className="group flex flex-col gap-3 bg-[var(--dashboard-card)] p-4 text-left transition-colors hover:bg-carbon-blue/[0.02]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-carbon-blue group-hover:text-upcycle-orange">
                    {summary.company.Title}
                  </p>
                  <p className="mt-0.5 text-[10px] text-carbon-blue/45">
                    {summary.company.Industry}
                  </p>
                </div>
                <span
                  className={`flex size-10 shrink-0 items-center justify-center border text-sm font-bold tabular-nums ${HEALTH_STATUS_STYLES[summary.healthStatus]}`}
                >
                  {summary.healthScore}
                </span>
              </div>

              <p className="line-clamp-2 text-[11px] leading-relaxed text-carbon-blue/55">
                {summary.healthReport.recommendedAction.action}
              </p>

              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-upcycle-orange opacity-0 transition-opacity group-hover:opacity-100">
                Open Company 360
                <ArrowRight className="size-3" />
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
