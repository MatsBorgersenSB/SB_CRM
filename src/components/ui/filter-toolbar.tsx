"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { FilterTransparencyBar } from "@/components/ui/filter-transparency-bar";
import { buildActiveFilterChips } from "@/lib/workspace-filter-summary";
import type {
  FilterDefinition,
  FilterOption,
  FilterSummaryChip,
  WorkspaceFilterValues,
} from "@/types/workspace-filters";
import { isFilterActive, normalizeMultiFilter, normalizeSingleFilter } from "@/types/workspace-filters";

export type FilterToolbarProps = {
  filters: FilterDefinition[];
  values: WorkspaceFilterValues;
  onChange: (id: string, value: string | string[]) => void;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  owners?: FilterOption[];
  ownerValue?: string;
  onOwnerChange?: (value: string) => void;
  ownerLabel?: string;
  className?: string;
  /** Filter transparency — e.g. "Companies" */
  entityLabel?: string;
  totalCount?: number;
  filteredCount?: number;
  defaultValues?: WorkspaceFilterValues;
  defaultOwner?: string;
  extraActiveFilters?: FilterSummaryChip[];
  onClearAll?: () => void;
};

function filterButtonLabel(
  definition: FilterDefinition,
  value: string | string[] | undefined,
): string {
  const empty = definition.emptyValue ?? (definition.mode === "multi" ? "" : "all");

  if (definition.mode === "multi") {
    const selected = normalizeMultiFilter(value);
    if (selected.length === 0) return definition.label;
    if (selected.length === 1) {
      const opt = definition.options.find((o) => o.value === selected[0]);
      return opt?.label ?? definition.label;
    }
    return `${definition.label} (${selected.length})`;
  }

  const single = normalizeSingleFilter(value, empty);
  if (!isFilterActive(single, empty)) return definition.label;
  const opt = definition.options.find((o) => o.value === single);
  return opt?.label ?? definition.label;
}

function FilterDropdown({
  definition,
  value,
  onChange,
}: {
  definition: FilterDefinition;
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const empty = definition.emptyValue ?? (definition.mode === "multi" ? "" : "all");
  const active = isFilterActive(value, empty);
  const label = filterButtonLabel(definition, value);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const selectedMulti = new Set(normalizeMultiFilter(value));
  const selectedSingle = normalizeSingleFilter(value, empty);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex h-8 items-center gap-1 border px-2.5 text-[11px] font-semibold transition-colors ${
          active
            ? "border-upcycle-orange/35 bg-upcycle-orange/[0.08] text-upcycle-orange"
            : "border-carbon-blue/12 bg-white text-carbon-blue/70 hover:border-carbon-blue/25 hover:text-carbon-blue"
        }`}
      >
        <span className="max-w-[9rem] truncate">{label}</span>
        <ChevronDown className="size-3 shrink-0 opacity-60" strokeWidth={2} />
      </button>

      {open ? (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1 max-h-64 min-w-[11rem] overflow-y-auto border border-carbon-blue/12 bg-white py-1 shadow-lg"
        >
          {definition.mode === "single" ? (
            <>
              <FilterOptionRow
                label="All"
                selected={!isFilterActive(selectedSingle, empty)}
                onSelect={() => {
                  onChange(empty);
                  setOpen(false);
                }}
              />
              {definition.options
                .filter((opt) => opt.value !== empty)
                .map((opt) => (
                  <FilterOptionRow
                    key={opt.value}
                    label={opt.label}
                    count={opt.count}
                    selected={selectedSingle === opt.value}
                    onSelect={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                  />
                ))}
            </>
          ) : (
            <>
              <FilterOptionRow
                label="Clear selection"
                selected={selectedMulti.size === 0}
                onSelect={() => onChange([])}
              />
              {definition.options.map((opt) => (
                <FilterOptionRow
                  key={opt.value}
                  label={opt.label}
                  count={opt.count}
                  selected={selectedMulti.has(opt.value)}
                  mode="multi"
                  onSelect={() => {
                    const next = new Set(selectedMulti);
                    if (next.has(opt.value)) next.delete(opt.value);
                    else next.add(opt.value);
                    onChange(Array.from(next));
                  }}
                />
              ))}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function FilterOptionRow({
  label,
  count,
  selected,
  mode = "single",
  onSelect,
}: {
  label: string;
  count?: number;
  selected: boolean;
  mode?: "single" | "multi";
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-[11px] transition-colors hover:bg-carbon-blue/[0.04] ${
        selected ? "font-semibold text-carbon-blue" : "text-carbon-blue/75"
      }`}
    >
      <span className="flex items-center gap-2">
        {mode === "multi" ? (
          <span
            className={`inline-flex size-3.5 shrink-0 items-center justify-center border ${
              selected
                ? "border-upcycle-orange bg-upcycle-orange text-white"
                : "border-carbon-blue/20 bg-white"
            }`}
            aria-hidden
          >
            {selected ? <span className="text-[8px]">✓</span> : null}
          </span>
        ) : null}
        {label}
      </span>
      {count !== undefined && count > 0 ? (
        <span className="tabular-nums text-[10px] text-carbon-blue/40">{count}</span>
      ) : null}
    </button>
  );
}

