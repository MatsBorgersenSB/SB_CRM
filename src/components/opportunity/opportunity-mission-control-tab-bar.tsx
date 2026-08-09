"use client";

import { EntityNewActivityButton } from "@/components/activities/entity-new-activity-button";
import {
  ATTIO_SEGMENT_TRACK,
  attioSegmentItemClass,
} from "@/lib/attio-workspace-surfaces";
import type { ActivityWorkspaceContext } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import {
  OPPORTUNITY_MISSION_CONTROL_VIEWS,
  type OpportunityMissionControlView,
} from "@/types/opportunity-mission-control";

/**
 * Attio-style segment control — fixed-size pills, no layout shift on select.
 * New activity CTA stays to the right of tabs on every mission-control view.
 */
export function OpportunityMissionControlTabBar({
  active,
  onChange,
  activityContext,
  companies = [],
  pipelines = [],
}: {
  active: OpportunityMissionControlView;
  onChange: (view: OpportunityMissionControlView) => void;
  activityContext: ActivityWorkspaceContext;
  companies?: Company[];
  pipelines?: PipelineRow[];
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <nav
        aria-label="Mission control"
        className={`${ATTIO_SEGMENT_TRACK} sm:min-w-0 sm:flex-1`}
        role="tablist"
      >
        {OPPORTUNITY_MISSION_CONTROL_VIEWS.map((view) => {
          const selected = view.id === active;
          return (
            <button
              key={view.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(view.id)}
              className={attioSegmentItemClass(selected)}
            >
              {view.label}
            </button>
          );
        })}
      </nav>
      <EntityNewActivityButton
        context={activityContext}
        companies={companies}
        pipelines={pipelines}
      />
    </div>
  );
}
