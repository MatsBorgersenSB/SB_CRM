import "server-only";

import type { NewCompanyInput } from "@/lib/entity-id";
import { normalizeCompanyDomain } from "@/lib/company-domain";
import { toStoredCompanyTypes } from "@/lib/company-classification";
import {
  getContinentByCountryCode,
  resolveCountry,
} from "@/lib/geo/country-continent";
import { isPrismaConnectionError, withPrismaRetry } from "@/lib/prisma";
import {
  mapPrismaCompanyToApp,
  stableNumericId,
} from "@/lib/prisma-mappers";
import { allocateNextCompanyCode } from "@/lib/data/companies";
import { findPrismaCompanyByRouteKey } from "@/lib/resolve-company-route";
import { prismaLiveCompanyWhere } from "@/lib/demo-seed-markers";
import type { UpdateCompanyPatch } from "@/lib/pipeline-db";
import { readCompanies } from "@/lib/pipeline-db";
import type { Company, SharePointPerson } from "@/types/company";
import type { CompanyType } from "@/types/company-type";
import { normalizeCompanySectors } from "@/lib/company-sectors";

async function prismaRegistryAvailable(): Promise<boolean> {
  try {
    await withPrismaRetry((prisma) => prisma.company.findFirst({ select: { id: true } }));
    return true;
  } catch (error) {
    if (!isPrismaConnectionError(error)) {
      console.warn(
        "[company-registry] Prisma unavailable:",
        error instanceof Error ? error.message : error,
      );
    }
    return false;
  }
}

export async function loadMappedPrismaCompany(prismaId: string): Promise<Company> {
  const row = await withPrismaRetry((prisma) =>
    prisma.company.findUniqueOrThrow({
      where: { id: prismaId },
      include: {
        contacts: { where: { status: "active" } },
        opportunities: { select: { id: true } },
      },
    }),
  );
  return mapPrismaCompanyToApp(row);
}

function toPrismaCompanyTypes(types: CompanyType[] | undefined): string[] {
  return toStoredCompanyTypes(types);
}

function countryTitle(
  country: Company["Country"] | string | null | undefined,
): string | null {
  if (!country) return null;
  if (typeof country === "string") return country.trim() || null;
  return country.Title?.trim() || null;
}

function geoFromCountryTitle(country: string | null | undefined): {
  country: string | null;
  countryCode: string | null;
  continent: string | null;
} {
  if (!country?.trim()) {
    return { country: null, countryCode: null, continent: null };
  }
  const resolved = resolveCountry(country);
  if (!resolved) {
    return { country: country.trim(), countryCode: null, continent: null };
  }
  return {
    country: resolved.name,
    countryCode: resolved.code,
    continent: getContinentByCountryCode(resolved.code) || null,
  };
}

async function resolvePrismaParentId(
  parent: SharePointPerson | null | undefined,
): Promise<string | null | undefined> {
  if (parent === undefined) return undefined;
  if (parent === null || !parent.Id) return null;

  const companies = await withPrismaRetry((prisma) =>
    prisma.company.findMany({
      where: prismaLiveCompanyWhere,
      select: { id: true, name: true },
    }),
  );
  const byNumeric = companies.find((row) => stableNumericId(row.id) === parent.Id);
  if (byNumeric) return byNumeric.id;

  const byName = companies.find(
    (row) => row.name.trim().toLowerCase() === parent.Title.trim().toLowerCase(),
  );
  return byName?.id ?? null;
}

function websiteFromDomain(domain: string | undefined, fallback: string | null): string | null {
  if (domain === undefined) return fallback;
  const normalized = normalizeCompanyDomain(domain);
  return normalized ? `https://${normalized}` : null;
}

/** Prefer Prisma registry when available; otherwise return null so callers use JSON. */
export async function getRegistryCompanyById(
  id: string | number,
): Promise<Company | null> {
  if (!(await prismaRegistryAvailable())) return null;

  const row = await findPrismaCompanyByRouteKey(String(id));
  if (!row) return null;
  return loadMappedPrismaCompany(row.id);
}

