import type { FilterDefinition, WorkspaceFilterValues } from "@/types/workspace-filters";
import { normalizeMultiFilter, normalizeSingleFilter } from "@/types/workspace-filters";
import type {
  WorkspaceDocumentRow,
  WorkspaceDocumentSortKey,
} from "@/lib/workspace-documents-data";

export type WorkspaceDocumentTableQuery = {
  search: string;
  filters: WorkspaceFilterValues;
  sortKey: WorkspaceDocumentSortKey;
  sortDir: "asc" | "desc";
};

const DEFAULT_SORT: WorkspaceDocumentSortKey = "modifiedAt";

export function defaultDocumentTableQuery(): WorkspaceDocumentTableQuery {
  return {
    search: "",
    filters: {},
    sortKey: DEFAULT_SORT,
    sortDir: "desc",
  };
}

function parseRevision(version: string): number {
  const match = version.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function compareStrings(a: string, b: string, dir: "asc" | "desc"): number {
  const result = a.localeCompare(b, undefined, { sensitivity: "base" });
  return dir === "asc" ? result : -result;
}

function compareDates(a: string, b: string, dir: "asc" | "desc"): number {
  const left = new Date(a).getTime() || 0;
  const right = new Date(b).getTime() || 0;
  return dir === "asc" ? left - right : right - left;
}

export function sortWorkspaceDocumentRows(
  rows: WorkspaceDocumentRow[],
  sortKey: WorkspaceDocumentSortKey,
  sortDir: "asc" | "desc",
): WorkspaceDocumentRow[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    switch (sortKey) {
      case "name":
        return compareStrings(a.name, b.name, sortDir);
      case "docType":
        return compareStrings(a.docType, b.docType, sortDir);
      case "version":
        return sortDir === "asc"
          ? parseRevision(a.version) - parseRevision(b.version)
          : parseRevision(b.version) - parseRevision(a.version);
      case "status":
        return compareStrings(a.status, b.status, sortDir);
      case "relatedObjectLabel":
        return compareStrings(a.relatedObjectLabel, b.relatedObjectLabel, sortDir);
      case "modifiedAt":
      default:
        return compareDates(a.modifiedAt, b.modifiedAt, sortDir);
    }
  });
  return sorted;
}

function matchesRecency(modifiedAt: string, recency: string): boolean {
  if (recency === "all" || !recency) return true;
  const date = new Date(modifiedAt);
  if (Number.isNaN(date.getTime())) return true;

  const days =
    recency === "30d" ? 30 : recency === "90d" ? 90 : recency === "year" ? 365 : 0;
  if (!days) return true;

  const cutoff = Date.now() - days * 86_400_000;
  return date.getTime() >= cutoff;
}

export function filterWorkspaceDocumentRows(
  rows: WorkspaceDocumentRow[],
  query: Pick<WorkspaceDocumentTableQuery, "search" | "filters">,
): WorkspaceDocumentRow[] {
  const search = query.search.trim().toLowerCase();
  const typeFilter = new Set(normalizeMultiFilter(query.filters.type));
  const categoryFilter = normalizeSingleFilter(query.filters.category, "all");
  const statusFilter = normalizeSingleFilter(query.filters.status, "all");
  const recencyFilter = normalizeSingleFilter(query.filters.recency, "all");

  return rows.filter((row) => {
    if (search) {
      const haystack = [
        row.name,
        row.docType,
        row.docCategory,
        row.status,
        row.relatedObjectLabel,
        row.version,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    if (typeFilter.size > 0 && !typeFilter.has(row.docType)) return false;

    if (categoryFilter !== "all" && row.docCategory !== categoryFilter) return false;

    if (statusFilter !== "all" && row.statusKind !== statusFilter) return false;

    if (!matchesRecency(row.modifiedAt, recencyFilter)) return false;

    return true;
  });
}

export function applyWorkspaceDocumentTableQuery(
  rows: WorkspaceDocumentRow[],
  query: WorkspaceDocumentTableQuery,
): WorkspaceDocumentRow[] {
  const filtered = filterWorkspaceDocumentRows(rows, query);
  return sortWorkspaceDocumentRows(filtered, query.sortKey, query.sortDir);
}

export function buildWorkspaceDocumentFilterDefinitions(
  rows: WorkspaceDocumentRow[],
): FilterDefinition[] {
  const docTypes = [...new Set(rows.map((row) => row.docType).filter(Boolean))].sort();
  const categories = [...new Set(rows.map((row) => row.docCategory).filter(Boolean))].sort();

  const typeOptions = docTypes.map((value) => ({ value, label: value }));

  const categoryOptions = [
    { value: "all", label: "All categories" },
    ...categories.map((value) => ({ value, label: value })),
  ];

  const statusOptions = [
    { value: "all", label: "All statuses" },
    { value: "in_set", label: "In document set" },
    { value: "library", label: "In library" },
    ...(rows.some((row) => row.statusKind === "activity_link")
      ? [{ value: "activity_link", label: "Activity links" }]
      : []),
  ];

  const recencyOptions = [
    { value: "all", label: "Any time" },
    { value: "30d", label: "Last 30 days" },
    { value: "90d", label: "Last 90 days" },
    { value: "year", label: "Last 12 months" },
  ];

  const filters: FilterDefinition[] = [];

  if (categoryOptions.length > 2) {
    filters.push({
      id: "category",
      label: "Category",
      mode: "single",
      emptyValue: "all",
      options: categoryOptions,
    });
  }

  if (typeOptions.length > 1) {
    filters.push({
      id: "type",
      label: "Type",
      mode: "multi",
      emptyValue: "",
      options: typeOptions,
    });
  }

  filters.push(
    {
      id: "status",
      label: "Status",
      mode: "single",
      emptyValue: "all",
      options: statusOptions,
    },
    {
      id: "recency",
      label: "Modified",
      mode: "single",
      emptyValue: "all",
      options: recencyOptions,
    },
  );

  return filters;
}

export function toggleDocumentSort(
  current: WorkspaceDocumentTableQuery,
  column: WorkspaceDocumentSortKey,
): WorkspaceDocumentTableQuery {
  if (current.sortKey === column) {
    return { ...current, sortDir: current.sortDir === "asc" ? "desc" : "asc" };
  }
  const defaultDir: "asc" | "desc" =
    column === "modifiedAt" || column === "version" ? "desc" : "asc";
  return { ...current, sortKey: column, sortDir: defaultDir };
}

export const DOCUMENT_SORT_COLUMNS: Array<{ key: WorkspaceDocumentSortKey; label: string }> = [
  { key: "name", label: "Document" },
  { key: "docType", label: "Type" },
  { key: "version", label: "Version" },
  { key: "status", label: "Status" },
  { key: "relatedObjectLabel", label: "Related object" },
  { key: "modifiedAt", label: "Modified date" },
];
