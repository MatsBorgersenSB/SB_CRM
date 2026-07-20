"use client";

import { WorkspaceModeNav } from "@/components/ui/workspace-mode-nav";
import {
  PROJECT_MISSION_CONTROL_VIEWS,
  type ProjectMissionControlView,
} from "@/types/project-mission-control";

export function ProjectMissionControlTabBar({
  active,
  onChange,
}: {
  active: ProjectMissionControlView;
  onChange: (view: ProjectMissionControlView) => void;
}) {
  return (
    <WorkspaceModeNav
      ariaLabel="Project mission control"
      items={PROJECT_MISSION_CONTROL_VIEWS.map((view) => ({
        id: view.id,
        label: view.label,
      }))}
      active={active}
      onChange={(id) => onChange(id as ProjectMissionControlView)}
    />
  );
}
