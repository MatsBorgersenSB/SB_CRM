import type { ExecutivePipelineKpis } from "@/lib/pipeline-kpis";

const FUNNEL_LABELS = {
  sales: "Sales",
  delivery: "Delivery",
  production: "Production",
} as const;

export function ExecutiveKpiRibbon({ kpis }: { kpis: ExecutivePipelineKpis }) {
  const cards = [
    {
      key: "weighted-value",
      label: "Total Weighted Deal Value",
      value: kpis.totalWeightedPipelineValueLabel,
      accent: "text-upcycle-orange",
      detail: "Σ Sales Value × Probability %",
    },
    {
      key: "deal-funnel",
      label: "Deal Funnel Breakdown",
      value: `${kpis.dealFunnel.sales} / ${kpis.dealFunnel.delivery} / ${kpis.dealFunnel.production}`,
      accent: "text-carbon-blue",
      detail: `${FUNNEL_LABELS.sales} · ${FUNNEL_LABELS.delivery} · ${FUNNEL_LABELS.production}`,
    },
    {
      key: "fleet-capacity",
      label: "Total Contracted Fleet Capacity",
      value: `${kpis.totalContractedFleetCapacity.toLocaleString("en-US")} kg/h`,
      accent: "text-flame",
      detail: `${kpis.activeSystemCount} active reactor systems`,
    },
  ];

  return (
    <section className="border border-carbon-blue/15 bg-white">
      <header className="border-b border-carbon-blue/10 px-3 py-2">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
          Executive Industrial KPI Summary
        </h2>
      </header>
      <div className="grid grid-cols-3 gap-px bg-carbon-blue/10">
        {cards.map((card, index) => (
          <div key={`kpi-ribbon-${index}`} className="bg-white px-3 py-2.5">
            <div className="mb-2 h-0.5 w-8 bg-upcycle-orange/70" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              {card.label}
            </p>
            <p className={`mt-1 text-sm font-semibold tabular-nums ${card.accent}`}>
              {card.value}
            </p>
            <p className="mt-0.5 text-[9px] text-carbon-blue/45">{card.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
