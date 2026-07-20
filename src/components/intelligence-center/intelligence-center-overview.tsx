import type { IntelligenceCenterOverview } from "@/lib/intelligence-center-data";

function KpiCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 border border-carbon-blue/8 bg-[var(--dashboard-card)] px-5 py-4">
      <dt className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
        {label}
      </dt>
      <dd
        className={`text-2xl font-semibold tabular-nums ${
          accent ? "text-upcycle-orange" : "text-carbon-blue"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

export function IntelligenceCenterOverviewRibbon({
  overview,
  timestamp,
}: {
  overview: IntelligenceCenterOverview;
  timestamp: string;
}) {
  return (
    <header className="dashboard-card overflow-hidden">
      <div className="px-6 py-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-carbon-blue/40">
          What needs attention across your portfolio
        </p>
        <p className="mt-2 text-sm text-carbon-blue/55">
          Updated {timestamp}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-px bg-carbon-blue/6 sm:grid-cols-4">
        <KpiCell label="At risk" value={overview.atRiskCount} accent />
        <KpiCell label="Stalled deals" value={overview.stalledDeals} accent />
        <KpiCell label="Open commitments" value={overview.openCommitments} accent />
        <KpiCell label="Portfolio health" value={overview.averageHealthScore} />
      </dl>
    </header>
  );
}
