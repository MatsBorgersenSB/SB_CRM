"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExplainabilityBlock } from "@/components/ui/explainability-block";
import { FilterTransparencyBar } from "@/components/ui/filter-transparency-bar";
import {
  ATTIO_GROUP_ACTIONS,
  ATTIO_PILL_STATIC,
  ATTIO_SEGMENT_TRACK,
  ATTIO_STATUS_DOT,
  ATTIO_SURFACE,
  ATTIO_SURFACE_HEADER,
  ATTIO_SURFACE_MUTED,
  attioSegmentItemClass,
} from "@/lib/attio-workspace-surfaces";
import type { FilterSummaryChip } from "@/types/workspace-filters";
import {
  EXPANSION_SIGNAL_FILTERS,
  healthBand,
  healthBandLabel,
  signalMatchesFilter,
  type AccountHealthIndexView,
  type ExpansionSignalFilter,
  type ExpansionSignalView,
  type GrowthIntelligenceWorkspaceData,
  type WhitespaceMatrixCell,
} from "@/types/fs010-growth-intelligence";

function scoreTone(score: number): string {
  if (score >= 75) return "text-emerald-700 dark:text-emerald-400";
  if (score >= 50) return "text-slate-800 dark:text-slate-100";
  if (score >= 25) return "text-amber-700 dark:text-amber-400";
  return "text-thermal-red";
}

function barWidth(score: number): string {
  return `${Math.max(0, Math.min(100, score))}%`;
}

function labelizeSignalType(type: ExpansionSignalView["type"]): string {
  switch (type) {
    case "upsell":
      return "Upsell";
    case "cross_sell":
      return "Cross-sell";
    case "renewal_risk":
      return "Renewal risk";
    case "churn_risk":
      return "Churn risk";
    default:
      return type;
  }
}

function signalActionLabel(type: ExpansionSignalView["type"]): string {
  return type === "upsell" || type === "cross_sell"
    ? "Convert to Opportunity"
    : "Action Signal";
}

