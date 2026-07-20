export type WorkspaceFilterId =
  | "companies"
  | "contacts"
  | "activities"
  | "opportunities"
  | "smartdocs"
  | "cvm"
  | "projects";

export type FilterSelectMode = "single" | "multi";

export type FilterOption = {
  value: string;
  label: string;
  count?: number;
};

export type FilterDefinition = {
  id: string;
  label: string;
  mode: FilterSelectMode;
  options: FilterOption[];
  /** Value treated as empty / all (default "all" or "") */
  emptyValue?: string;
};

export type WorkspaceFilterValues = Record<string, string | string[]>;

export type WorkspaceFilterIntent = {
  workspace: WorkspaceFilterId;
  filters: WorkspaceFilterValues;
  search?: string;
  owner?: string;
};

/** Active filter chip for global transparency bar (Phase 2.x). */
export type FilterSummaryChip = {
  id: string;
  label: string;
  value: string;
  onRemove: () => void;
};

export function isFilterActive(
  value: string | string[] | undefined,
  emptyValue = "all",
): boolean {
  if (value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  return value !== "" && value !== emptyValue;
}

export function normalizeSingleFilter(
  value: string | string[] | undefined,
  emptyValue = "all",
): string {
  if (Array.isArray(value)) return value[0] ?? emptyValue;
  return value && value !== "" ? value : emptyValue;
}

export function normalizeMultiFilter(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value || value === "all" || value === "") return [];
  return [value];
}
