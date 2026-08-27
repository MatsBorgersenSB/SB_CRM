import "server-only";

import { companyHeroQuickEditToPatch, parseCompanyAddressInput } from "@/lib/company-identity";
import {
  discoveryToCompanyCity,
  prepareDiscoveryForImport,
  resolveDiscoveryCompanyName,
} from "@/lib/discovery/website-discovery";
import type { DiscoveredContact, WebsiteDiscoveryResult } from "@/lib/discovery/types";
import { normalizeCompanyDomain } from "@/lib/company-domain";
import { normalizePhoneNumber } from "@/lib/m365/phone-normalization";
import {
  createCompany,
  createCompanyContact,
  updateCompany,
  updateCompanyContact,
} from "@/lib/pipeline-db";
import { readLiveCompanies } from "@/lib/prisma-data";
import { prismaDemoSeedCompanyWhere } from "@/lib/demo-seed-markers";
import { resolveAccountOwner } from "@/lib/company-owner";
import { emailsIncludeAddress } from "@/lib/entity-route-utils";
import { isInternalEmail } from "@/lib/domain-rules";
import { findPrismaCompanyByRouteKey } from "@/lib/resolve-company-route";
import { allocateNextCompanyCode, companyDetailInclude } from "@/lib/data/companies";
import { isPrismaConnectionError, withPrismaRetry } from "@/lib/prisma";
import {
  mapPrismaCompanyToApp,
  mapPrismaContactToApp,
  stableNumericId,
} from "@/lib/prisma-mappers";
import type { Company, SharePointPerson } from "@/types/company";
import type { ContactListRole } from "@/types/contact";
import { lookupAddressOSM } from "@/lib/geo/nominatim";
import { companyRouteKey } from "@/types/company-360";

export { prepareDiscoveryForImport } from "@/lib/discovery/website-discovery";

export type WebsiteDiscoveryImportInput = {
  discovery: WebsiteDiscoveryResult;
  selectedContactIds: string[];
  accountOwner?: SharePointPerson | null;
};

export type WebsiteDiscoveryImportResult = {
  company: Company;
  created: boolean;
  contactsImported: Contact[];
  contactsSkipped: number;
  contactsUpdated: number;
};

export type CompanyUpsertFromDiscoveryResult = {
  company: Company;
  created: boolean;
};

export type SingleContactImportResult = {
  status: "imported" | "skipped" | "updated";
  contact?: Contact;
  reason?: string;
};

type Contact = Company["contacts"][number];

function splitPersonName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Contact", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

function buildCompanyPatch(discovery: WebsiteDiscoveryResult) {
  const legacy = parseCompanyAddressInput(discovery.company.address);
  const streetAddress =
    discovery.company.streetAddress.trim() || legacy.AddressLine1.trim();
  const postalCode = discovery.company.postalCode.trim() || legacy.PostalCode.trim();
  const city =
    discovery.company.city.trim() ||
    legacy.City.trim() ||
    discoveryToCompanyCity(discovery);
  const countryName =
    discovery.company.country.trim() || legacy.Country?.Title?.trim() || "";
  const domain =
    normalizeCompanyDomain(discovery.company.domain) ||
    normalizeCompanyDomain(discovery.company.website);
  const title = resolveDiscoveryCompanyName(discovery.company.name, domain);

  return {
    Title: title,
    Domain: domain,
    Phone: normalizePhoneNumber(discovery.company.phone),
    Email: discovery.company.email.trim(),
    AddressLine1: streetAddress,
    AddressLine2: legacy.AddressLine2,
    PostalCode: postalCode,
    City: city === "—" ? "" : city,
    Country: countryName ? { Id: 0, Title: countryName } : legacy.Country,
    stateRegion: discovery.company.stateRegion.trim(),
    countryCode: discovery.company.countryCode.trim().toUpperCase(),
    continent: discovery.company.continent.trim() || "Europe",
    organizationNumber: discovery.company.registrationNumber?.trim() || undefined,
    vatNumber: discovery.company.vatNumber?.trim() || undefined,
    Notes: discovery.company.industryDescription?.trim()
      || (discovery.company.industryCode
        ? `Industry code: ${discovery.company.industryCode}`
        : undefined),
  };
}

