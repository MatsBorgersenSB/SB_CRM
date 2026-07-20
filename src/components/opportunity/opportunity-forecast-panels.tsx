import type {
  OpportunityHealthDistribution,
  RevenueForecast,
} from "@/lib/opportunity-command-center-data";
import { OPPORTUNITY_HEALTH_STYLES } from "@/lib/opportunity-intelligence-engine";
import type { OpportunityHealthStatus } from "@/lib/opportunity-intelligence-engine";

const STATUS_ORDER: OpportunityHealthStatus[] = [
  "Strategic",
  "Strong",
  "Healthy",
  "Weak",
  "At Risk",
];

export function OpportunityRevenueForecastPanel({
  forecast,
}: {
  forecast: RevenueForecast;
}) {
  return (
    <section className="dashboard-card overflow-hidden border-t-2 border-violet-500/20">
      <header className="border-b border-carbon-blue/8 px-5 py-4">
        <h2 className="text-sm font-semibold text-carbon-blue">Revenue forecast</h2>
        <p className="mt-0.5 text-[11px] text-carbon-blue/45">
          Pipeline value, intelligence-weighted forecast, and at-risk revenue
        </p>
      </header>
      <dl className="grid grid-cols-1 gap-px bg-carbon-blue/6 sm:grid-cols-3">
        {[
          { label: "Pipeline value", value: forecast.pipelineValueLabel, accent: false },
          { label: "Weighted forecast", value: forecast.weightedForecastLabel, accent: true },
          { label: "At risk revenue", value: forecast.atRiskRevenueLabel, accent: true, risk: true },
        ].map((cell) => (
          <div
            key={cell.label}
            className="flex flex-col gap-1 bg-[var(--dashboard-card)] px-5 py-4"
          >
            <dt className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              {cell.label}
            </dt>
            <dd
              className={`text-xl font-semibold tabular-nums ${
                cell.risk ? "text-red-600" : cell.accent ? "text-upcycle-orange" : "text-carbon-blue"
              }`}
            >
              {cell.value}
            </dd>
            <dd className="text-[10px] text-carbon-blue/40">
              {cell.label === "At risk revenue"
                ? `${forecast.atRiskDealCount} deals flagged`
                : `${forecast.dealCount} active opportunities`}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function OpportunityHealthDistributionPanel({
  distribution,
}: {
  distribution: OpportunityHealthDistribution;
}) {
  const max = Math.max(...distribution.map((d) => d.count), 1);

  return (
    <section className="dashboard-card overflow-hidden">
      <header className="border-b border-carbon-blue/8 px-5 py-4">
        <h2 className="text-sm font-semibold text-carbon-blue">Opportunity health distribution</h2>
        <p className="mt-0.5 text-[11px] text-carbon-blue/45">
          Portfolio health across all active opportunities
        </p>
      </header>
      <ul className="space-y-3 px-5 py-5">
        {STATUS_ORDER.map((status) => {
          const row = distribution.find((d) => d.status === status);
          const count = row?.count ?? 0;
          return (
            <li key={status} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span
                  className={`border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${OPPORTUNITY_HEALTH_STYLES[status]}`}
                >
                  {status}
                </span>
                <span className="font-semibold tabular-nums text-carbon-blue/60">{count}</span>
              </div>
              <div className="h-1.5 overflow-hidden bg-carbon-blue/8">
                <div
                  className="h-full bg-upcycle-orange/70 transition-all"
                  style={{ width: `${Math.round((count / max) * 100)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
