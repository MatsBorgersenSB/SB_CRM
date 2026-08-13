"use client";

import { EntityNewActivityButton } from "@/components/activities/entity-new-activity-button";
import { WorkspaceModeNav } from "@/components/ui/workspace-mode-nav";
import type { ActivityWorkspaceContext } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import {
  CONTACT_MISSION_CONTROL_VIEWS,
  type ContactMissionControlView,
} from "@/types/contact-mission-control";

export function ContactMissionControlTabBar({
  active,
  onChange,
  activityContext,
  companies = [],
  pipelines = [],
  counts,
}: {
  active: ContactMissionControlView;
  onChange: (view: ContactMissionControlView) => void;
  activityContext: ActivityWorkspaceContext;
  companies?: Company[];
  pipelines?: PipelineRow[];
  counts?: Partial<Record<ContactMissionControlView, number>>;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <WorkspaceModeNav
          ariaLabel="Contact mission control"
          items={CONTACT_MISSION_CONTROL_VIEWS.map((view) => ({
            id: view.id,
            label: view.label,
            count: counts?.[view.id],
          }))}
          active={active}
          onChange={(id) => onChange(id as ContactMissionControlView)}
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
