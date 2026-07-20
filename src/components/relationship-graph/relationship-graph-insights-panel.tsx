"use client";

import type { GraphInsight } from "@/types/relationship-graph";
import { getGraphInsightExplanation } from "@/lib/relationship-graph-engine";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

export function RelationshipGraphInsightsPanel({ insights }: { insights: GraphInsight[] }) {
  if (insights.length === 0) {
    return (
      <div className="dashboard-card px-5 py-6">
        <p className="text-sm font-semibold text-carbon-blue">Graph intelligence</p>
        <p className="mt-2 text-[11px] text-carbon-blue/45">
          No structural risks detected — relationship network appears connected.
        </p>
      </div>
    );
  }

  const topInsight = insights[0];

  return (
    <section className="dashboard-card overflow-hidden">
      <header className="border-b border-carbon-blue/8 px-5 py-3">
        <h2 className="text-sm font-semibold text-carbon-blue">Graph intelligence</h2>
        <p className="mt-0.5 text-[11px] text-carbon-blue/45">Structural risks in your network</p>
      </header>

      <div className="px-5 py-4">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
              topInsight.severity === "critical"
                ? "border-red-500/30 bg-red-500/8 text-red-700"
                : topInsight.severity === "warning"
                  ? "border-upcycle-orange/30 bg-upcycle-orange/8 text-upcycle-orange"
                  : "border-carbon-blue/15 bg-carbon-blue/5 text-carbon-blue/55"
            }`}
          >
            {topInsight.severity}
          </span>
          <p className="text-sm font-medium text-carbon-blue">{topInsight.label}</p>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-carbon-blue/55">{topInsight.detail}</p>
      </div>

      {insights.length > 1 ? (
        <CollapsibleSection
          title={`${insights.length - 1} more graph signal${insights.length === 2 ? "" : "s"}`}
          tier="nice-to-have"
          className="border-t border-carbon-blue/8"
        >
          <ul className="space-y-3">
            {insights.slice(1).map((insight) => (
              <li key={insight.id}>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                      insight.severity === "critical"
                        ? "border-red-500/30 bg-red-500/8 text-red-700"
                        : insight.severity === "warning"
                          ? "border-upcycle-orange/30 bg-upcycle-orange/8 text-upcycle-orange"
                          : "border-carbon-blue/15 bg-carbon-blue/5 text-carbon-blue/55"
                    }`}
                  >
                    {insight.severity}
                  </span>
                  <p className="text-sm font-medium text-carbon-blue">{insight.label}</p>
                </div>
                <p className="mt-1 text-[11px] text-carbon-blue/55">{insight.detail}</p>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      ) : null}

      <CollapsibleSection
        title="How graph signals work"
        tier="expert"
        className="border-t border-carbon-blue/8"
      >
        <ul className="space-y-2">
          {insights.map((insight) => (
            <li key={insight.id} className="text-[10px] text-carbon-blue/45">
              <span className="font-semibold text-carbon-blue/55">{insight.label}:</span>{" "}
              {getGraphInsightExplanation(insight.type)}
            </li>
          ))}
        </ul>
      </CollapsibleSection>
    </section>
  );
}
