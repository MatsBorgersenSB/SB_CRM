"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import type { FilterSummaryChip } from "@/types/workspace-filters";

export type FilterTransparencyBarProps = {
  entityLabel: string;
  filteredCount: number;
  totalCount: number;
  activeFilters: FilterSummaryChip[];
  onClearAll?: () => void;
  className?: string;
  /** Optional controls aligned with the Showing count (e.g. prev/next task). */
  endActions?: ReactNode;
};

/**
 * AD-001 Filter Transparency — users always see why records appear or do not.
 * @see docs/architecture/AD-001-filter-transparency.md
 */
export function FilterTransparencyBar({
  entityLabel,
  filteredCount,
  totalCount,
  activeFilters,
  onClearAll,
  className = "",
  endActions,
}: FilterTransparencyBarProps) {
  const hasActiveFilters = activeFilters.length > 0;

  return (
    <div
      className={`border-b border-carbon-blue/10 bg-white px-3 py-2.5 sm:px-4 ${className}`}
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-[12px] font-medium text-carbon-blue/75">
          Showing{" "}
          <span className="tabular-nums text-carbon-blue">{filteredCount}</span> of{" "}
          <span className="tabular-nums text-carbon-blue">{totalCount}</span> {entityLabel}
        </p>
        {endActions ? <div className="shrink-0">{endActions}</div> : null}
      </div>

      {hasActiveFilters ? (
        <div className="mt-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
            Active Filters
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {activeFilters.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={chip.onRemove}
                className="group inline-flex max-w-full items-center gap-1.5 border border-upcycle-orange/25 bg-upcycle-orange/[0.06] px-2 py-1 text-left text-[11px] text-carbon-blue transition-colors hover:border-upcycle-orange/45 hover:bg-upcycle-orange/[0.1]"
                aria-label={`Remove filter ${chip.label}: ${chip.value}`}
              >
                <span className="font-semibold text-carbon-blue/55">{chip.label}:</span>
                <span className="truncate font-medium">{chip.value}</span>
                <X
                  className="size-3 shrink-0 text-carbon-blue/35 group-hover:text-upcycle-orange"
                  strokeWidth={2}
                  aria-hidden
                />
              </button>
            ))}

            {onClearAll ? (
              <button
                type="button"
                onClick={onClearAll}
                className="text-[11px] font-semibold text-upcycle-orange underline-offset-2 hover:underline"
              >
                Clear All Filters
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
