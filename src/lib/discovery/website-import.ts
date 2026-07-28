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
  readCompanies,
  updateCompany,
  updateCompanyContact,
} from "@/lib/pipeline-db";
import { resolveAccountOwner } from "@/lib/company-owner";
import { emailsIncludeAddress } from "@/lib/entity-route-utils";
import { findPrismaCompanyByRouteKey } from "@/lib/resolve-company-route";
import { isPrismaConnectionError, withPrismaRetry } from "@/lib/prisma";
import {
  mapPrismaCompanyToApp,
  mapPrismaContactToApp,
  stableNumericId,
} from "@/lib/prisma-mappers";
import type { Company, SharePointPerson } from "@/types/company";
import type { ContactListRole } from "@/types/contact";

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
  const address = parseCompanyAddressInput(discovery.company.address);
  const city = address.City.trim() || discoveryToCompanyCity(discovery);
  const domain =
    normalizeCompanyDomain(discovery.company.domain) ||
    normalizeCompanyDomain(discovery.company.website);
  const title = resolveDiscoveryCompanyName(discovery.company.name, domain);

  return {
    Title: title,
    Domain: domain,
    Phone: normalizePhoneNumber(discovery.company.phone),
    Email: discovery.company.email.trim(),
    ...address,
    City: city === "—" ? "" : city,
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

async function loadMappedPrismaCompany(prismaId: string): Promise<Company> {
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

async function findPrismaCompanyByDomain(domain: string) {
  if (!domain) return null;
  const companies = await withPrismaRetry((prisma) =>
    prisma.company.findMany({
      where: { status: "active" },
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

async function upsertCompanyFromDiscoveryPrisma(
  discovery: WebsiteDiscoveryResult,
  accountOwner?: SharePointPerson | null,
): Promise<CompanyUpsertFromDiscoveryResult> {
  const prepared = prepareDiscoveryForImport(discovery);
  const patch = buildCompanyPatch(prepared);
  const domain = normalizeCompanyDomain(prepared.company.domain);
  const owner = resolveAccountOwner(accountOwner);

  let existing =
    (prepared.matchedCompanyId
      ? await findPrismaCompanyByRouteKey(prepared.matchedCompanyId)
      : null) ?? (await findPrismaCompanyByDomain(domain));

  const emailJson = patch.Email
    ? [{ address: patch.Email, type: "work", isPrimary: true }]
    : [];
  const phoneJson = patch.Phone
    ? [{ number: patch.Phone, type: "office", isPrimary: true }]
    : [];

  if (existing) {
    const updated = await withPrismaRetry((prisma) =>
      prisma.company.update({
        where: { id: existing!.id },
        data: {
          name: patch.Title,
          website: domain ? `https://${domain}` : existing!.website,
          industry: existing!.industry ?? "Polymer Processing",
          city: patch.City || existing!.city,
          addressLine1: patch.AddressLine1 || existing!.addressLine1,
          addressLine2: patch.AddressLine2 || existing!.addressLine2,
          postalCode: patch.PostalCode || existing!.postalCode,
          country: countryTitle(patch.Country) ?? existing!.country,
          ownerId: accountOwner?.Title ? String(owner.Id) : existing!.ownerId ?? String(owner.Id),
          ...(emailJson.length > 0 ? { emails: emailJson } : {}),
          ...(phoneJson.length > 0 ? { phoneNumbers: phoneJson } : {}),
        },
      }),
    );
    return { company: await loadMappedPrismaCompany(updated.id), created: false };
  }

  const created = await withPrismaRetry((prisma) =>
    prisma.company.create({
      data: {
        name: patch.Title,
        website: domain ? `https://${domain}` : null,
        industry: "Polymer Processing",
        types: ["prospect"],
        status: "active",
        city: patch.City || null,
        addressLine1: patch.AddressLine1 || null,
        addressLine2: patch.AddressLine2 || null,
        postalCode: patch.PostalCode || null,
        country: countryTitle(patch.Country),
        ownerId: String(owner.Id),
        emails: emailJson,
        phoneNumbers: phoneJson,
      },
    }),
  );

  return { company: await loadMappedPrismaCompany(created.id), created: true };
}

async function importContactPrisma(
  companyRouteId: string,
  discovered: DiscoveredContact,
): Promise<SingleContactImportResult> {
  const prismaCompany = await findPrismaCompanyByRouteKey(companyRouteId);
  if (!prismaCompany) {
    return { status: "skipped", reason: "Company not found" };
  }

  const email = discovered.email.trim().toLowerCase();
  const name = discovered.name.trim();
  const contacts = await withPrismaRetry((prisma) =>
    prisma.contact.findMany({
      where: { companyId: prismaCompany.id, status: "active" },
    }),
  );

  const existing = contacts.find((contact) => {
    const fullName = (contact.fullName ?? `${contact.firstName ?? ""} ${contact.lastName ?? ""}`)
      .trim()
      .toLowerCase();
    return (
      (email && emailsIncludeAddress(contact.emails, email)) ||
      (name && fullName === name.toLowerCase())
    );
  });

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

  const { firstName, lastName } = splitPersonName(discovered.name);
  const phone = normalizePhoneNumber(discovered.phone);
  const created = await withPrismaRetry((prisma) =>
    prisma.contact.create({
      data: {
        firstName,
        lastName,
        fullName: name || `${firstName} ${lastName}`.trim(),
        jobTitle: discovered.jobTitle.trim() || null,
        companyId: prismaCompany.id,
        status: "active",
        emails: email ? [{ address: email, type: "work", isPrimary: true }] : [],
        phoneNumbers: phone ? [{ number: phone, type: "mobile", isPrimary: true }] : [],
      },
    }),
  );

  return {
    status: "imported",
    contact: mapPrismaContactToApp(created, companyLookup),
  };
}

async function upsertCompanyFromDiscoveryJson(
  discovery: WebsiteDiscoveryResult,
  accountOwner?: SharePointPerson | null,
): Promise<CompanyUpsertFromDiscoveryResult> {
  const prepared = prepareDiscoveryForImport(discovery);
  const companies = await readCompanies();
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
      Country: patch.Country,
      AccountOwner: resolveAccountOwner(accountOwner),
    });

    if (patch.PostalCode || patch.City || patch.AddressLine2) {
      company = await updateCompany(company.CompanyID, {
        PostalCode: patch.PostalCode,
        City: patch.City === "—" ? "" : patch.City,
        AddressLine2: patch.AddressLine2,
        Country: patch.Country,
      });
    }
  }

  return { company, created };
}

async function importContactJson(
  companyId: string,
  discovered: DiscoveredContact,
): Promise<SingleContactImportResult> {
  const companies = await readCompanies();
  const company = companies.find((record) => record.CompanyID === companyId);
  if (!company) {
    return { status: "skipped", reason: "Company not found" };
  }

  const email = discovered.email.trim().toLowerCase();
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
    return upsertCompanyFromDiscoveryPrisma(discovery, accountOwner);
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

  const { company, created } = await upsertCompanyFromDiscovery(
    input.discovery,
    input.accountOwner,
  );

  const contactsImported: Contact[] = [];
  let contactsSkipped = 0;
  let contactsUpdated = 0;

  for (const discovered of selectedContacts) {
    const result = await importDiscoveredContactForCompany(company.CompanyID, discovered);
    if (result.status === "imported" && result.contact) {
      contactsImported.push(result.contact);
    } else if (result.status === "updated" && result.contact) {
      contactsUpdated += 1;
    } else {
      contactsSkipped += 1;
    }
  }

  let refreshed = company;
  if (await prismaRegistryAvailable()) {
    const prismaCompany = await findPrismaCompanyByRouteKey(company.CompanyID);
    if (prismaCompany) {
      refreshed = await loadMappedPrismaCompany(prismaCompany.id);
    }
  } else {
    refreshed =
      (await readCompanies()).find((record) => record.CompanyID === company.CompanyID) ??
      company;
  }

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
      address: prepared.company.address,
      CompanyTypes: ["Prospect"],
      tagsInput: "",
      Notes: "",
    },
    [],
  );
}
