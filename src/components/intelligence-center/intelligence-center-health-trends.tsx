import Link from "next/link";
import type { IntelligenceCenterHealthTrends } from "@/lib/intelligence-center-data";
import { IntelligenceCenterItemRow } from "@/components/intelligence-center/intelligence-center-item-row";
import {
  HEALTH_STATUS_STYLES,
  TREND_STYLES,
} from "@/components/relationship/relationship-health-display";
import type { RelationshipHealthStatus, RelationshipTrend } from "@/lib/relationship-health-engine";

const STATUS_ORDER: RelationshipHealthStatus[] = [
  "Strategic",
  "Strong",
  "Healthy",
  "Weak",
  "At Risk",
];

const TREND_ORDER: RelationshipTrend[] = ["Improving", "Stable", "Declining"];

export function IntelligenceCenterHealthTrends({
  trends,
}: {
  trends: IntelligenceCenterHealthTrends;
}) {
  const maxStatus = Math.max(...trends.statusDistribution.map((s) => s.count), 1);
  const maxTrend = Math.max(...trends.trendDistribution.map((t) => t.count), 1);

  return (
    <section className="dashboard-card overflow-hidden">
      <header className="border-b border-carbon-blue/8 px-5 py-4">
        <h2 className="text-sm font-semibold text-carbon-blue">Relationship health trends</h2>
        <p className="mt-0.5 text-[11px] text-carbon-blue/45">{trends.narrative}</p>
      </header>

      <div className="grid gap-px bg-carbon-blue/6 lg:grid-cols-2">
        <div className="space-y-4 bg-[var(--dashboard-card)] p-5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Health distribution
          </h3>
          <ul className="space-y-2.5">
            {STATUS_ORDER.map((status) => {
              const row = trends.statusDistribution.find((s) => s.status === status);
              const count = row?.count ?? 0;
              const width = `${Math.round((count / maxStatus) * 100)}%`;
              return (
                <li key={status} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span
                      className={`border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${HEALTH_STATUS_STYLES[status]}`}
                    >
                      {status}
                    </span>
                    <span className="font-semibold tabular-nums text-carbon-blue/60">{count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden bg-carbon-blue/8">
                    <div
                      className="h-full bg-upcycle-orange/70 transition-all"
                      style={{ width }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="space-y-4 bg-[var(--dashboard-card)] p-5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Momentum distribution
          </h3>
          <ul className="space-y-2.5">
            {TREND_ORDER.map((trend) => {
              const row = trends.trendDistribution.find((t) => t.trend === trend);
              const count = row?.count ?? 0;
              const width = `${Math.round((count / maxTrend) * 100)}%`;
              return (
                <li key={trend} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className={`font-semibold uppercase tracking-wider ${TREND_STYLES[trend]}`}>
                      {trend === "Improving" ? "↑" : trend === "Declining" ? "↓" : "→"} {trend}
                    </span>
                    <span className="font-semibold tabular-nums text-carbon-blue/60">{count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden bg-carbon-blue/8">
                    <div
                      className={`h-full transition-all ${
                        trend === "Improving"
                          ? "bg-emerald-500/70"
                          : trend === "Declining"
                            ? "bg-red-500/60"
                            : "bg-carbon-blue/30"
                      }`}
                      style={{ width }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="grid gap-px border-t border-carbon-blue/6 bg-carbon-blue/6 lg:grid-cols-2">
        <div className="bg-[var(--dashboard-card)]">
          <div className="flex items-center justify-between border-b border-carbon-blue/8 px-4 py-3">
            <h3 className="text-[11px] font-semibold text-carbon-blue">Fastest improving</h3>
            <Link href="/companies" className="text-[10px] font-semibold text-upcycle-orange">
              Directory
            </Link>
          </div>
          {trends.improving.length === 0 ? (
            <p className="px-4 py-6 text-xs text-carbon-blue/45">No improving trends detected.</p>
          ) : (
            trends.improving.map((item) => (
              <IntelligenceCenterItemRow key={`improving-${item.id}`} item={item} />
            ))
          )}
        </div>

        <div className="bg-[var(--dashboard-card)]">
          <div className="flex items-center justify-between border-b border-carbon-blue/8 px-4 py-3">
            <h3 className="text-[11px] font-semibold text-carbon-blue">Declining momentum</h3>
            <Link href="/intelligence" className="text-[10px] font-semibold text-upcycle-orange">
              Refresh
            </Link>
          </div>
          {trends.declining.length === 0 ? (
            <p className="px-4 py-6 text-xs text-carbon-blue/45">No declining trends detected.</p>
          ) : (
            trends.declining.map((item) => (
              <IntelligenceCenterItemRow key={`declining-${item.id}`} item={item} />
            ))
          )}
        </div>
      </div>
    </section>
  );
}