export function GrowthIntelligenceWorkspace({
  data,
}: {
  data: GrowthIntelligenceWorkspaceData;
}) {
  const [signalFilter, setSignalFilter] = useState<ExpansionSignalFilter>("all");

  const filteredSignals = useMemo(
    () => data.signals.filter((signal) => signalMatchesFilter(signal.type, signalFilter)),
    [data.signals, signalFilter],
  );

  const activeFilters = useMemo((): FilterSummaryChip[] => {
    if (signalFilter === "all") return [];
    const meta = EXPANSION_SIGNAL_FILTERS.find((entry) => entry.id === signalFilter);
    return [
      {
        id: "signal-type",
        label: "Type",
        value: meta?.label ?? signalFilter,
        onRemove: () => setSignalFilter("all"),
      },
    ];
  }, [signalFilter]);

  const unpitched = useMemo(
    () => data.whitespace.filter((cell) => cell.coverage === "unpitched"),
    [data.whitespace],
  );

  const featuredHealth = data.healthRecords[0] ?? null;

  return (
    <section aria-label="FS-010 Growth & Expansion Intelligence" className="flex flex-col gap-4">
      <header className={`${ATTIO_SURFACE} overflow-hidden`}>
        <div className={ATTIO_SURFACE_HEADER}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
            FS-010 · Growth & Expansion Intelligence
          </p>
          <h2 className="mt-0.5 text-[15px] font-semibold text-slate-900 dark:text-slate-50">
            Account Health, Expansion Signals & Whitespace
          </h2>
          <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
            SmartAssist proposes expansion moves — you decide. AD-001 filter transparency and
            4-part explainability are mandatory.
          </p>
        </div>
      </header>

      {featuredHealth ? (
        <AccountHealthIndexCard record={featuredHealth} all={data.healthRecords} />
      ) : (
        <p className={`${ATTIO_SURFACE_MUTED} px-4 py-6 text-[13px] text-slate-500`}>
          No Account Health Index records yet. Run the FS-010 seed to populate Acme Renewables.
        </p>
      )}

      <section className="flex flex-col gap-3" aria-label="Expansion signals">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">
              Expansion Signals
            </h3>
            <p className="mt-0.5 text-[12px] text-slate-500">
              Upsell, cross-sell, and renewal / churn risk — user-gated actions only.
            </p>
          </div>
          <div className={ATTIO_SEGMENT_TRACK} role="tablist" aria-label="Signal type filter">
            {EXPANSION_SIGNAL_FILTERS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={signalFilter === entry.id}
                onClick={() => setSignalFilter(entry.id)}
                className={attioSegmentItemClass(signalFilter === entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        <FilterTransparencyBar
          entityLabel="Signals"
          filteredCount={filteredSignals.length}
          totalCount={data.signals.length}
          activeFilters={activeFilters}
          onClearAll={
            activeFilters.length >= 1 ? () => setSignalFilter("all") : undefined
          }
        />

        {filteredSignals.length === 0 ? (
          <p className={`${ATTIO_SURFACE_MUTED} px-4 py-6 text-[13px] text-slate-500`}>
            No expansion signals match the active filters.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {filteredSignals.map((signal) => (
              <li key={signal.id} className="group">
                <ExpansionSignalCard signal={signal} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <WhitespaceMatrixOverview
        cells={data.whitespace}
        unpitchedCount={unpitched.length}
      />
    </section>
  );
}

function AccountHealthIndexCard({
  record,
  all,
}: {
  record: AccountHealthIndexView;
  all: AccountHealthIndexView[];
}) {
  const band = healthBand(record.healthScore);

  return (
    <article className={`${ATTIO_SURFACE} overflow-hidden`} aria-label="Account Health Index">
      <div className={ATTIO_SURFACE_HEADER}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              Account Health Index
            </p>
            <h3 className="mt-0.5 text-[14px] font-semibold text-slate-900 dark:text-slate-50">
              {record.companyName}
            </h3>
          </div>
          <span className={ATTIO_PILL_STATIC}>
            <span className={ATTIO_STATUS_DOT} aria-hidden />
            {healthBandLabel(band)}
          </span>
        </div>
      </div>

      <div className="grid gap-4 px-4 py-4 sm:grid-cols-4 sm:px-5">
        <ScoreMetric label="Health" score={record.healthScore} emphasize />
        <ScoreMetric label="Engagement" score={record.engagementScore} />
        <ScoreMetric label="Sentiment" score={record.sentimentScore} />
        <div className="flex flex-col justify-end">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Calculated
          </p>
          <p className="mt-1 font-mono text-[12px] tabular-nums text-slate-600 dark:text-slate-300">
            {new Date(record.calculatedAt).toLocaleString()}
          </p>
          {all.length > 1 ? (
            <p className="mt-2 text-[11px] text-slate-400">
              +{all.length - 1} other account{all.length - 1 === 1 ? "" : "s"} scored
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ScoreMetric({
  label,
  score,
  emphasize = false,
}: {
  label: string;
  score: number;
  emphasize?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </p>
      <p
        className={`mt-1 font-mono tabular-nums ${emphasize ? "text-[28px] font-semibold" : "text-[22px] font-semibold"} ${scoreTone(score)}`}
      >
        {score}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-emerald-500/80 transition-[width]"
          style={{ width: barWidth(score) }}
        />
      </div>
    </div>
  );
}

function ExpansionSignalCard({ signal }: { signal: ExpansionSignalView }) {
  const href = signal.opportunityId
    ? `/deals/${encodeURIComponent(signal.opportunityId)}`
    : `/companies`;

  return (
    <ExplainabilityBlock
      title={signal.title}
      observation={signal.observation}
      reasoning={signal.reasoning}
      recommendedAction={signal.recommendation}
      expectedOutcome={signal.expectedOutcome}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={ATTIO_PILL_STATIC}>{labelizeSignalType(signal.type)}</span>
            <span className={ATTIO_PILL_STATIC}>{signal.status}</span>
            <span className="text-[11px] text-slate-500">{signal.companyName}</span>
            {signal.opportunityName ? (
              <span className="text-[11px] text-slate-400">· {signal.opportunityName}</span>
            ) : null}
          </div>
          <div className={ATTIO_GROUP_ACTIONS}>
            <Link
              href={href}
              className="inline-flex rounded-md border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              {signalActionLabel(signal.type)}
            </Link>
          </div>
        </div>
      }
    />
  );
}

function WhitespaceMatrixOverview({
  cells,
  unpitchedCount,
}: {
  cells: WhitespaceMatrixCell[];
  unpitchedCount: number;
}) {
  const byCompany = useMemo(() => {
    const map = new Map<string, WhitespaceMatrixCell[]>();
    for (const cell of cells) {
      const list = map.get(cell.companyId) ?? [];
      list.push(cell);
      map.set(cell.companyId, list);
    }
    return [...map.entries()];
  }, [cells]);

  return (
    <section className={`${ATTIO_SURFACE} overflow-hidden`} aria-label="Whitespace Matrix">
      <div className={ATTIO_SURFACE_HEADER}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              Whitespace Matrix
            </p>
            <h3 className="mt-0.5 text-[14px] font-semibold text-slate-900 dark:text-slate-50">
              Un-pitched solution categories
            </h3>
          </div>
          <span className="font-mono text-[12px] tabular-nums text-slate-500">
            {unpitchedCount} unpitched
          </span>
        </div>
      </div>

      {byCompany.length === 0 ? (
        <p className="px-4 py-6 text-[13px] text-slate-500">No accounts in matrix scope.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-800">
                <th className="px-4 py-2.5 font-semibold text-slate-500">Account</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500">Systems</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500">Products</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500">Services</th>
              </tr>
            </thead>
            <tbody>
              {byCompany.map(([companyId, companyCells]) => {
                const name = companyCells[0]?.companyName ?? companyId;
                const cellFor = (categoryId: string) =>
                  companyCells.find((cell) => cell.categoryId === categoryId);
                return (
                  <tr
                    key={companyId}
                    className="group border-b border-slate-100 transition-colors hover:bg-slate-50/80 dark:border-slate-900 dark:hover:bg-slate-900/40"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                      {name}
                    </td>
                    {(["system", "product", "service"] as const).map((categoryId) => {
                      const cell = cellFor(categoryId);
                      const coverage = cell?.coverage ?? "unpitched";
                      return (
                        <td key={categoryId} className="px-3 py-3">
                          <CoverageBadge coverage={coverage} />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CoverageBadge({ coverage }: { coverage: WhitespaceMatrixCell["coverage"] }) {
  if (coverage === "pitched") {
    return (
      <span className="inline-flex rounded-md border border-emerald-500/25 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        Pitched
      </span>
    );
  }
  if (coverage === "partial") {
    return (
      <span className="inline-flex rounded-md border border-amber-500/25 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
        Partial
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-md border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
      Un-pitched
    </span>
  );
}
