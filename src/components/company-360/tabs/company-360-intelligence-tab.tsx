import type { Company360IntelligenceView } from "@/lib/company-360-data";
import { ImpactContext } from "@/components/ui/impact-context";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { IntelligenceLead } from "@/components/ui/intelligence-lead";
import {
  NextBestActionCard,
  RelationshipHealthBadge,
  RelationshipHealthBreakdown,
  RelationshipTrendBadge,
} from "@/components/relationship/relationship-health-display";

const SEVERITY_STYLES = {
  critical: "border-red-500/25 bg-red-500/5 text-red-700",
  warning: "border-upcycle-orange/25 bg-upcycle-orange/5 text-upcycle-orange",
  info: "border-carbon-blue/15 bg-carbon-blue/[0.02] text-carbon-blue/65",
} as const;

export function Company360IntelligenceTab({
  intelligence,
}: {
  intelligence: Company360IntelligenceView;
}) {
  const { healthReport, recommendedAction, riskSignals } = intelligence;
  const topRisk = riskSignals[0];

  return (
    <div className="flex flex-col gap-3">
      <IntelligenceLead
        eyebrow="Deep intelligence"
        title={healthReport.summary}
        status={
          <>
            <RelationshipHealthBadge status={intelligence.healthStatus} />
            <RelationshipTrendBadge trend={intelligence.trend} />
          </>
        }
        vitals={[
          { label: "Health score", value: String(intelligence.healthScore) },
          { label: "Risk signals", value: String(riskSignals.length), highlight: riskSignals.length > 0 },
        ]}
        summary={
          topRisk
            ? `${topRisk.label}${topRisk.detail ? ` — ${topRisk.detail}` : ""}`
            : "No active risk signals — relationship is on track."
        }
        action={<NextBestActionCard action={recommendedAction} />}
      />

      {topRisk && riskSignals.length > 1 ? (
        <CollapsibleSection
          title={`${riskSignals.length - 1} more risk signal${riskSignals.length === 2 ? "" : "s"}`}
          tier="nice-to-have"
        >
          <ul className="space-y-3">
            {riskSignals.slice(1).map((signal) => (
              <li
                key={signal.id}
                className={`border px-3 py-2.5 text-[11px] ${SEVERITY_STYLES[signal.severity]}`}
              >
                <p className="font-semibold">{signal.label}</p>
                <p className="mt-0.5 opacity-80">{signal.detail}</p>
                <ImpactContext items={signal.impact} />
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      ) : null}

      <CollapsibleSection
        title="How is health scored?"
        description="Component breakdown — expert detail"
        tier="expert"
      >
        <RelationshipHealthBreakdown report={healthReport} />
      </CollapsibleSection>

      {intelligence.suggestedActions.length > 0 ? (
        <CollapsibleSection title="Additional steps" tier="expert">
          <ol className="list-decimal space-y-2 pl-4 text-sm text-carbon-blue/70">
            {intelligence.suggestedActions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ol>
        </CollapsibleSection>
      ) : null}
    </div>
  );
}
