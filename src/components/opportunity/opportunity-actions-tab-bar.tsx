"use client";

import { WorkspaceModeNav } from "@/components/ui/workspace-mode-nav";
import {
  OPPORTUNITY_ACTION_TABS,
  type OpportunityActionTab,
} from "@/types/opportunity-actions";

export function OpportunityActionsTabBar({
  active,
  onChange,
  counts,
}: {
  active: OpportunityActionTab;
  onChange: (tab: OpportunityActionTab) => void;
  counts?: Partial<Record<OpportunityActionTab, number>>;
}) {
  return (
    <WorkspaceModeNav
      ariaLabel="Actions"
      items={OPPORTUNITY_ACTION_TABS.map((tab) => ({
        id: tab.id,
        label: tab.label,
        count: counts?.[tab.id],
      }))}
      active={active}
      onChange={(id) => onChange(id as OpportunityActionTab)}
    />
  );
}
