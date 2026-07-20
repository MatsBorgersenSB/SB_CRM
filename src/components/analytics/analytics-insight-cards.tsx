import type { AnalyticsInsights } from "@/lib/analytics-data";

export function AnalyticsInsightCards({
  insights,
}: {
  insights: AnalyticsInsights;
}) {
  const cards = [
    {
      label: "Total System Yield Efficiency",
      value: insights.systemYieldEfficiency,
      accent: "text-carbon-blue",
    },
    {
      label: "Active Facility Conversion Rate",
      value: insights.facilityConversionRate,
      accent: "text-upcycle-orange",
    },
    {
      label: "AI Metadata Automation Match Rate",
      value: insights.aiMetadataMatchRate,
      accent: "text-flame",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="border border-carbon-blue/15 bg-white px-3 py-2.5"
        >
          <div className="mb-2 h-0.5 w-8 bg-upcycle-orange/70" />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            {card.label}
          </p>
          <p className={`mt-1 text-xs font-semibold tabular-nums ${card.accent}`}>
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}
