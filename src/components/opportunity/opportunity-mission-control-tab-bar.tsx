"use client";

import { CreateMenu } from "@/components/layout/create-menu";
import {
  ATTIO_SEGMENT_TRACK,
  attioSegmentItemClass,
} from "@/lib/attio-workspace-surfaces";
import type { ActivityWorkspaceContext } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { CreateActivityInput } from "@/types/activity";
import {
  OPPORTUNITY_MISSION_CONTROL_VIEWS,
  type OpportunityMissionControlView,
} from "@/types/opportunity-mission-control";

/**
 * Attio-style segment control. Create stays to the right on every view — never behind a tab.
 */
export function OpportunityMissionControlTabBar({
  active,
  onChange,
  activityContext,
  companies = [],
  pipelines = [],
  hiddenViews,
  mailTo,
}: {
  hiddenViews?: readonly OpportunityMissionControlView[];
  active: OpportunityMissionControlView;
  onChange: (view: OpportunityMissionControlView) => void;
  activityContext: ActivityWorkspaceContext;
  companies?: Company[];
  pipelines?: PipelineRow[];
  documentCount?: number;
  mailTo?: string;
}) {
  const preset: Partial<CreateActivityInput> = {
    Company: activityContext.companyId
      ? { CompanyID: activityContext.companyId }
      : null,
    Contact: activityContext.contactId
      ? { ContactID: activityContext.contactId }
      : null,
    Deal: activityContext.dealId ? { DealID: activityContext.dealId } : null,
    ProjectId: activityContext.projectId ?? null,
    ProjectName: activityContext.projectName ?? null,
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <nav
        aria-label="Mission control"
        className={`${ATTIO_SEGMENT_TRACK} sm:min-w-0 sm:flex-1`}
        role="tablist"
      >
        {OPPORTUNITY_MISSION_CONTROL_VIEWS.filter(
          (view) => !hiddenViews?.includes(view.id),
        ).map((view) => {
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
      <CreateMenu
        variant="header"
        activityPreset={preset}
        companies={companies}
        pipelines={pipelines}
        mailTo={mailTo}
        meetingSubject={activityContext.dealName}
      />
    </div>
  );
}
