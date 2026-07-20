"use client";

import { Search } from "lucide-react";
import type { ActivityQuickFilter } from "@/types/activity";
import { ACTIVITY_QUICK_FILTERS } from "@/types/activity";

type ActivityQuickFiltersProps = {
  active: ActivityQuickFilter;
  onChange: (filter: ActivityQuickFilter) => void;
  counts?: Partial<Record<ActivityQuickFilter, number>>;
};

export function ActivityQuickFilters({
  active,
  onChange,
  counts,
}: ActivityQuickFiltersProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ACTIVITY_QUICK_FILTERS.map((filter) => {
        const isActive = active === filter.id;
        const count = counts?.[filter.id];

        return (
          <button
            key={filter.id}
            type="button"
            onClick={() => onChange(filter.id)}
            className={`inline-flex items-center gap-1 border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              isActive
                ? "border-upcycle-orange/35 bg-upcycle-orange/10 text-upcycle-orange"
                : "border-carbon-blue/10 bg-white text-carbon-blue/55 hover:border-carbon-blue/20 hover:text-carbon-blue"
            }`}
          >
            {filter.label}
            {count !== undefined && count > 0 ? (
              <span
                className={`tabular-nums ${isActive ? "text-upcycle-orange" : "text-carbon-blue/35"}`}
              >
                ({count})
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

type ActivitySearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function ActivitySearchBar({
  value,
  onChange,
  placeholder = "Search activities…",
}: ActivitySearchBarProps) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-carbon-blue/35"
        strokeWidth={1.75}
      />
      <input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-carbon-blue/12 bg-carbon-blue/[0.02] py-2 pl-8 pr-3 text-xs text-carbon-blue outline-none transition-colors focus:border-upcycle-orange/40 focus:ring-1 focus:ring-upcycle-orange/20"
      />
    </div>
  );
}
