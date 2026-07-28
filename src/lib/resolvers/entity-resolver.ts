/**
 * Universal resolver to locate an entity by ID, code, slug, email, or name
 * across Neon PostgreSQL (Prisma) and static portfolio / seed datasets.
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
  /** Field names on seed rows to compare (case-insensitive). */
  matchKeys?: (keyof T)[];
  /**
   * Extra match values (nested emails, tracking codes, aliases).
   * Compared case-insensitively alongside matchKeys.
   */
  getMatchValues?: (item: T) => unknown[];
};

/** Strip query string, decode URI, trim — keep original casing for DB ids. */
export function normalizeEntityParam(rawParam: string | undefined | null): string {
  if (rawParam == null) return "";
  const withoutQuery = String(rawParam).split("?")[0] ?? "";
  try {
    return decodeURIComponent(withoutQuery).trim();
  } catch {
    return withoutQuery.trim();
  }
}

/** Lowercase form used for seed / dual-store string comparisons. */
export function toEntitySearchKey(rawParam: string | undefined | null): string {
  return normalizeEntityParam(rawParam).toLowerCase();
}

/**
 * Prefer entity-specific keys, then generic `id`.
 * Example: pickEntityRouteParam(params, ["contactId", "id"])
 */
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
    const value = params[key as string];
    const normalized = normalizeEntityParam(value);
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

/**
 * Resolve an entity from a URL param:
 * 1. Normalize (decode URI, strip query params)
 * 2. Query Prisma via `dbQuery` with try/catch (case-insensitive OR handled inside dbQuery)
 * 3. Fall back to local portfolio / seed array if Prisma returns null or throws
 *
 * Callers should only invoke `notFound()` when this returns null.
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

  // 2. Query Neon PostgreSQL via Prisma
  try {
    const dbRecord = await dbQuery(displayKey);
    if (dbRecord) return dbRecord;
  } catch (err) {
    console.warn(`[EntityResolver] DB query fallback for "${cleanKey}":`, err);
  }

  // Retry lowercased key for email / name style params
  if (cleanKey !== displayKey) {
    try {
      const dbRecord = await dbQuery(cleanKey);
      if (dbRecord) return dbRecord;
    } catch (err) {
      console.warn(`[EntityResolver] DB query fallback for "${cleanKey}":`, err);
    }
  }

  // 3. Fallback to local portfolio / seed dataset
  const seedRecord = fallbackArray.find((item) =>
    itemMatchesSeed(item, cleanKey, matchKeys, options.getMatchValues),
  );

  return seedRecord ?? null;
}
