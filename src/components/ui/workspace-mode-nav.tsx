"use client";

import {
  WORKSPACE_MODE_NAV,
  workspaceModeNavButtonClass,
} from "@/lib/workspace-mode-nav";

export type WorkspaceModeNavItem = {
  id: string;
  label: string;
  count?: number;
};

export function WorkspaceModeNav({
  items,
  active,
  onChange,
  ariaLabel,
}: {
  items: WorkspaceModeNavItem[];
  active: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
}) {
  return (
    <nav aria-label={ariaLabel} className={WORKSPACE_MODE_NAV}>
      {items.map((item) => {
        const selected = item.id === active;
        const label =
          item.count !== undefined && item.count > 0
            ? `${item.label} (${item.count})`
            : item.label;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={workspaceModeNavButtonClass(selected)}
            aria-current={selected ? "page" : undefined}
          >
            {label}
          </button>
        );
      })}
    </nav>
  );
}
