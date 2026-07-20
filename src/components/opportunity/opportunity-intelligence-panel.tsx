"use client";

import { useMemo } from "react";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { computeOpportunityIntelligence } from "@/lib/opportunity-intelligence-engine";
import {
  OpportunityHealthBadge,
  OpportunityIntelligenceBreakdown,
  OpportunityMomentumBadge,
  OpportunityNextBestActionCard,
} from "@/components/opportunity/opportunity-intelligence-display";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { IntelligenceLead } from "@/components/ui/intelligence-lead";

const RISK_STYLES = {
  critical: "border-red-500/25 bg-red-500/5 text-red-700",
  warning: "border-upcycle-orange/25 bg-upcycle-orange/5 text-upcycle-orange",
  info: "border-carbon-blue/15 bg-carbon-blue/[0.02] text-carbon-blue/65",
} as const;

export function OpportunityIntelligencePanel({
  pipeline,
  companies,
  activities,
  allPipelines,
}: {
  pipeline: PipelineRow;
  companies: Company[];
  activities: Activity[];
  allPipelines: PipelineRow[];
}) {
  const intelligence = useMemo(
    () => computeOpportunityIntelligence(pipeline, companies, activities, allPipelines),
    [pipeline, companies, activities, allPipelines],
  );

  const topRisk = intelligence.risks[0];

  return (
    <div className="flex flex-col gap-3">
      <IntelligenceLead
        eyebrow="Opportunity intelligence"
        title={pipeline.assetName ?? pipeline.id}
        status={
          <>
            <OpportunityHealthBadge status={intelligence.healthStatus} />
            <OpportunityMomentumBadge momentum={intelligence.momentum} />
            <span className="text-[10px] font-semibold tabular-nums text-carbon-blue/55">
              {intelligence.winProbability}% win
            </span>
          </>
        }
        summary={intelligence.healthSummary}
        action={<OpportunityNextBestActionCard action={intelligence.nextBestAction} />}
      />

      {topRisk ? (
        <section className={`border px-3 py-2.5 text-[11px] ${RISK_STYLES[topRisk.severity]}`}>
          <p className="text-[9px] font-semibold uppercase tracking-wider opacity-70">Top risk</p>
          <p className="mt-0.5 font-semibold">{topRisk.label}</p>
          <p className="mt-0.5 opacity-80">{topRisk.detail}</p>
        </section>
      ) : null}

      {intelligence.risks.length > 1 ? (
        <CollapsibleSection
          title={`${intelligence.risks.length - 1} more risk${intelligence.risks.length === 2 ? "" : "s"}`}
          tier="nice-to-have"
        >
          <ul className="space-y-2">
            {intelligence.risks.slice(1).map((risk) => (
              <li
                key={risk.id}
                className={`border px-3 py-2 text-[11px] ${RISK_STYLES[risk.severity]}`}
              >
                <p className="font-semibold">{risk.label}</p>
                <p className="mt-0.5 opacity-80">{risk.detail}</p>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      ) : null}

      <CollapsibleSection
        title="How is this scored?"
        description="Expert breakdown"
        tier="expert"
      >
        <OpportunityIntelligenceBreakdown intelligence={intelligence} />
      </CollapsibleSection>
    </div>
  );
}
