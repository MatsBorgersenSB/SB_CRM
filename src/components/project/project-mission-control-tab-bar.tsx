"use client";

import { CreateMenu } from "@/components/layout/create-menu";
import { WorkspaceModeNav } from "@/components/ui/workspace-mode-nav";
import type { ActivityWorkspaceContext } from "@/types/activity";
import type { CreateActivityInput } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import {
  PROJECT_MISSION_CONTROL_VIEWS,
  type ProjectMissionControlView,
} from "@/types/project-mission-control";

export function ProjectMissionControlTabBar({
  active,
  onChange,
  activityContext,
  companies = [],
  pipelines = [],
}: {
  active: ProjectMissionControlView;
  onChange: (view: ProjectMissionControlView) => void;
  activityContext: ActivityWorkspaceContext;
  companies?: Company[];
  pipelines?: PipelineRow[];
  documentCount?: number;
}) {
  const preset: Partial<CreateActivityInput> = {
    Company: activityContext.companyId
      ? { CompanyID: activityContext.companyId }
      : null,
    Deal: activityContext.dealId ? { DealID: activityContext.dealId } : null,
    ProjectId: activityContext.projectId ?? null,
    ProjectName: activityContext.projectName ?? null,
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <WorkspaceModeNav
          ariaLabel="Project mission control"
          items={PROJECT_MISSION_CONTROL_VIEWS.map((view) => ({
            id: view.id,
            label: view.label,
          }))}
          active={active}
          onChange={(id) => onChange(id as ProjectMissionControlView)}
        />
      </div>
      <CreateMenu
        variant="header"
        activityPreset={preset}
        companies={companies}
        pipelines={pipelines}
        meetingSubject={activityContext.projectName}
      />
    </div>
  );
}
