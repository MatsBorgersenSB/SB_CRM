"use client";

import { DOCUMENT_360_TAB_DEFINITIONS, type Document360Tab } from "@/types/smartdoc";

type Document360TabBarProps = {
  active: Document360Tab;
  onChange: (tab: Document360Tab) => void;
};

export function Document360TabBar({ active, onChange }: Document360TabBarProps) {
  return (
    <nav
      aria-label="Document workspace"
      className="dashboard-card flex overflow-x-auto"
    >
      {DOCUMENT_360_TAB_DEFINITIONS.map((tab) => {
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
    </nav>
  );
}
