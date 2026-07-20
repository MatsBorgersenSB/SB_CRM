"use client";

import { useMemo } from "react";
import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { OpportunityUnderstanding } from "@/lib/opportunity-workspace-intelligence";
import {
  buildOpportunityTimeline,
  type RecommendedTimelineMilestone,
  type TimelineMilestone,
} from "@/lib/opportunity-timeline";
import { OpportunitySmartAssistActions } from "@/components/opportunity/opportunity-smartassist-actions";
import {
  EDITORIAL_ACCENT_BLOCK,
  EDITORIAL_BODY,
  EDITORIAL_BODY_MUTED,
  EDITORIAL_CONTENT,
  EDITORIAL_EMPTY,
  EDITORIAL_GAP_LIST,
  EDITORIAL_GAP_PAGE,
  EDITORIAL_LABEL,
  EDITORIAL_META,
  EDITORIAL_TITLE,
} from "@/lib/editorial-design-system";
import { EditorialSectionLabel } from "@/components/ui/editorial-primitives";

export function OpportunityTimelineWorkspace({
  pipeline,
  companies,
  commercialPackages,
  understanding,
  activities,
}: {
  pipeline: PipelineRow;
  companies: Company[];
  commercialPackages: CommercialPackage[];
  understanding: OpportunityUnderstanding;
  activities: Activity[];
}) {
  const timeline = useMemo(
    () =>
      buildOpportunityTimeline(
        pipeline,
        activities,
        commercialPackages,
        understanding,
      ),
    [pipeline, activities, commercialPackages, understanding],
  );

  const topRecommended = timeline.recommended[0] ?? null;

  return (
    <div className={`flex ${EDITORIAL_CONTENT} flex-col ${EDITORIAL_GAP_PAGE}`}>
      <div>
        <EditorialSectionLabel>Opportunity roadmap</EditorialSectionLabel>
        <p className={`mt-2.5 ${EDITORIAL_TITLE}`}>{timeline.roadmapSummary}</p>
      </div>

      <OpportunitySmartAssistActions
        pipeline={pipeline}
        companies={companies}
        commercialPackages={commercialPackages}
        understanding={understanding}
        activities={activities}
        actions={["email", "meeting", "plan", "schedule"]}
        scheduleTarget={topRecommended}
      />

      <TimelineSection
        title="Completed milestones"
        emptyLabel="No milestones completed yet."
        items={timeline.completed}
      />

      <TimelineSection
        title="Outstanding milestones"
        emptyLabel="Nothing outstanding right now."
        items={timeline.outstanding}
        emphasis
      />

      <RecommendedSection
        title="Recommended next milestones"
        emptyLabel="Understanding is solid — stay engaged with the customer."
        items={timeline.recommended}
      />
    </div>
  );
}

function TimelineSection({
  title,
  emptyLabel,
  items,
  emphasis = false,
}: {
  title: string;
  emptyLabel: string;
  items: TimelineMilestone[];
  emphasis?: boolean;
}) {
  return (
    <section className="border-t border-carbon-blue/8 pt-8">
      <EditorialSectionLabel>{title}</EditorialSectionLabel>
      {items.length > 0 ? (
        <ul className={`mt-4 ${EDITORIAL_GAP_LIST}`}>
          {items.map((milestone) => (
            <TimelineItem
              key={milestone.id}
              title={milestone.title}
              meta={milestone.dateLabel}
              detail={milestone.detail}
              emphasis={emphasis}
            />
          ))}
        </ul>
      ) : (
        <p className={`mt-3 ${EDITORIAL_EMPTY}`}>{emptyLabel}</p>
      )}
    </section>
  );
}

function TimelineItem({
  title,
  meta,
  detail,
  emphasis = false,
}: {
  title: string;
  meta?: string;
  detail?: string;
  emphasis?: boolean;
}) {
  return (
    <li>
      <p
        className={`text-[14px] leading-snug ${
          emphasis ? "font-medium text-carbon-blue" : "text-carbon-blue/80"
        }`}
      >
        {title}
      </p>
      {meta ? <p className={`mt-1 ${EDITORIAL_META}`}>{meta}</p> : null}
      {detail ? <p className={`mt-1.5 ${EDITORIAL_BODY_MUTED}`}>{detail}</p> : null}
    </li>
  );
}

function RecommendedSection({
  title,
  emptyLabel,
  items,
}: {
  title: string;
  emptyLabel: string;
  items: RecommendedTimelineMilestone[];
}) {
  return (
    <section className="border-t border-carbon-blue/8 pt-8">
      <EditorialSectionLabel>{title}</EditorialSectionLabel>
      {items.length > 0 ? (
        <ul className="mt-4 space-y-6">
          {items.map((milestone) => (
            <RecommendedItem key={milestone.id} milestone={milestone} />
          ))}
        </ul>
      ) : (
        <p className={`mt-3 ${EDITORIAL_EMPTY}`}>{emptyLabel}</p>
      )}
    </section>
  );
}

function RecommendedItem({ milestone }: { milestone: RecommendedTimelineMilestone }) {
  return (
    <li className={EDITORIAL_ACCENT_BLOCK}>
      <p className="text-[14px] font-medium leading-snug text-carbon-blue">{milestone.title}</p>
      <p className={`mt-1.5 ${EDITORIAL_META} text-upcycle-orange/80`}>{milestone.suggestedTiming}</p>
      <dl className="mt-3 space-y-2.5">
        <div>
          <dt className={EDITORIAL_LABEL}>Reason</dt>
          <dd className={`mt-0.5 ${EDITORIAL_BODY}`}>{milestone.reason}</dd>
        </div>
        <div>
          <dt className={EDITORIAL_LABEL}>Expected impact</dt>
          <dd className={`mt-0.5 ${EDITORIAL_BODY}`}>{milestone.expectedImpact}</dd>
        </div>
      </dl>
    </li>
  );
}
