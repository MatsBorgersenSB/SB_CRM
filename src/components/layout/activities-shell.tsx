"use client";

import { SmartActivityWorkspace } from "@/components/activities/smart-activity-workspace";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { WorkspaceMain } from "@/components/ui/workspace-main";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { Activity } from "@/types/activity";
import type { StandardBioUserRecord } from "@/types/user-access";

type ActivitiesShellProps = {
  activities: Activity[];
  companies: Company[];
  pipelines: PipelineRow[];
  assignableUsers?: StandardBioUserRecord[];
};

export function ActivitiesShell({
  activities,
  companies,
  pipelines,
  assignableUsers = [],
}: ActivitiesShellProps) {
  return (
    <WorkspaceChrome>
      <header className="sticky top-0 z-10 flex h-11 shrink-0 items-center border-b border-carbon-blue/8 bg-[var(--dashboard-surface)]/95 px-4 backdrop-blur-sm">
        <h1 className="text-sm font-semibold text-carbon-blue">Activities</h1>
        <span className="ml-2 hidden text-[11px] text-carbon-blue/40 sm:inline">
          Tasks and business development attention
        </span>
      </header>

      <WorkspaceMain>
        <SmartActivityWorkspace
          activities={activities}
          companies={companies}
          pipelines={pipelines}
          assignableUsers={assignableUsers}
          variant="page"
        />
      </WorkspaceMain>
    </WorkspaceChrome>
  );
}
