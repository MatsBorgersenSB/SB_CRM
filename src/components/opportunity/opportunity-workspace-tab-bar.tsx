"use client";

import {
  OPPORTUNITY_WORKSPACE_TABS,
  type OpportunityWorkspaceTab,
} from "@/types/opportunity-workspace";

export function OpportunityWorkspaceTabBar({
  active,
  onChange,
  counts,
  embedded = false,
}: {
  active: OpportunityWorkspaceTab | null;
  onChange: (tab: OpportunityWorkspaceTab) => void;
  counts?: Partial<Record<OpportunityWorkspaceTab, number>>;
  embedded?: boolean;
}) {
  return (
    <nav
      aria-label="Opportunity workspace"
      className={embedded ? "" : "dashboard-card overflow-hidden"}
    >
      <div className={`flex overflow-x-auto ${embedded ? "gap-4" : ""}`}>
        {OPPORTUNITY_WORKSPACE_TABS.map((tab) => {
          const selected = tab.id === active;
          const count = counts?.[tab.id];
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`relative shrink-0 transition-colors ${
                embedded
                  ? `pb-1 text-[12px] font-medium ${
                      selected
                        ? "text-carbon-blue"
                        : "text-carbon-blue/40 hover:text-carbon-blue/65"
                    }`
                  : `px-4 py-3 text-[11px] font-semibold tracking-wide ${
                      selected
                        ? "text-upcycle-orange"
                        : "text-carbon-blue/45 hover:bg-carbon-blue/[0.02] hover:text-carbon-blue/70"
                    }`
              }`}
            >
              {tab.label}
              {count !== undefined && count > 0 ? (
                <span className="ml-1 tabular-nums text-carbon-blue/35">({count})</span>
              ) : null}
              {selected && !embedded ? (
                <span className="absolute inset-x-2 bottom-0 h-0.5 bg-upcycle-orange" />
              ) : null}
              {selected && embedded ? (
                <span className="absolute inset-x-0 -bottom-px h-px bg-carbon-blue" />
              ) : null}
            </button>
          );
        })}
      </div>
      {!embedded && active ? (
        <p className="border-t border-carbon-blue/8 px-4 py-2 text-[11px] text-carbon-blue/50">
          {OPPORTUNITY_WORKSPACE_TABS.find((tab) => tab.id === active)?.description}
        </p>
      ) : !embedded ? (
        <p className="border-t border-carbon-blue/8 px-4 py-2 text-[11px] text-carbon-blue/50">
          Select a workspace tab for detailed work.
        </p>
      ) : null}
    </nav>
  );
}
