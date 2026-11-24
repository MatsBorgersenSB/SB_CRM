/**
 * Companies list column visibility — core decision columns stay fixed;
 * optional columns (Industry/Sector first) are user-toggled and persisted.
 */

export const COMPANY_LIST_COLUMNS_STORAGE_KEY = "smartcrm-companies-list-columns";

/** Always-on decision columns — not toggled in the Columns control. */
export const COMPANY_LIST_CORE_COLUMNS = [
  "company",
  "relationship",
  "whatMatters",
  "pipeline",
  "owner",
] as const;

export type CompanyListCoreColumnId = (typeof COMPANY_LIST_CORE_COLUMNS)[number];

/** Optional columns the user can add via the Columns control. */
export const COMPANY_LIST_OPTIONAL_COLUMNS = [
  {
    id: "industrySector",
    label: "Industry / Sector",
    defaultVisible: true,
  },
] as const;

export type CompanyListOptionalColumnId =
  (typeof COMPANY_LIST_OPTIONAL_COLUMNS)[number]["id"];

export type CompanyListColumnVisibility = Record<CompanyListOptionalColumnId, boolean>;

export function defaultCompanyListColumnVisibility(): CompanyListColumnVisibility {
  return Object.fromEntries(
    COMPANY_LIST_OPTIONAL_COLUMNS.map((column) => [column.id, column.defaultVisible]),
  ) as CompanyListColumnVisibility;
}

export function isCompanyListOptionalColumnId(
  value: string,
): value is CompanyListOptionalColumnId {
  return COMPANY_LIST_OPTIONAL_COLUMNS.some((column) => column.id === value);
}

export function readCompanyListColumnVisibility(): CompanyListColumnVisibility {
  const defaults = defaultCompanyListColumnVisibility();
  if (typeof window === "undefined") return defaults;

  try {
    const raw = window.localStorage.getItem(COMPANY_LIST_COLUMNS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<Record<string, unknown>>;
    const next = { ...defaults };
    for (const column of COMPANY_LIST_OPTIONAL_COLUMNS) {
      const value = parsed[column.id];
      if (typeof value === "boolean") next[column.id] = value;
    }
    return next;
  } catch {
    return defaults;
  }
}

export function writeCompanyListColumnVisibility(
  visibility: CompanyListColumnVisibility,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COMPANY_LIST_COLUMNS_STORAGE_KEY, JSON.stringify(visibility));
}

export function countVisibleOptionalColumns(
  visibility: CompanyListColumnVisibility,
): number {
  return COMPANY_LIST_OPTIONAL_COLUMNS.filter((column) => visibility[column.id]).length;
}
