"use client";

import Link from "next/link";
import type { Activity } from "@/types/activity";
import type { AttentionItem } from "@/types/attention-item";
import type { CommercialViabilityAssessment } from "@/types/commercial-viability";
import type { OpportunityQualification } from "@/types/opportunity-qualification";
import { isFollowUpOpen } from "@/lib/activity-utils";
import {
  buildCriticalRisks,
  buildOpportunityDecisionBrief,
  buildWhatMattersNow,
} from "@/lib/opportunity-overview-engine";
import type { SmartDocsIntelligenceSnapshot } from "@/lib/smartdocs-intelligence-data";
import { OpportunitySmartAssistBrief } from "@/components/opportunity/opportunity-smartassist-brief";
import { OpportunityWhatMattersNow } from "@/components/opportunity/opportunity-what-matters-now";
import { OpportunityNextActions } from "@/components/opportunity/opportunity-next-actions";
import { OpportunityOpenCommitments } from "@/components/opportunity/opportunity-open-commitments";
import { OpportunityRecentActivities } from "@/components/opportunity/opportunity-recent-activities";
import { OpportunityCriticalRisks } from "@/components/opportunity/opportunity-critical-risks";
import { OpportunityQualificationPanel } from "@/components/opportunity/opportunity-qualification-panel";
import { OpportunityExecutionSection } from "@/components/opportunity/opportunity-execution-section";

export function OpportunityOverview({
  assessment,
  qualification,
  dealName,
  dealId,
  dealActivities,
  attentionItems,
  smartDocs,
}: {
  assessment: CommercialViabilityAssessment;
  qualification: OpportunityQualification;
  dealName: string;
  dealId: string;
  dealActivities: Activity[];
  attentionItems: AttentionItem[];
  smartDocs?: SmartDocsIntelligenceSnapshot;
}) {
  const brief = buildOpportunityDecisionBrief(assessment, attentionItems, dealActivities);
  const matters = buildWhatMattersNow(assessment, attentionItems, dealActivities);
  const risks = buildCriticalRisks(assessment, attentionItems, dealId, smartDocs);
  const openCommitmentCount = dealActivities.filter(isFollowUpOpen).length;

  return (
    <section aria-label="Opportunity overview" className="flex flex-col gap-3">
      <OpportunityQualificationPanel qualification={qualification} />

      <OpportunitySmartAssistBrief dealName={dealName} brief={brief} />

      <div className="grid gap-3 lg:grid-cols-2">
        <OpportunityExecutionSection title="What Matters Right Now" count={matters.length}>
          <OpportunityWhatMattersNow items={matters} />
        </OpportunityExecutionSection>

        <OpportunityExecutionSection
          title="Top 3 Recommended Actions"
          count={Math.min(3, assessment.nextActions.length)}
        >
          <OpportunityNextActions actions={assessment.nextActions} limit={3} />
        </OpportunityExecutionSection>

        <OpportunityExecutionSection title="Open Commitments" count={openCommitmentCount}>
          <OpportunityOpenCommitments activities={dealActivities} dealId={dealId} />
        </OpportunityExecutionSection>

        <OpportunityExecutionSection title="Recent Activity" count={dealActivities.length}>
          <OpportunityRecentActivities activities={dealActivities} dealId={dealId} />
        </OpportunityExecutionSection>

        <OpportunityExecutionSection
          title="Critical Risks"
          count={risks.length}
          action={
            risks.length > 0 ? (
              <Link
                href={`/deals/${encodeURIComponent(dealId)}?tab=commercial`}
                className="text-[10px] font-semibold text-upcycle-orange hover:underline"
              >
                Full analysis
              </Link>
            ) : null
          }
          id="overview-risks"
        >
          <OpportunityCriticalRisks risks={risks} />
        </OpportunityExecutionSection>
      </div>
    </section>
  );
}
