import type { Company } from "@/types/company";
import {
  companyTrackingMatches,
  emailsIncludeAddress,
  isCompanyTrackingCode,
} from "@/lib/entity-route-utils";
import { withPrismaRetry } from "@/lib/prisma";
import { toCompanyTrackingId } from "@/lib/prisma-mappers";
import { resolveEntity } from "@/lib/resolvers/entity-resolver";

/** Match company in live/JSON portfolio by id, CO- code, name, domain, or email. */
export function findCompanyInPortfolio(
  companies: Company[],
  routeKey: string,
): Company | undefined {
  const key = routeKey.trim();
  if (!key) return undefined;
  const lower = key.toLowerCase();

  return companies.find((company) => {
    if (company.CompanyID === key || company.CompanyID?.toLowerCase() === lower) {
      return true;
    }
    if (String(company.id) === key || String(company.id).toLowerCase() === lower) {
      return true;
    }
    if (company.Title?.trim().toLowerCase() === lower) return true;
    if (company.Domain?.trim().toLowerCase() === lower) return true;
    if (company.Email?.trim().toLowerCase() === lower) return true;
    return false;
  });
}

/**
 * Prisma lookup by id, name, org number, or CO- tracking code.
 * Never throws — returns null on miss / DB errors.
 */
export async function findPrismaCompanyByRouteKey(routeKey: string) {
  const key = routeKey.trim();
  if (!key) return null;

  try {
    const byFields = await withPrismaRetry((prisma) =>
      prisma.company.findFirst({
        where: {
          OR: [
            { id: key },
            { name: { equals: key, mode: "insensitive" } },
            { organizationNumber: key },
            { alternativeNames: { has: key } },
          ],
        },
      }),
    );
    if (byFields) return byFields;

    if (key.includes("@")) {
      const withEmails = await withPrismaRetry((prisma) =>
        prisma.company.findMany({
          where: { status: "active" },
        }),
      );
      return (
        withEmails.find((row) => emailsIncludeAddress(row.emails, key)) ?? null
      );
    }

    if (isCompanyTrackingCode(key)) {
      const candidates = await withPrismaRetry((prisma) =>
        prisma.company.findMany({
          where: { status: { in: ["active", "archived"] } },
        }),
      );
      return candidates.find((row) => companyTrackingMatches(row.id, key)) ?? null;
    }

    return null;
  } catch (error) {
    console.warn(
      "[resolve-company-route] Prisma company lookup failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * Resolve company route via universal entity resolver (Prisma → portfolio/seed).
 */
export async function resolveCompanyRouteRecord(
  companies: Company[],
  routeKey: string,
): Promise<Company | undefined> {
  const record = await resolveEntity(
    routeKey,
    async (searchKey) => {
      const prismaCompany = await findPrismaCompanyByRouteKey(searchKey);
      if (!prismaCompany) return null;
      return (
        findCompanyInPortfolio(companies, toCompanyTrackingId(prismaCompany.id)) ??
        findCompanyInPortfolio(companies, prismaCompany.id) ??
        findCompanyInPortfolio(companies, prismaCompany.name) ??
        null
      );
    },
    companies as Array<Company & Record<string, unknown>>,
    {
      matchKeys: ["CompanyID", "Title", "Domain", "Email"],
      getMatchValues: (company) => [company.id, String(company.id)],
    },
  );

  return record ?? undefined;
}
