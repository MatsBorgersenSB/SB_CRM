"use client";

import Link from "next/link";
import { formatDealValue } from "@/types/pipeline";
import type { PipelineRow } from "@/types/pipeline";
import type { OpportunityRevenueAssessment } from "@/types/revenue-intelligence";
import { FORECAST_BUCKET_LABELS } from "@/types/revenue-intelligence";

const BUCKET_COLORS = {
  committed: "bg-emerald-500/70",
  likely: "bg-upcycle-orange/70",
  possible: "bg-amber-400/70",
  strategic: "bg-carbon-blue/30",
} as const;

export function RevenueOpportunityCard({ opp }: { opp: OpportunityRevenueAssessment }) {
  return (
    <Link
      href={opp.href}
      className="block rounded-lg border border-carbon-blue/10 px-3 py-2.5 transition-colors hover:border-upcycle-orange/25 hover:bg-upcycle-orange/[0.02]"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold text-carbon-blue">{opp.dealName}</p>
          <p className="text-[10px] text-carbon-blue/50">
            {opp.companyName ?? "Unlinked"} · Tier {opp.qualificationTier}
          </p>
        </div>
        <span className="shrink-0 text-[10px] font-bold tabular-nums text-carbon-blue/60">
          {opp.probabilityOfSuccess}%
        </span>
      </div>
      <p className="mt-1 text-[10px] text-carbon-blue/55">
        {formatDealValue(opp.currency as PipelineRow["currency"], opp.revenuePotential)} lifetime ·{" "}
        {opp.expectedRevenueWindow}
      </p>
      <p className="mt-0.5 text-[9px] text-carbon-blue/40">
        {FORECAST_BUCKET_LABELS[opp.forecastBucket]}
      </p>
    </Link>
  );
}

export function RevenueForecastPanel({
  forecast,
}: {
  forecast: import("@/types/revenue-intelligence").HorizonForecast;
}) {
  const segments = [
    { key: "committed" as const, value: forecast.committed },
    { key: "likely" as const, value: forecast.likely },
    { key: "possible" as const, value: forecast.possible },
    { key: "strategic" as const, value: forecast.strategic },
  ];
  const max = Math.max(...segments.map((s) => s.value), 1);

  return (
    <article className="dashboard-card p-4 sm:p-5">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-carbon-blue/40">
          {forecast.horizonLabel}
        </h3>
        <span className="text-sm font-bold tabular-nums text-carbon-blue">
          {forecast.totalLabel}
        </span>
      </header>

      <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-carbon-blue/8">
        {segments.map((seg) =>
          seg.value > 0 ? (
            <div
              key={seg.key}
              className={`${BUCKET_COLORS[seg.key]}`}
              style={{ width: `${(seg.value / max) * 100}%` }}
              title={`${FORECAST_BUCKET_LABELS[seg.key]}: ${formatDealValue(forecast.currency as PipelineRow["currency"], seg.value)}`}
            />
          ) : null,
        )}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {segments.map((seg) => (
          <div key={seg.key}>
            <dt className="text-[8px] font-bold uppercase tracking-wider text-carbon-blue/35">
              {FORECAST_BUCKET_LABELS[seg.key]}
            </dt>
            <dd className="text-[11px] font-semibold tabular-nums text-carbon-blue">
              {formatDealValue(forecast.currency as PipelineRow["currency"], seg.value)}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

export function SalesPathStrip({ path }: { path: OpportunityRevenueAssessment["salesPath"] }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {path.map((stage, index) => (
        <div key={stage.id} className="flex items-center gap-1">
          <span
            className={`rounded px-2 py-0.5 text-[9px] font-semibold ${
              stage.status === "completed"
                ? "bg-emerald-500/15 text-emerald-800"
                : stage.status === "current"
                  ? "bg-upcycle-orange/15 text-upcycle-orange"
                  : "bg-carbon-blue/5 text-carbon-blue/40"
            }`}
            title={`${stage.probability}%`}
          >
            {stage.label}
          </span>
          {index < path.length - 1 ? (
            <span className="text-[9px] text-carbon-blue/25">→</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
