import "server-only";

import type { Company } from "@/types/company";
import { normalizeEntityParam } from "@/lib/resolvers/entity-resolver";
import {
  companyTrackingMatches,
  emailsIncludeAddress,
  isCompanyTrackingCode,
} from "@/lib/entity-route-utils";
import { withPrismaRetry } from "@/lib/prisma";
import {
  mapPrismaCompanyToApp,
  stableNumericId,
} from "@/lib/prisma-mappers";
import { readCompanies } from "@/lib/pipeline-db";

/**
 * Match company in live/JSON portfolio — id, CompanyID (code), name, domain, email.
 */
export function findCompanyInPortfolio(
  companies: Company[],
  routeKey: string,
): Company | undefined {
  const key = normalizeEntityParam(routeKey);
  if (!key) return undefined;
  const lower = key.toLowerCase();
  const upper = key.toUpperCase();

  return companies.find((company) => {
    const code = company.CompanyID?.trim() ?? "";
    if (code.toLowerCase() === lower || code.toUpperCase() === upper) return true;
    if (String(company.id).toLowerCase() === lower) return true;
    if (company.organizationNumber?.trim().toLowerCase() === lower) return true;
    if (company.Title?.trim().toLowerCase() === lower) return true;
    if (company.Domain?.trim().toLowerCase() === lower) return true;
    if (company.Email?.trim().toLowerCase() === lower) return true;
    return false;
  });
}

const companyInclude = {
  contacts: { where: { status: "active" as const } },
  opportunities: { select: { id: true } },
} as const;

/**
 * Prisma lookup by UUID id, organization number, name, or tracking code (CO-…).
 * There is no `code` column — CompanyID / orgnr act as the business code.
 * Never throws.
 */
export async function findPrismaCompanyByRouteKey(routeKey: string) {
  const cleanId = normalizeEntityParam(routeKey);
  if (!cleanId) return null;

  try {
    const byFields = await withPrismaRetry((prisma) =>
      prisma.company.findFirst({
        where: {
          OR: [
            { id: cleanId },
            { organizationNumber: cleanId },
            { organizationNumber: cleanId.toUpperCase() },
            { name: { equals: cleanId, mode: "insensitive" } },
            { alternativeNames: { has: cleanId } },
          ],
        },
        include: companyInclude,
      }),
    );
    if (byFields) return byFields;

    if (cleanId.includes("@")) {
      const withEmails = await withPrismaRetry((prisma) =>
        prisma.company.findMany({
          where: { status: { in: ["active", "archived"] } },
          include: companyInclude,
        }),
      );
      return (
        withEmails.find((row) => emailsIncludeAddress(row.emails, cleanId)) ?? null
      );
    }

    // Tracking codes (CO-…) and stable numeric ids require a scan — no DB `code` column.
    if (isCompanyTrackingCode(cleanId) || /^\d+$/.test(cleanId)) {
      const candidates = await withPrismaRetry((prisma) =>
        prisma.company.findMany({
          where: { status: { in: ["active", "archived"] } },
          include: companyInclude,
        }),
      );

      if (isCompanyTrackingCode(cleanId)) {
        return (
          candidates.find((row) => companyTrackingMatches(row.id, cleanId)) ?? null
        );
      }

      const numeric = Number(cleanId);
      return (
        candidates.find((row) => stableNumericId(row.id) === numeric) ?? null
      );
    }

    return null;
  } catch (error) {
    console.warn(
      "[companies-data] DB company lookup bypassed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

async function mapPrismaOrNull(
  routeKey: string,
): Promise<Company | null> {
  const row = await findPrismaCompanyByRouteKey(routeKey);
  if (!row) return null;
  return mapPrismaCompanyToApp(row);
}

/**
 * Flexible company entity resolver: Prisma by id OR code, then seed/portfolio
 * with the same matching logic before callers render "Company not found".
 */
export async function getCompanyById(
  rawId: string,
  seedCompanies?: Company[],
): Promise<Company | null> {
  const cleanId = normalizeEntityParam(rawId);
  if (!cleanId) return null;

  const fromPrisma = await mapPrismaOrNull(cleanId);
  if (fromPrisma) return fromPrisma;

  const seeds =
    seedCompanies ??
    (await readCompanies().catch(() => [] as Company[]));

  return findCompanyInPortfolio(seeds, cleanId) ?? null;
}

/** Alias used by pages/services. */
export const getCompany = getCompanyById;

/**
 * Resolve company for a detail route: portfolio/seed first for list-link IDs,
 * then Prisma (mapped to app Company even when not already in the portfolio).
 */
export async function resolveCompanyRouteRecord(
  companies: Company[],
  routeKey: string,
): Promise<Company | undefined> {
  const cleanId = normalizeEntityParam(routeKey);
  if (!cleanId) return undefined;

  const direct = findCompanyInPortfolio(companies, cleanId);
  if (direct) return direct;

  const fromPrisma = await mapPrismaOrNull(cleanId);
  if (fromPrisma) {
    // Prefer the live portfolio row when the same tracking id already exists
    // (keeps contact/pipeline wiring from the list load).
    const bridged =
      findCompanyInPortfolio(companies, fromPrisma.CompanyID) ??
      findCompanyInPortfolio(companies, String(fromPrisma.id));
    return bridged ?? fromPrisma;
  }

  // Final seed pass (same id OR code matching) — covers empty Prisma / connection miss.
  return findCompanyInPortfolio(companies, cleanId);
}
