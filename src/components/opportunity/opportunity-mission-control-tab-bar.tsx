"use client";

import { WorkspaceModeNav } from "@/components/ui/workspace-mode-nav";
import {
  OPPORTUNITY_MISSION_CONTROL_VIEWS,
  type OpportunityMissionControlView,
} from "@/types/opportunity-mission-control";

export function OpportunityMissionControlTabBar({
  active,
  onChange,
}: {
  active: OpportunityMissionControlView;
  onChange: (view: OpportunityMissionControlView) => void;
}) {
  return (
    <WorkspaceModeNav
      ariaLabel="Mission control"
      items={OPPORTUNITY_MISSION_CONTROL_VIEWS.map((view) => ({
        id: view.id,
        label: view.label,
      }))}
      active={active}
      onChange={(id) => onChange(id as OpportunityMissionControlView)}
    />
  );
}
