/**
 * Universal resolver: normalize URL param → Prisma (try/catch) → portfolio/seed fallback.
 * Prefer matching the live portfolio first when provided — UI links use those IDs.
 */

export type EntityRouteParams = {
  id?: string;
  contactId?: string;
  companyId?: string;
  projectId?: string;
  dealId?: string;
  opportunityId?: string;
  [key: string]: string | undefined;
};

export type ResolveEntityOptions<T extends Record<string, unknown>> = {
  matchKeys?: (keyof T)[];
  getMatchValues?: (item: T) => unknown[];
  /**
   * When true (default), match `fallbackArray` before calling Prisma.
   * Detail pages share the same portfolio as list pages — those IDs must win.
   */
  preferFallbackFirst?: boolean;
};

/** Strip query string, decode URI, trim. */
export function normalizeEntityParam(rawParam: string | undefined | null): string {
  if (rawParam == null) return "";
  const withoutQuery = String(rawParam).split("?")[0] ?? "";
  try {
    return decodeURIComponent(withoutQuery).trim();
  } catch {
    return withoutQuery.trim();
  }
}

export function toEntitySearchKey(rawParam: string | undefined | null): string {
  return normalizeEntityParam(rawParam).toLowerCase();
}

export function pickEntityRouteParam(
  params: EntityRouteParams | Record<string, string | undefined>,
  preferredKeys: Array<keyof EntityRouteParams | string> = [
    "id",
    "contactId",
    "companyId",
    "projectId",
    "dealId",
    "opportunityId",
  ],
): string {
  for (const key of preferredKeys) {
    const normalized = normalizeEntityParam(params[key as string]);
    if (normalized) return normalized;
  }
  return "";
}

function valueMatchesKey(val: unknown, cleanKey: string): boolean {
  if (val == null || val === "") return false;
  if (typeof val === "string") return val.trim().toLowerCase() === cleanKey;
  if (typeof val === "number" || typeof val === "boolean") {
    return String(val).toLowerCase() === cleanKey;
  }
  if (Array.isArray(val)) {
    return val.some((entry) => {
      if (typeof entry === "string") return entry.trim().toLowerCase() === cleanKey;
      if (entry && typeof entry === "object" && "address" in entry) {
        const address = (entry as { address?: unknown }).address;
        return typeof address === "string" && address.trim().toLowerCase() === cleanKey;
      }
      return String(entry).toLowerCase() === cleanKey;
    });
  }
  return String(val).toLowerCase() === cleanKey;
}

function itemMatchesSeed<T extends Record<string, unknown>>(
  item: T,
  cleanKey: string,
  matchKeys: (keyof T)[],
  getMatchValues?: (item: T) => unknown[],
): boolean {
  for (const key of matchKeys) {
    if (valueMatchesKey(item[key], cleanKey)) return true;
  }
  if (getMatchValues) {
    for (const val of getMatchValues(item)) {
      if (valueMatchesKey(val, cleanKey)) return true;
    }
  }
  return false;
}

function findInFallback<T extends Record<string, unknown>>(
  fallbackArray: T[],
  cleanKey: string,
  matchKeys: (keyof T)[],
  getMatchValues?: (item: T) => unknown[],
): T | null {
  return (
    fallbackArray.find((item) =>
      itemMatchesSeed(item, cleanKey, matchKeys, getMatchValues),
    ) ?? null
  );
}

/**
 * Resolve an entity from a URL param against Prisma and/or local portfolio data.
 * Returns null only when both stores miss — callers should then `notFound()`.
 */
export async function resolveEntity<T extends Record<string, unknown>>(
  rawParam: string | undefined,
  dbQuery: (searchKey: string) => Promise<T | null>,
  fallbackArray: T[],
  matchKeysOrOptions:
    | (keyof T)[]
    | ResolveEntityOptions<T> = ["id", "code", "slug", "email", "name"] as (keyof T)[],
): Promise<T | null> {
  const displayKey = normalizeEntityParam(rawParam);
  if (!displayKey) return null;

  const cleanKey = displayKey.toLowerCase();
  const options: ResolveEntityOptions<T> = Array.isArray(matchKeysOrOptions)
    ? { matchKeys: matchKeysOrOptions }
    : matchKeysOrOptions;
  const matchKeys =
    options.matchKeys ??
    (["id", "code", "slug", "email", "name"] as (keyof T)[]);
  const preferFallbackFirst = options.preferFallbackFirst !== false;

  // 1. Portfolio / seed first (same IDs the list pages render and link)
  if (preferFallbackFirst && fallbackArray.length > 0) {
    const local = findInFallback(
      fallbackArray,
      cleanKey,
      matchKeys,
      options.getMatchValues,
    );
    if (local) return local;
  }

  // 2. Prisma (never throws out of this helper)
  try {
    const dbRecord = await dbQuery(displayKey);
    if (dbRecord) return dbRecord;
  } catch (err) {
    console.warn(`[EntityResolver] DB query fallback for "${displayKey}":`, err);
  }

  // 3. Seed fallback if we skipped it earlier, or Prisma missed
  return findInFallback(
    fallbackArray,
    cleanKey,
    matchKeys,
    options.getMatchValues,
  );
}
