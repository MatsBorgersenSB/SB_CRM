import type {
  FilterDefinition,
  FilterSummaryChip,
  WorkspaceFilterValues,
} from "@/types/workspace-filters";
import { isFilterActive, normalizeMultiFilter, normalizeSingleFilter } from "@/types/workspace-filters";

export type BuildActiveFilterChipsInput = {
  definitions: FilterDefinition[];
  values: WorkspaceFilterValues;
  search?: string;
  owner?: string;
  ownerLabel?: string;
  extraChips?: FilterSummaryChip[];
  onChange: (id: string, value: string | string[]) => void;
  onSearchChange?: (value: string) => void;
  onOwnerChange?: (value: string) => void;
};

/** Derive visible active-filter chips — never hidden behind menus. */
export function buildActiveFilterChips(input: BuildActiveFilterChipsInput): FilterSummaryChip[] {
  const chips: FilterSummaryChip[] = [];

  for (const definition of input.definitions) {
    const empty = definition.emptyValue ?? (definition.mode === "multi" ? "" : "all");
    const raw = input.values[definition.id];

    if (definition.mode === "multi") {
      const selected = normalizeMultiFilter(raw);
      if (selected.length === 0) continue;

      const labels = selected.map(
        (value) => definition.options.find((option) => option.value === value)?.label ?? value,
      );

      chips.push({
        id: definition.id,
        label: definition.label,
        value: labels.join(", "),
        onRemove: () => input.onChange(definition.id, []),
      });
      continue;
    }

    const single = normalizeSingleFilter(raw, empty);
    if (!isFilterActive(single, empty)) continue;

    const option = definition.options.find((entry) => entry.value === single);
    chips.push({
      id: definition.id,
      label: definition.label,
      value: option?.label ?? single,
      onRemove: () => input.onChange(definition.id, empty),
    });
  }

  if (
    input.owner &&
    input.onOwnerChange &&
    isFilterActive(input.owner, "all")
  ) {
    chips.push({
      id: "owner",
      label: input.ownerLabel ?? "Owner",
      value: input.owner,
      onRemove: () => input.onOwnerChange!("all"),
    });
  }

  const query = input.search?.trim();
  if (query && input.onSearchChange) {
    chips.push({
      id: "search",
      label: "Search",
      value: query,
      onRemove: () => input.onSearchChange!(""),
    });
  }

  if (input.extraChips?.length) {
    chips.push(...input.extraChips);
  }

  return chips;
}

export function mergeFilterSummaryChips(
  ...groups: Array<FilterSummaryChip[] | undefined>
): FilterSummaryChip[] {
  return groups.flatMap((group) => group ?? []);
}
