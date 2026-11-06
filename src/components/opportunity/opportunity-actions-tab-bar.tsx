"use client";

import { workspaceModeNavButtonClass } from "@/lib/workspace-mode-nav";
import {
  OPPORTUNITY_ACTION_TABS,
  type OpportunityActionTab,
} from "@/types/opportunity-actions";

const ACTION_TAB_GROUPS: ReadonlyArray<{
  label: string;
  tabs: readonly OpportunityActionTab[];
}> = [
  {
    label: "Work & Mail",
    tabs: ["activities", "meetings", "emails", "timeline"],
  },
  {
    label: "Discovery Prep",
    tabs: ["questions", "validations", "conversations"],
  },
  {
    label: "Files",
    tabs: ["documents"],
  },
];

export function OpportunityActionsTabBar({
  active,
  onChange,
  counts,
}: {
  active: OpportunityActionTab;
  onChange: (tab: OpportunityActionTab) => void;
  counts?: Partial<Record<OpportunityActionTab, number>>;
}) {
  const tabMap = new Map(OPPORTUNITY_ACTION_TABS.map((t) => [t.id, t.label]));

  return (
    <nav aria-label="Actions" className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {ACTION_TAB_GROUPS.map((group, groupIndex) => (
        <div
          key={group.label}
          className={`flex flex-wrap items-center gap-1.5 ${
            groupIndex > 0
              ? "border-l border-slate-200/90 pl-4 dark:border-slate-800"
              : ""
          }`}
        >
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            {group.label}
          </span>
          {group.tabs.map((tabId) => {
            const selected = tabId === active;
            const baseLabel = tabMap.get(tabId) ?? tabId;
            const count = counts?.[tabId];
            const label =
              count !== undefined && count > 0 ? `${baseLabel} (${count})` : baseLabel;

            return (
              <button
                key={tabId}
                type="button"
                onClick={() => onChange(tabId)}
                className={workspaceModeNavButtonClass(selected)}
                aria-current={selected ? "page" : undefined}
              >
                {label}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
