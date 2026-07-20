"use client";

import {
  ACTIVITY_WORK_FILTERS,
  countActivityWorkFilters,
  type ActivityIntelligentRow,
  type ActivityWorkFilter,
} from "@/lib/activity-mission-control";
import { WorkspaceModeNav } from "@/components/ui/workspace-mode-nav";

export function ActivitySmartFilters({
  active,
  onChange,
  rows,
  search,
  onSearchChange,
}: {
  active: ActivityWorkFilter;
  onChange: (filter: ActivityWorkFilter) => void;
  rows: ActivityIntelligentRow[];
  search: string;
  onSearchChange: (value: string) => void;
}) {
  const counts = countActivityWorkFilters(rows);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <WorkspaceModeNav
        ariaLabel="Activity filters"
        items={ACTIVITY_WORK_FILTERS.map((filter) => ({
          id: filter.id,
          label: filter.label,
          count: counts[filter.id],
        }))}
        active={active}
        onChange={(id) => onChange(id as ActivityWorkFilter)}
      />
      <input
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search activities…"
        className="w-full border border-carbon-blue/10 bg-carbon-blue/[0.02] px-3 py-1.5 text-[13px] text-carbon-blue outline-none placeholder:text-carbon-blue/35 focus:border-carbon-blue/20 sm:w-56"
      />
    </div>
  );
}