export async function createRegistryCompany(
  input: NewCompanyInput,
): Promise<Company | null> {
  if (!(await prismaRegistryAvailable())) return null;

  const domain = normalizeCompanyDomain(input.Domain);
  const ownerId = input.AccountOwner?.Id != null ? String(input.AccountOwner.Id) : null;
  const countryGeo = geoFromCountryTitle(countryTitle(input.Country));
  const storedTypes = toPrismaCompanyTypes(input.CompanyTypes);
  const organizationNumber = input.organizationNumber?.trim() || null;

  if (organizationNumber) {
    const existingByOrg = await withPrismaRetry((prisma) =>
      prisma.company.findFirst({
        where: {
          OR: [
            { organizationNumber },
            { organizationNumber: organizationNumber.toUpperCase() },
            { organizationNumber: organizationNumber.toLowerCase() },
          ],
        },
        select: { id: true, name: true },
      }),
    );
    if (existingByOrg) {
      throw new Error(
        `Registration number ${organizationNumber} is already used by ${existingByOrg.name}. Open that company instead of creating a duplicate.`,
      );
    }
  }

  if (domain) {
    const existingByDomain = await withPrismaRetry((prisma) =>
      prisma.company.findFirst({
        where: {
          OR: [
            { website: { equals: `https://${domain}`, mode: "insensitive" } },
            { website: { equals: `http://${domain}`, mode: "insensitive" } },
            { website: { equals: domain, mode: "insensitive" } },
            { website: { endsWith: `://${domain}`, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true },
      }),
    );
    if (existingByDomain) {
      throw new Error(
        `A company with domain ${domain} already exists (${existingByDomain.name}). Link to that company instead of creating a duplicate.`,
      );
    }
  }

  const created = await withPrismaRetry(async (prisma) => {
    const code = await allocateNextCompanyCode(prisma);
    return prisma.company.create({
      data: {
        code,
        name: input.Title.trim(),
        website: domain ? `https://${domain}` : null,
        industry: input.Industry || "Other",
        sectors: normalizeCompanySectors(input.Sectors),
        types: storedTypes,
        companyType: storedTypes[0] ?? "Unclassified",
        status: "active",
        city: input.City || null,
        addressLine1: input.AddressLine1 || null,
        postalCode: input.PostalCode || null,
        country: countryGeo.country,
        countryCode: input.countryCode?.trim().toUpperCase() || countryGeo.countryCode,
        continent: input.continent?.trim() || countryGeo.continent,
        organizationNumber,
        vatNumber: input.vatNumber?.trim() || null,
        ownerId,
        emails: input.Email
          ? [{ address: input.Email, type: "work", isPrimary: true }]
          : [],
        phoneNumbers: input.Phone
          ? [{ number: input.Phone, type: "office", isPrimary: true }]
          : [],
      },
    });
  });

  if (input.Notes?.trim()) {
    await withPrismaRetry((prisma) =>
      prisma.companyNote.create({
        data: {
          companyId: created.id,
          authorId: ownerId ?? "system",
          content: input.Notes!.trim(),
        },
      }),
    ).catch(() => undefined);
  }

  return loadMappedPrismaCompany(created.id);
}

export async function updateRegistryCompany(
  id: string | number,
  patch: UpdateCompanyPatch,
): Promise<Company | null> {
  if (!(await prismaRegistryAvailable())) return null;

  let existing = await findPrismaCompanyByRouteKey(String(id));

  // Portfolio may still serve JSON-seeded CO-… records while Prisma is empty.
  // Promote that row into the registry on first save so edits are durable on Vercel.
  // Never promote seed companies in live production.
  if (!existing) {
    const { shouldFallbackToJsonPortfolio } = await import("@/lib/prisma-data");
    if (!shouldFallbackToJsonPortfolio()) return null;

    const jsonCompanies = await readCompanies();
    const jsonCompany = jsonCompanies.find(
      (row) => row.CompanyID === String(id) || String(row.id) === String(id),
    );
    if (!jsonCompany) return null;

    const domain = normalizeCompanyDomain(patch.Domain ?? jsonCompany.Domain);
    const owner = patch.AccountOwner ?? jsonCompany.AccountOwner;
    const countryGeo = geoFromCountryTitle(
      countryTitle(patch.Country ?? jsonCompany.Country),
    );
    const created = await withPrismaRetry(async (prisma) => {
      const code =
        /^CO-[A-Z0-9]+$/i.test(jsonCompany.CompanyID.trim())
          ? jsonCompany.CompanyID.trim().toUpperCase()
          : await allocateNextCompanyCode(prisma, jsonCompanies);
      return prisma.company.create({
        data: {
          code,
          name: (patch.Title ?? jsonCompany.Title).trim(),
          website: domain ? `https://${domain}` : null,
          industry: patch.Industry ?? jsonCompany.Industry ?? "Other",
          sectors: normalizeCompanySectors(patch.Sectors ?? jsonCompany.Sectors),
          types: toPrismaCompanyTypes(patch.CompanyTypes ?? jsonCompany.CompanyTypes),
          companyType:
            toPrismaCompanyTypes(patch.CompanyTypes ?? jsonCompany.CompanyTypes)[0] ??
            "Unclassified",
          status: "active",
          city: patch.City ?? jsonCompany.City ?? null,
          addressLine1: patch.AddressLine1 ?? jsonCompany.AddressLine1 ?? null,
          addressLine2: patch.AddressLine2 ?? jsonCompany.AddressLine2 ?? null,
          postalCode: patch.PostalCode ?? jsonCompany.PostalCode ?? null,
          country: countryGeo.country,
          countryCode: countryGeo.countryCode,
          continent: countryGeo.continent,
          organizationNumber: patch.organizationNumber ?? jsonCompany.organizationNumber ?? null,
          vatNumber: patch.vatNumber ?? jsonCompany.vatNumber ?? null,
          ownerId: owner?.Id != null ? String(owner.Id) : null,
          emails: (patch.Email ?? jsonCompany.Email)
            ? [
                {
                  address: (patch.Email ?? jsonCompany.Email).trim().toLowerCase(),
                  type: "work",
                  isPrimary: true,
                },
              ]
            : [],
          phoneNumbers: (patch.Phone ?? jsonCompany.Phone)
            ? [
                {
                  number: (patch.Phone ?? jsonCompany.Phone).trim(),
                  type: "office",
                  isPrimary: true,
                },
              ]
            : [],
        },
      });
    });

    if (patch.Notes?.trim()) {
      await withPrismaRetry((prisma) =>
        prisma.companyNote.create({
          data: {
            companyId: created.id,
            authorId: String(owner?.Id ?? "system"),
            content: patch.Notes!.trim(),
          },
        }),
      ).catch(() => undefined);
    }

    return loadMappedPrismaCompany(created.id);
  }

  const parentCompanyId = await resolvePrismaParentId(patch.ParentCompany);
  const domain =
    patch.Domain !== undefined ? normalizeCompanyDomain(patch.Domain) : undefined;

  const data: Record<string, unknown> = {};
  if (patch.Title !== undefined) data.name = patch.Title.trim();
  if (domain !== undefined) data.website = websiteFromDomain(domain, existing.website);
  if (patch.Industry !== undefined) data.industry = patch.Industry;
  if (patch.Sectors !== undefined) data.sectors = normalizeCompanySectors(patch.Sectors);
  if (patch.CompanyTypes !== undefined) {
    const storedTypes = toPrismaCompanyTypes(patch.CompanyTypes);
    data.types = storedTypes;
    data.companyType = storedTypes[0] ?? "Unclassified";
  }
  if (patch.City !== undefined) data.city = patch.City || null;
  if (patch.AddressLine1 !== undefined) data.addressLine1 = patch.AddressLine1 || null;
  if (patch.AddressLine2 !== undefined) data.addressLine2 = patch.AddressLine2 || null;
  if (patch.PostalCode !== undefined) data.postalCode = patch.PostalCode || null;
  if (patch.stateRegion !== undefined) data.stateRegion = patch.stateRegion || null;
  if (patch.Country !== undefined) {
    const countryGeo = geoFromCountryTitle(countryTitle(patch.Country));
    data.country = countryGeo.country;
    data.countryCode = countryGeo.countryCode;
    data.continent = countryGeo.continent;
  }
  if (patch.countryCode !== undefined) data.countryCode = patch.countryCode || null;
  if (patch.continent !== undefined) data.continent = patch.continent || null;
  if (patch.organizationNumber !== undefined) {
    data.organizationNumber = patch.organizationNumber?.trim() || null;
  }
  if (patch.vatNumber !== undefined) {
    data.vatNumber = patch.vatNumber?.trim() || null;
  }
  if (patch.AccountOwner !== undefined) {
    data.ownerId =
      patch.AccountOwner?.Id != null ? String(patch.AccountOwner.Id) : null;
  }
  if (parentCompanyId !== undefined) data.parentCompanyId = parentCompanyId;
  if (patch.Email !== undefined) {
    data.emails = patch.Email.trim()
      ? [{ address: patch.Email.trim().toLowerCase(), type: "work", isPrimary: true }]
      : [];
  }
  if (patch.Phone !== undefined) {
    data.phoneNumbers = patch.Phone.trim()
      ? [{ number: patch.Phone.trim(), type: "office", isPrimary: true }]
      : [];
  }
  if (patch.Status !== undefined) {
    data.status = patch.Status === "Inactive" ? "archived" : "active";
  }

  const updated = await withPrismaRetry((prisma) =>
    prisma.company.update({
      where: { id: existing.id },
      data,
    }),
  );

  if (patch.Notes?.trim()) {
    await withPrismaRetry((prisma) =>
      prisma.companyNote.create({
        data: {
          companyId: updated.id,
          authorId: String(patch.AccountOwner?.Id ?? existing.ownerId ?? "system"),
          content: patch.Notes!.trim(),
        },
      }),
    ).catch((error) => {
      console.warn(
        "[company-registry] Could not persist company note:",
        error instanceof Error ? error.message : error,
      );
    });
  }

  return loadMappedPrismaCompany(updated.id);
}

export async function deleteRegistryCompany(id: string | number): Promise<boolean> {
  if (!(await prismaRegistryAvailable())) return false;

  const existing = await findPrismaCompanyByRouteKey(String(id));
  if (!existing) return false;

  await withPrismaRetry((prisma) =>
    prisma.company.update({
      where: { id: existing.id },
      data: { status: "archived" },
    }),
  );
  return true;
}
