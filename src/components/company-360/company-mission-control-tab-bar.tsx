"use client";

import { EntityNewActivityButton } from "@/components/activities/entity-new-activity-button";
import { WorkspaceModeNav } from "@/components/ui/workspace-mode-nav";
import type { ActivityWorkspaceContext } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import {
  COMPANY_MISSION_CONTROL_VIEWS,
  type CompanyMissionControlView,
} from "@/types/company-mission-control";

export function CompanyMissionControlTabBar({
  active,
  onChange,
  activityContext,
  companies = [],
  pipelines = [],
  counts,
}: {
  active: CompanyMissionControlView;
  onChange: (view: CompanyMissionControlView) => void;
  activityContext: ActivityWorkspaceContext;
  companies?: Company[];
  pipelines?: PipelineRow[];
  counts?: Partial<Record<CompanyMissionControlView, number>>;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <WorkspaceModeNav
          ariaLabel="Company mission control"
          items={COMPANY_MISSION_CONTROL_VIEWS.map((view) => ({
            id: view.id,
            label: view.label,
            count: counts?.[view.id],
          }))}
          active={active}
          onChange={(id) => onChange(id as CompanyMissionControlView)}
        />
      </div>
      <EntityNewActivityButton
        context={activityContext}
        companies={companies}
        pipelines={pipelines}
      />
    </div>
  );
}
