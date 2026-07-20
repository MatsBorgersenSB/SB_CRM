"use client";

import { WorkspaceModeNav } from "@/components/ui/workspace-mode-nav";
import { PROJECT_ACTION_TABS, type ProjectActionTab } from "@/types/project-actions";

export function ProjectActionsTabBar({
  active,
  onChange,
  counts,
}: {
  active: ProjectActionTab;
  onChange: (tab: ProjectActionTab) => void;
  counts?: Partial<Record<ProjectActionTab, number>>;
}) {
  return (
    <WorkspaceModeNav
      ariaLabel="Project actions"
      items={PROJECT_ACTION_TABS.map((tab) => ({
        id: tab.id,
        label: tab.label,
        count: counts?.[tab.id],
      }))}
      active={active}
      onChange={(id) => onChange(id as ProjectActionTab)}
    />
  );
}