function prismaGeoFromDiscovery(discovery: WebsiteDiscoveryResult, patch: ReturnType<typeof buildCompanyPatch>) {
  return {
    addressLine1: patch.AddressLine1 || null,
    addressLine2: patch.AddressLine2 || null,
    postalCode: patch.PostalCode || null,
    city: patch.City || null,
    stateRegion: patch.stateRegion || discovery.company.stateRegion.trim() || null,
    country: countryTitle(patch.Country) || discovery.company.country.trim() || null,
    countryCode: patch.countryCode || discovery.company.countryCode.trim().toUpperCase() || null,
    continent: patch.continent || discovery.company.continent.trim() || null,
  };
}

function countryTitle(country: Company["Country"] | string | null | undefined): string | null {
  if (!country) return null;
  if (typeof country === "string") return country.trim() || null;
  return country.Title?.trim() || null;
}

async function prismaRegistryAvailable(): Promise<boolean> {
  try {
    await withPrismaRetry((prisma) => prisma.company.findFirst({ select: { id: true } }));
    return true;
  } catch (error) {
    if (isPrismaConnectionError(error)) return false;
    // Missing env / adapter failures — fall back to JSON.
    console.warn(
      "[website-import] Prisma registry unavailable, using JSON store:",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

async function findPrismaCompanyByDomain(domain: string) {
  if (!domain) return null;
  const companies = await withPrismaRetry((prisma) =>
    prisma.company.findMany({
      where: { status: "active", NOT: prismaDemoSeedCompanyWhere },
      select: { id: true, website: true },
    }),
  );
  const match = companies.find(
    (company) => normalizeCompanyDomain(company.website ?? "") === domain,
  );
  if (!match) return null;
  return withPrismaRetry((prisma) =>
    prisma.company.findUnique({ where: { id: match.id } }),
  );
}

function buildContactCreateData(discovered: DiscoveredContact) {
  const { firstName, lastName } = splitPersonName(discovered.name);
  const email = discovered.email.trim().toLowerCase();
  const phone = normalizePhoneNumber(discovered.phone);
  const name = discovered.name.trim() || `${firstName} ${lastName}`.trim();

  return {
    firstName,
    lastName,
    fullName: name,
    jobTitle: discovered.jobTitle.trim() || null,
    status: "active" as const,
    emails: email ? [{ address: email, type: "work", isPrimary: true }] : [],
    phoneNumbers: phone ? [{ number: phone, type: "mobile", isPrimary: true }] : [],
  };
}

function contactAlreadyExists<T extends {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  emails?: unknown;
  jobTitle?: string | null;
  id: string;
}>(contacts: T[], discovered: DiscoveredContact): T | undefined {
  const email = discovered.email.trim().toLowerCase();
  const name = discovered.name.trim().toLowerCase();
  return contacts.find((contact) => {
    const fullName = (contact.fullName ?? `${contact.firstName ?? ""} ${contact.lastName ?? ""}`)
      .trim()
      .toLowerCase();
    return (
      (email && emailsIncludeAddress(contact.emails, email)) ||
      (name && fullName === name)
    );
  });
}

async function upsertCompanyFromDiscoveryPrisma(
  discovery: WebsiteDiscoveryResult,
  accountOwner?: SharePointPerson | null,
  selectedContacts: DiscoveredContact[] = [],
): Promise<
  CompanyUpsertFromDiscoveryResult & {
    contactsImported: Contact[];
    contactsSkipped: number;
    contactsUpdated: number;
  }
> {
  const prepared = prepareDiscoveryForImport(discovery);
  await enrichPreparedCompanyGeoWithOSM(prepared, discovery.company.address);
  const patch = buildCompanyPatch(prepared);
  const domain = normalizeCompanyDomain(prepared.company.domain);
  const owner = resolveAccountOwner(accountOwner);

  let existing =
    (prepared.matchedCompanyId
      ? await findPrismaCompanyByRouteKey(prepared.matchedCompanyId)
      : null) ?? (await findPrismaCompanyByDomain(domain));

  if (!existing && patch.organizationNumber) {
    existing = await findPrismaCompanyByRouteKey(patch.organizationNumber);
  }

  const emailJson = patch.Email
    ? [{ address: patch.Email, type: "work", isPrimary: true }]
    : [];
  const phoneJson = patch.Phone
    ? [{ number: patch.Phone, type: "office", isPrimary: true }]
    : [];
  const geo = prismaGeoFromDiscovery(prepared, patch);

  return withPrismaRetry(async (prisma) =>
    prisma.$transaction(async (tx) => {
      let created = false;
      const contactsImported: Contact[] = [];
      let contactsSkipped = 0;
      let contactsUpdated = 0;

      let companyRow: {
        id: string;
        name: string;
        code?: string | null;
      };

      if (existing) {
        const code = existing.code?.trim() || (await allocateNextCompanyCode(tx));
        companyRow = await tx.company.update({
          where: { id: existing.id },
          data: {
            code,
            name: patch.Title,
            website: domain ? `https://${domain}` : existing.website,
            industry: existing.industry ?? "Polymer Processing",
            addressLine1: geo.addressLine1 || existing.addressLine1,
            addressLine2: geo.addressLine2 || existing.addressLine2,
            postalCode: geo.postalCode || existing.postalCode,
            city: geo.city || existing.city,
            stateRegion: geo.stateRegion || existing.stateRegion,
            country: geo.country || existing.country,
            countryCode: geo.countryCode || existing.countryCode,
            continent: geo.continent || existing.continent || "Europe",
            organizationNumber:
              patch.organizationNumber?.trim() || existing.organizationNumber,
            vatNumber: patch.vatNumber?.trim() || existing.vatNumber,
            ownerId: accountOwner?.Title
              ? String(owner.Id)
              : existing.ownerId ?? String(owner.Id),
            ...(emailJson.length > 0 ? { emails: emailJson } : {}),
            ...(phoneJson.length > 0 ? { phoneNumbers: phoneJson } : {}),
          },
          select: { id: true, name: true, code: true },
        });

        const existingContacts = await tx.contact.findMany({
          where: { companyId: existing.id, status: "active" },
        });
        const lookup = {
          Id: stableNumericId(companyRow.id),
          Title: companyRow.name,
        };

        for (const discovered of selectedContacts) {
          if (isInternalEmail(discovered.email)) {
            contactsSkipped += 1;
            continue;
          }
          const prior = contactAlreadyExists(existingContacts, discovered);
          if (prior) {
            const jobTitle = discovered.jobTitle.trim();
            if (jobTitle && prior.jobTitle !== jobTitle) {
              await tx.contact.update({
                where: { id: prior.id },
                data: { jobTitle },
              });
              contactsUpdated += 1;
            } else {
              contactsSkipped += 1;
            }
            continue;
          }
          const createdContact = await tx.contact.create({
            data: {
              ...buildContactCreateData(discovered),
              companyId: existing.id,
            },
          });
          contactsImported.push(mapPrismaContactToApp(createdContact, lookup));
        }
      } else {
        created = true;
        const code = await allocateNextCompanyCode(tx);
        contactsSkipped += selectedContacts.filter((discovered) =>
          isInternalEmail(discovered.email),
        ).length;
        const contactCreates = selectedContacts
          .filter((discovered) => !isInternalEmail(discovered.email))
          .map((discovered) => buildContactCreateData(discovered));
        const createdCompany = await tx.company.create({
          data: {
            code,
            name: patch.Title,
            website: domain ? `https://${domain}` : null,
            industry: "Polymer Processing",
            types: ["Prospect"],
            companyType: "Prospect",
            status: "active",
            addressLine1: geo.addressLine1,
            addressLine2: geo.addressLine2,
            postalCode: geo.postalCode,
            city: geo.city,
            stateRegion: geo.stateRegion,
            country: geo.country,
            countryCode: geo.countryCode,
            continent: geo.continent || "Europe",
            organizationNumber: patch.organizationNumber?.trim() || null,
            vatNumber: patch.vatNumber?.trim() || null,
            ownerId: String(owner.Id),
            emails: emailJson,
            phoneNumbers: phoneJson,
            contacts:
              contactCreates.length > 0 ? { create: contactCreates } : undefined,
          },
          include: companyDetailInclude,
        });
        companyRow = createdCompany;
        const lookup = {
          Id: stableNumericId(createdCompany.id),
          Title: createdCompany.name,
        };
        for (const contact of createdCompany.contacts) {
          contactsImported.push(mapPrismaContactToApp(contact, lookup));
        }
      }

      const loaded = await tx.company.findUniqueOrThrow({
        where: { id: companyRow.id },
        include: companyDetailInclude,
      });

      return {
        company: mapPrismaCompanyToApp(loaded),
        created,
        contactsImported,
        contactsSkipped,
        contactsUpdated,
      };
    }),
  );
}

async function importContactPrisma(
  companyRouteId: string,
  discovered: DiscoveredContact,
): Promise<SingleContactImportResult> {
  const prismaCompany = await findPrismaCompanyByRouteKey(companyRouteId);
  if (!prismaCompany) {
    return { status: "skipped", reason: "Company not found" };
  }

  if (isInternalEmail(discovered.email)) {
    return { status: "skipped", reason: "Internal colleague — not a CRM contact" };
  }

  const contacts = await withPrismaRetry((prisma) =>
    prisma.contact.findMany({
      where: { companyId: prismaCompany.id, status: "active" },
    }),
  );

  const existing = contactAlreadyExists(contacts, discovered);
  const companyLookup = {
    Id: stableNumericId(prismaCompany.id),
    Title: prismaCompany.name,
  };

  if (existing) {
    const jobTitle = discovered.jobTitle.trim();
    if (jobTitle && existing.jobTitle !== jobTitle) {
      const updated = await withPrismaRetry((prisma) =>
        prisma.contact.update({
          where: { id: existing.id },
          data: { jobTitle },
        }),
      );
      return {
        status: "updated",
        contact: mapPrismaContactToApp(updated, companyLookup),
      };
    }
    return {
      status: "skipped",
      reason: "Already in CRM",
      contact: mapPrismaContactToApp(existing, companyLookup),
    };
  }

  const created = await withPrismaRetry((prisma) =>
    prisma.contact.create({
      data: {
        ...buildContactCreateData(discovered),
        companyId: prismaCompany.id,
      },
    }),
  );

  return {
    status: "imported",
    contact: mapPrismaContactToApp(created, companyLookup),
  };
}

async function enrichPreparedCompanyGeoWithOSM(
  prepared: WebsiteDiscoveryResult,
  rawAddress: string,
): Promise<void> {
  try {
    const osm = await lookupAddressOSM(rawAddress || prepared.company.address);
    const company = prepared.company;

    if (!company.streetAddress.trim() && osm.streetAddress.trim()) company.streetAddress = osm.streetAddress;
    if (!company.postalCode.trim() && osm.postalCode.trim()) company.postalCode = osm.postalCode;
    if (!company.city.trim() && osm.city.trim()) company.city = osm.city;
    if (!company.stateRegion.trim() && osm.stateRegion.trim()) company.stateRegion = osm.stateRegion;
    if (!company.country.trim() && osm.country.trim()) company.country = osm.country;
    if (!company.countryCode.trim() && osm.countryCode.trim()) company.countryCode = osm.countryCode;
    if (!company.continent.trim() && osm.continent.trim()) company.continent = osm.continent;
  } catch (error) {
    // Phase 1: geo enrichment is best-effort; discovery should still import.
    console.warn(
      "[website-import] OSM geo enrichment failed:",
      error instanceof Error ? error.message : error,
    );
  }
}

async function upsertCompanyFromDiscoveryJson(
  discovery: WebsiteDiscoveryResult,
  accountOwner?: SharePointPerson | null,
): Promise<CompanyUpsertFromDiscoveryResult> {
  const prepared = prepareDiscoveryForImport(discovery);
  await enrichPreparedCompanyGeoWithOSM(prepared, discovery.company.address);
  const companies = await readLiveCompanies();
  const domain = normalizeCompanyDomain(prepared.company.domain);

  let company =
    companies.find((record) => record.CompanyID === prepared.matchedCompanyId) ??
    companies.find((record) => normalizeCompanyDomain(record.Domain) === domain) ??
    null;

  let created = false;
  const patch = buildCompanyPatch(prepared);

  if (company) {
    const ownerPatch = accountOwner?.Title
      ? { AccountOwner: resolveAccountOwner(accountOwner) }
      : !company.AccountOwner
        ? { AccountOwner: resolveAccountOwner(null) }
        : {};
    company = await updateCompany(company.CompanyID, { ...patch, ...ownerPatch });
  } else {
    created = true;
    company = await createCompany({
      Title: patch.Title,
      Industry: "Polymer Processing",
      Status: "Prospecting",
      City: patch.City === "—" ? "" : patch.City,
      Domain: patch.Domain,
      Phone: patch.Phone,
      Email: patch.Email,
      AddressLine1: patch.AddressLine1,
      PostalCode: patch.PostalCode,
      Country: patch.Country,
      countryCode: patch.countryCode || null,
      continent: patch.continent || null,
      organizationNumber: patch.organizationNumber ?? null,
      vatNumber: patch.vatNumber ?? null,
      Notes: patch.Notes,
      AccountOwner: resolveAccountOwner(accountOwner),
    });

    if (patch.PostalCode || patch.City || patch.AddressLine2 || patch.stateRegion) {
      company = await updateCompany(company.CompanyID, {
        PostalCode: patch.PostalCode,
        City: patch.City === "—" ? "" : patch.City,
        AddressLine2: patch.AddressLine2,
        Country: patch.Country,
        stateRegion: patch.stateRegion,
        countryCode: patch.countryCode,
        continent: patch.continent,
        organizationNumber: patch.organizationNumber,
        vatNumber: patch.vatNumber,
      });
    }
  }

  return { company, created };
}

async function importContactJson(
  companyId: string,
  discovered: DiscoveredContact,
): Promise<SingleContactImportResult> {
  const companies = await readLiveCompanies();
  const company = companies.find((record) => record.CompanyID === companyId);
  if (!company) {
    return { status: "skipped", reason: "Company not found" };
  }

  const email = discovered.email.trim().toLowerCase();
  if (isInternalEmail(email)) {
    return { status: "skipped", reason: "Internal colleague — not a CRM contact" };
  }
  const existing = company.contacts.find(
    (contact) =>
      contact.Email.trim().toLowerCase() === email ||
      contact.Title.trim().toLowerCase() === discovered.name.trim().toLowerCase(),
  );

  if (existing) {
    const jobTitle = discovered.jobTitle.trim();
    if (jobTitle && existing.JobTitle !== jobTitle) {
      const updated = await updateCompanyContact(companyId, existing.ContactID, {
        JobTitle: jobTitle,
      });
      return { status: "updated", contact: updated };
    }
    return { status: "skipped", reason: "Already in CRM", contact: existing };
  }

  const imported = await importDiscoveredContactJson(company, discovered);
  if (!imported) {
    return { status: "skipped", reason: "Could not import contact" };
  }

  return { status: "imported", contact: imported };
}

async function importDiscoveredContactJson(
  company: Company,
  discovered: DiscoveredContact,
): Promise<Contact | null> {
  const email = discovered.email.trim().toLowerCase();
  const existing = company.contacts.find(
    (contact) =>
      contact.Email.trim().toLowerCase() === email ||
      contact.Title.trim().toLowerCase() === discovered.name.trim().toLowerCase(),
  );

  if (existing) return null;

  const { firstName, lastName } = splitPersonName(discovered.name);

  return createCompanyContact(company.CompanyID, {
    FirstName: firstName,
    LastName: lastName,
    JobTitle: discovered.jobTitle.trim(),
    Role: "Plant Manager" as ContactListRole,
    Email: email,
    Company: { CompanyID: company.CompanyID },
    Phone: "",
    Mobile: normalizePhoneNumber(discovered.phone),
    LinkedInURL: "",
    Status: "Prospecting",
    RelationshipLevel: "Operational",
  });
}

export async function upsertCompanyFromDiscovery(
  discovery: WebsiteDiscoveryResult,
  accountOwner?: SharePointPerson | null,
): Promise<CompanyUpsertFromDiscoveryResult> {
  if (await prismaRegistryAvailable()) {
    const result = await upsertCompanyFromDiscoveryPrisma(discovery, accountOwner, []);
    return { company: result.company, created: result.created };
  }
  return upsertCompanyFromDiscoveryJson(discovery, accountOwner);
}

export async function importDiscoveredContactForCompany(
  companyId: string,
  discovered: DiscoveredContact,
): Promise<SingleContactImportResult> {
  if (await prismaRegistryAvailable()) {
    return importContactPrisma(companyId, discovered);
  }
  return importContactJson(companyId, discovered);
}

export async function importWebsiteDiscovery(
  input: WebsiteDiscoveryImportInput,
): Promise<WebsiteDiscoveryImportResult> {
  const selectedIds = new Set(input.selectedContactIds);
  const selectedContacts = input.discovery.contacts.filter((contact) =>
    selectedIds.has(contact.id),
  );

  if (await prismaRegistryAvailable()) {
    const result = await upsertCompanyFromDiscoveryPrisma(
      input.discovery,
      input.accountOwner,
      selectedContacts,
    );
    return {
      company: result.company,
      created: result.created,
      contactsImported: result.contactsImported,
      contactsSkipped: result.contactsSkipped,
      contactsUpdated: result.contactsUpdated,
    };
  }

  const { company, created } = await upsertCompanyFromDiscoveryJson(
    input.discovery,
    input.accountOwner,
  );

  const contactsImported: Contact[] = [];
  let contactsSkipped = 0;
  let contactsUpdated = 0;

  for (const discovered of selectedContacts) {
    const result = await importContactJson(companyRouteKey(company), discovered);
    if (result.status === "imported" && result.contact) {
      contactsImported.push(result.contact);
    } else if (result.status === "updated" && result.contact) {
      contactsUpdated += 1;
    } else {
      contactsSkipped += 1;
    }
  }

  const refreshed =
    (await readLiveCompanies()).find(
      (record) => record.CompanyID === company.CompanyID || record.code === company.code,
    ) ?? company;

  return {
    company: refreshed,
    created,
    contactsImported,
    contactsSkipped,
    contactsUpdated,
  };
}

export function discoveryCompanyPreviewPatch(discovery: WebsiteDiscoveryResult) {
  const prepared = prepareDiscoveryForImport(discovery);
  return companyHeroQuickEditToPatch(
    {
      Title: prepared.company.name,
      Industry: "Polymer Processing",
      parentCompanyId: "",
      accountOwnerId: 0,
      Phone: prepared.company.phone,
      Email: prepared.company.email,
      Domain: prepared.company.website,
      streetAddress: prepared.company.streetAddress,
      postalCode: prepared.company.postalCode,
      city: prepared.company.city,
      stateRegion: prepared.company.stateRegion,
      country: prepared.company.country,
      countryCode: prepared.company.countryCode,
      continent: prepared.company.continent,
      CompanyTypes: ["Prospect"],
      tagsInput: "",
      Notes: "",
    },
    [],
  );
}
