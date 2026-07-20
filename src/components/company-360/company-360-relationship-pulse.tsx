import type { Company360Snapshot } from "@/lib/company-360-data";
import { sumPipelineValue } from "@/lib/impact-context";
import {
  NextBestActionCard,
  RelationshipHealthBadge,
  RelationshipTrendBadge,
} from "@/components/relationship/relationship-health-display";
import { IntelligenceLead } from "@/components/ui/intelligence-lead";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { ImpactContext } from "@/components/ui/impact-context";

/** Living account record — what matters and what to do next. */
export function Company360RelationshipPulse({ snapshot }: { snapshot: Company360Snapshot }) {
  const { header, intelligence, pipelines, openActions } = snapshot;
  const { healthReport, recommendedAction, riskSignals } = intelligence;
  const topRisk = riskSignals[0];
  const pipelineValue = sumPipelineValue(pipelines);

  const summary = topRisk
    ? `${topRisk.label}${topRisk.detail ? ` — ${topRisk.detail}` : ""}`
    : healthReport.summary;

  return (
    <div className="flex flex-col gap-3">
      <IntelligenceLead
        eyebrow="Living account record"
        title={healthReport.summary}
        status={
          <>
            <RelationshipHealthBadge status={intelligence.healthStatus} />
            <RelationshipTrendBadge trend={intelligence.trend} />
          </>
        }
        vitals={[
          { label: "Last contact", value: header.lastContactLabel },
          { label: "Pipeline", value: pipelineValue },
          {
            label: "Open actions",
            value: String(openActions.length),
            highlight: openActions.length > 0,
          },
          { label: "Deals", value: String(pipelines.length) },
        ]}
        summary={summary}
        action={<NextBestActionCard action={recommendedAction} />}
      />

      {topRisk && riskSignals.length > 1 ? (
        <CollapsibleSection
          title={`${riskSignals.length - 1} more risk${riskSignals.length === 2 ? "" : "s"}`}
          tier="nice-to-have"
        >
          <ul className="space-y-3">
            {riskSignals.slice(1).map((signal) => (
              <li key={signal.id}>
                <p
                  className={`text-sm font-semibold ${
                    signal.severity === "critical" ? "text-red-700" : "text-upcycle-orange"
                  }`}
                >
                  {signal.label}
                </p>
                {signal.detail ? (
                  <p className="mt-0.5 text-[11px] text-carbon-blue/55">{signal.detail}</p>
                ) : null}
                <ImpactContext items={signal.impact} />
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      ) : null}
    </div>
  );
}
