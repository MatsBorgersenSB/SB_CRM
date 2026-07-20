"use client";

import Link from "next/link";
import { LayoutGrid, List, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { PipelineRow } from "@/types/pipeline";
import {
  formatDealValue,
  getLifecycleStage,
  PIPELINE_STATUSES,
  type PipelineLifecycleStage,
  type PipelineStatus,
} from "@/types/pipeline";
import { DealStageTrack } from "@/components/company-360/deal-stage-track";
import { StatusBadge } from "@/components/ui/status-badge";
import { DealLink } from "@/components/relationship/relationship-links";

type ViewMode = "cards" | "table";
type SortKey = "weighted" | "value" | "stage" | "probability";
type PhaseFilter = "all" | PipelineLifecycleStage;

const SORT_OPTIONS = [
  { key: "weighted", label: "Weighted" },
  { key: "value", label: "Value" },
  { key: "stage", label: "Stage" },
  { key: "probability", label: "Probability" },
] as const satisfies ReadonlyArray<{ key: SortKey; label: string }>;

const PHASE_FILTER_OPTIONS: Array<{ value: PhaseFilter; label: string }> = [
  { value: "all", label: "All phases" },
  { value: "sales", label: "Sales" },
  { value: "delivery", label: "Delivery" },
  { value: "production", label: "Production" },
];

const STATUS_VARIANT: Record<
  PipelineStatus,
  "active" | "success" | "pending" | "error"
> = {
  Prospecting: "pending",
  "Feedstock Analysis": "pending",
  "Contract Negotiation": "pending",
  Won: "success",
  "Reactor Manufacturing": "active",
  "Site Installation": "active",
  "Commissioning Phase": "active",
  "Live Production": "success",
  "Scheduled Maintenance": "error",
};

function weightedValue(deal: PipelineRow): number {
  return deal.salesValue * (deal.probability / 100);
}

function sortDeals(deals: PipelineRow[], sort: SortKey): PipelineRow[] {
  const next = [...deals];
  switch (sort) {
    case "value":
      return next.sort((a, b) => b.salesValue - a.salesValue);
    case "stage":
      return next.sort(
        (a, b) => PIPELINE_STATUSES.indexOf(b.status) - PIPELINE_STATUSES.indexOf(a.status),
      );
    case "probability":
      return next.sort((a, b) => b.probability - a.probability);
    default:
      return next.sort((a, b) => weightedValue(b) - weightedValue(a));
  }
}

function filterDeals(
  deals: PipelineRow[],
  search: string,
  phaseFilter: PhaseFilter,
): PipelineRow[] {
  const query = search.trim().toLowerCase();

  return deals.filter((deal) => {
    if (phaseFilter !== "all" && getLifecycleStage(deal.status) !== phaseFilter) {
      return false;
    }

    if (!query) return true;

    const haystack = [
      deal.id,
      deal.assetName,
      deal.companyRole,
      deal.status,
      deal.targetFeedstock,
      deal.currentMilestone,
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

function Company360DealsCards({ deals }: { deals: PipelineRow[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {deals.map((deal) => (
        <article
          key={deal.id}
          className="dashboard-card flex flex-col overflow-hidden transition-shadow hover:shadow-sm"
        >
          <header className="border-b border-carbon-blue/8 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] text-carbon-blue/40">{deal.id}</p>
                <h3 className="mt-1 text-base font-semibold text-carbon-blue">
                  <DealLink dealId={deal.id}>{deal.assetName}</DealLink>
                </h3>
              </div>
              <span className="shrink-0 border border-carbon-blue/12 px-2 py-0.5 text-[9px] font-semibold text-carbon-blue/55">
                {deal.companyRole}
              </span>
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-4 px-5 py-4">
            <DealStageTrack status={deal.status} />

            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                  Deal value
                </dt>
                <dd className="mt-0.5 font-semibold text-carbon-blue">
                  {formatDealValue(deal.currency, deal.salesValue)}
                </dd>
              </div>
              <div>
                <dt className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                  Weighted
                </dt>
                <dd className="mt-0.5 font-semibold text-upcycle-orange">
                  {formatDealValue(deal.currency, weightedValue(deal))}
                </dd>
              </div>
              <div>
                <dt className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                  Probability
                </dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-carbon-blue">
                  {deal.probability}%
                </dd>
              </div>
              <div>
                <dt className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                  Feedstock
                </dt>
                <dd className="mt-0.5 font-medium text-carbon-blue/70">{deal.targetFeedstock}</dd>
              </div>
            </dl>

            <p className="text-[11px] text-carbon-blue/50">
              Milestone:{" "}
              <span className="font-medium text-carbon-blue/70">{deal.currentMilestone}</span>
            </p>
          </div>

          <footer className="border-t border-carbon-blue/8 px-5 py-3">
            <DealLink dealId={deal.id} className="text-[11px] font-semibold text-upcycle-orange">
              Open Deal 360 →
            </DealLink>
          </footer>
        </article>
      ))}
    </div>
  );
}

function Company360DealsTable({ deals }: { deals: PipelineRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="border-b border-carbon-blue/8 bg-carbon-blue/[0.03]">
            {["Deal", "Stage", "Value", "Weighted", "Prob.", "Milestone"].map((header) => (
              <th
                key={header}
                className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => (
            <tr
              key={deal.id}
              className="border-b border-carbon-blue/6 last:border-b-0 hover:bg-carbon-blue/[0.02]"
            >
              <td className="px-3 py-2.5">
                <DealLink dealId={deal.id} className="group block">
                  <p className="text-xs font-semibold text-carbon-blue group-hover:text-upcycle-orange">
                    {deal.assetName}
                  </p>
                  <p className="mt-0.5 font-mono text-[9px] text-carbon-blue/35">{deal.id}</p>
                </DealLink>
              </td>
              <td className="px-3 py-2.5">
                <StatusBadge label={deal.status} variant={STATUS_VARIANT[deal.status]} />
              </td>
              <td className="px-3 py-2.5 text-[11px] font-semibold tabular-nums text-carbon-blue">
                {formatDealValue(deal.currency, deal.salesValue)}
              </td>
              <td className="px-3 py-2.5 text-[11px] font-semibold tabular-nums text-upcycle-orange">
                {formatDealValue(deal.currency, weightedValue(deal))}
              </td>
              <td className="px-3 py-2.5 text-[11px] tabular-nums text-carbon-blue/70">
                {deal.probability}%
              </td>
              <td className="max-w-[180px] truncate px-3 py-2.5 text-[11px] text-carbon-blue/60">
                {deal.currentMilestone}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Company360DealsTab({ pipelines }: { pipelines: PipelineRow[] }) {
  const [view, setView] = useState<ViewMode>("cards");
  const [sort, setSort] = useState<SortKey>("weighted");
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => filterDeals(pipelines, search, phaseFilter),
    [pipelines, search, phaseFilter],
  );

  const sorted = useMemo(() => sortDeals(filtered, sort), [filtered, sort]);

  const filtersActive = search.trim().length > 0 || phaseFilter !== "all";

  if (pipelines.length === 0) {
    return (
      <section className="dashboard-card flex min-h-[280px] flex-col items-center justify-center px-6 py-12 text-center">
        <p className="text-sm font-medium text-carbon-blue/70">No active opportunities</p>
        <p className="mt-1 max-w-sm text-xs text-carbon-blue/45">
          When deals are linked to this company, they appear here with full pipeline context.
        </p>
        <Link
          href="/deals"
          className="mt-4 border border-upcycle-orange/30 bg-upcycle-orange/10 px-3 py-1.5 text-[11px] font-semibold text-upcycle-orange"
        >
          Open pipeline
        </Link>
      </section>
    );
  }

  return (
    <section className="dashboard-card overflow-hidden">
      <header className="flex flex-col gap-3 border-b border-carbon-blue/8 px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-carbon-blue">Opportunities</h2>
            <p className="mt-0.5 text-[10px] text-carbon-blue/45">
              {filtersActive
                ? `${sorted.length} of ${pipelines.length} shown`
                : `${pipelines.length} deal${pipelines.length === 1 ? "" : "s"}`}
              {" · "}
              Sorted by {SORT_OPTIONS.find((option) => option.key === sort)?.label.toLowerCase()}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center border border-carbon-blue/10">
              <button
                type="button"
                onClick={() => setView("cards")}
                aria-label="Card view"
                className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                  view === "cards"
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
              placeholder="Search deal, ID, feedstock, milestone…"
              className="w-full border border-carbon-blue/10 bg-white py-1.5 pl-7 pr-2 text-xs text-carbon-blue placeholder:text-carbon-blue/35"
            />
          </label>
          <select
            value={phaseFilter}
            onChange={(event) => setPhaseFilter(event.target.value as PhaseFilter)}
            className="border border-carbon-blue/10 bg-white px-2 py-1.5 text-xs text-carbon-blue"
          >
            {PHASE_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {filtersActive ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPhaseFilter("all");
              }}
              className="shrink-0 text-[10px] font-semibold text-upcycle-orange hover:underline"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </header>

      {sorted.length === 0 ? (
        <p className="px-5 py-8 text-center text-[11px] text-carbon-blue/50">
          No deals match your filters.
        </p>
      ) : view === "table" ? (
        <Company360DealsTable deals={sorted} />
      ) : (
        <div className="p-4">
          <Company360DealsCards deals={sorted} />
        </div>
      )}
    </section>
  );
}