export function FilterToolbar({
  filters,
  values,
  onChange,
  search = "",
  onSearchChange,
  searchPlaceholder = "Search…",
  owners,
  ownerValue = "all",
  onOwnerChange,
  ownerLabel = "Owner",
  className = "",
  entityLabel,
  totalCount,
  filteredCount,
  defaultValues,
  defaultOwner = "all",
  extraActiveFilters,
  onClearAll,
}: FilterToolbarProps) {
  const ownerDefinition: FilterDefinition | null =
    owners && owners.length > 0 && onOwnerChange
      ? {
          id: "owner",
          label: ownerLabel,
          mode: "single",
          emptyValue: "all",
          options: owners,
        }
      : null;

  const activeFilterChips = useMemo(
    () =>
      buildActiveFilterChips({
        definitions: filters,
        values,
        search,
        owner: ownerValue,
        ownerLabel,
        extraChips: extraActiveFilters,
        onChange,
        onSearchChange,
        onOwnerChange,
      }),
    [
      filters,
      values,
      search,
      ownerValue,
      ownerLabel,
      extraActiveFilters,
      onChange,
      onSearchChange,
      onOwnerChange,
    ],
  );

  const handleClearAll = () => {
    if (onClearAll) {
      onClearAll();
      return;
    }

    for (const definition of filters) {
      const empty = definition.emptyValue ?? (definition.mode === "multi" ? "" : "all");
      const fallback = defaultValues?.[definition.id];
      onChange(
        definition.id,
        fallback ?? (definition.mode === "multi" ? [] : empty),
      );
    }
    onSearchChange?.("");
    onOwnerChange?.(defaultOwner);
    for (const chip of extraActiveFilters ?? []) {
      chip.onRemove();
    }
  };

  const showTransparency =
    entityLabel != null && totalCount != null && filteredCount != null;

  return (
    <div className={showTransparency ? "flex flex-col" : undefined}>
      <div
        className={`flex flex-wrap items-center gap-2 border-b border-carbon-blue/10 bg-carbon-blue/[0.02] px-3 py-2 ${className}`}
      >
        {filters.map((definition) => (
          <FilterDropdown
            key={definition.id}
            definition={definition}
            value={values[definition.id]}
            onChange={(value) => onChange(definition.id, value)}
          />
        ))}

        {ownerDefinition ? (
          <FilterDropdown
            definition={ownerDefinition}
            value={ownerValue}
            onChange={(value) => onOwnerChange!(normalizeSingleFilter(value, "all"))}
          />
        ) : null}

        {onSearchChange ? (
          <div className="relative ml-auto min-w-[10rem] flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-carbon-blue/35"
              strokeWidth={1.75}
            />
            <input
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-full border border-carbon-blue/12 bg-white py-0 pl-7 pr-7 text-[11px] text-carbon-blue outline-none transition-colors focus:border-upcycle-orange/40 focus:ring-1 focus:ring-upcycle-orange/20"
            />
            {search ? (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-carbon-blue/35 hover:text-carbon-blue"
                aria-label="Clear search"
              >
                <X className="size-3" strokeWidth={2} />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {showTransparency ? (
        <FilterTransparencyBar
          entityLabel={entityLabel}
          filteredCount={filteredCount}
          totalCount={totalCount}
          activeFilters={activeFilterChips}
          onClearAll={activeFilterChips.length > 0 ? handleClearAll : undefined}
          className="border-b-0"
        />
      ) : null}
    </div>
  );
}
