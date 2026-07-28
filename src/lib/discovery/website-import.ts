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

export async function upsertCompanyFromDiscovery(
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
    // Always apply owner when provided so Mats (or selected owner) sticks on import
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

export async function importDiscoveredContactForCompany(
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

  const imported = await importDiscoveredContact(company, discovered);
  if (!imported) {
    return { status: "skipped", reason: "Could not import contact" };
  }

  return { status: "imported", contact: imported };
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

  const refreshed = (await readCompanies()).find(
    (record) => record.CompanyID === company.CompanyID,
  )!;

  return {
    company: refreshed,
    created,
    contactsImported,
    contactsSkipped,
    contactsUpdated,
  };
}

async function importDiscoveredContact(
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
