"use client";

import { COMPANY_360_TAB_DEFINITIONS, type Company360Tab } from "@/types/company-360";

type Company360TabBarProps = {
  active: Company360Tab;
  onChange: (tab: Company360Tab) => void;
};

export function Company360TabBar({ active, onChange }: Company360TabBarProps) {
  const activeDefinition = COMPANY_360_TAB_DEFINITIONS.find((tab) => tab.id === active);

  return (
    <nav aria-label="Account workspace" className="dashboard-card overflow-hidden">
      <div className="flex overflow-x-auto">
        {COMPANY_360_TAB_DEFINITIONS.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`relative shrink-0 px-4 py-3 text-[11px] font-semibold tracking-wide transition-colors ${
                selected
                  ? "text-upcycle-orange"
                  : "text-carbon-blue/45 hover:bg-carbon-blue/[0.02] hover:text-carbon-blue/70"
              }`}
            >
              {tab.label}
              {selected ? (
                <span className="absolute inset-x-2 bottom-0 h-0.5 bg-upcycle-orange" />
              ) : null}
            </button>
          );
        })}
      </div>
      {activeDefinition ? (
        <p className="border-t border-carbon-blue/8 px-4 py-2 text-[11px] text-carbon-blue/50">
          {activeDefinition.description}
        </p>
      ) : null}
    </nav>
  );
}
