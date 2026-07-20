"use client";

import type { OpportunityCommandCenterSnapshot } from "@/lib/opportunity-command-center-data";
import { OpportunityCommandCenterRow } from "@/components/opportunity/opportunity-command-center-row";
import { OpportunityCommandCenterSection } from "@/components/opportunity/opportunity-command-center-section";
import {
  OpportunityHealthDistributionPanel,
  OpportunityRevenueForecastPanel,
} from "@/components/opportunity/opportunity-forecast-panels";

/**
 * Pipeline intelligence panels — moved from Opportunities operating page.
 */
export function OpportunityPipelineIntelligencePanel({
  snapshot,
}: {
  snapshot: OpportunityCommandCenterSnapshot;
}) {
  return (
    <div className="flex flex-col gap-6">
      <OpportunityRevenueForecastPanel forecast={snapshot.revenueForecast} />

      {snapshot.dealsAtRisk.length > 0 ? (
        <OpportunityCommandCenterSection
          title="Deals at risk"
          description="Needs action now"
          count={snapshot.dealsAtRisk.length}
          href="/opportunities?filter=needs_attention"
          emptyMessage="No deals at risk."
          accent="risk"
        >
          {snapshot.dealsAtRisk.map((item) => (
            <OpportunityCommandCenterRow key={item.dealId} item={item} />
          ))}
        </OpportunityCommandCenterSection>
      ) : null}

      {snapshot.largestOpportunities.length > 0 ? (
        <OpportunityCommandCenterSection
          title="Largest opportunities"
          description={`Top ${Math.min(snapshot.largestOpportunities.length, 5)} by value`}
          count={snapshot.largestOpportunities.length}
          href="/opportunities?filter=high_value"
          emptyMessage="No opportunities."
          accent="default"
        >
          {snapshot.largestOpportunities.slice(0, 5).map((item) => (
            <OpportunityCommandCenterRow key={item.dealId} item={item} />
          ))}
        </OpportunityCommandCenterSection>
      ) : null}

      <OpportunityHealthDistributionPanel distribution={snapshot.healthDistribution} />
    </div>
  );
}
