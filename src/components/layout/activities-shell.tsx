"use client";

import { SmartActivityWorkspace } from "@/components/activities/smart-activity-workspace";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { ThemeToggle } from "@/components/theme/theme-toggle";
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
      <header className="sticky top-0 z-10 flex h-11 shrink-0 items-center justify-between border-b border-carbon-blue/8 bg-[var(--dashboard-surface)]/95 px-4 backdrop-blur-sm">
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-carbon-blue">Activities</h1>
          <span className="hidden text-[11px] text-carbon-blue/40 sm:inline">
            Tasks and business development attention
          </span>
        </div>
        <ThemeToggle />
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
