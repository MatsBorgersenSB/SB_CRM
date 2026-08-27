import {
  createCompanyContact,
  updateCompany,
} from "@/lib/pipeline-db";
import { createRegistryCompany, loadMappedPrismaCompany } from "@/lib/company-registry";
import { createRegistryContact, getRegistryContactById } from "@/lib/contact-registry";
import { findPrismaContactByIdOrEmail } from "@/lib/resolve-contact-route";
import { mapPrismaContactToApp } from "@/lib/prisma-mappers";
import { readLiveCompanies } from "@/lib/prisma-data";
import { findPrismaCompanyByRouteKey } from "@/lib/resolve-company-route";
import { resolveAccountOwner } from "@/lib/company-owner";
import { buildM365RelationshipCard } from "@/lib/m365/relationship-card";
import { loadM365DataContext } from "@/lib/m365/resolve-context";
import type { M365RelationshipCardPayload } from "@/types/m365";
import type { Contact, ContactListRole, ContactStatus, RelationshipLevel } from "@/types/contact";
import { getContactDisplayName } from "@/types/contact";
import {
  resolveContactListRole,
  suggestContactListRoleFromTitle,
} from "@/types/contact";
import type { Company, CompanyIndustry } from "@/types/company";
import { resolveCompanyIndustry } from "@/types/company";
import type { CompanyType } from "@/types/company-type";
import { canonicalizeCompanyType, COMPANY_TYPE_SELECT_OPTIONS } from "@/types/company-type";
import { extractEmailDomain, parsePersonName } from "@/lib/m365/outlook-sender-utils";
import { isInternalEmail } from "@/lib/domain-rules";
import {
  parseSignatureIntelligence,
  parseSignaturePersonName,
  websiteToDomain,
} from "@/lib/m365/signature-intelligence";
import { normalizePhoneNumber } from "@/lib/m365/phone-normalization";
import { parseCompanyAddressInput } from "@/lib/company-identity";
import {
  buildOutlookCompanyDisplay,
  listOutlookCompanyOptions,
  resolveCompanyForEmail,
  titleForNewCompanyCreation,
} from "@/lib/m365/company-resolution";
import { logOutlookImport } from "@/lib/m365/outlook-import-diagnostics";
import {
  assertExternalContactEmail,
  resolveInternalColleague,
} from "@/lib/internal-colleague";

export type { OutlookSenderPrepopulation } from "@/lib/m365/outlook-sender-types";

import type {
  OutlookAddContactInput,
  OutlookAddContactResult,
  OutlookContactEnrichment,
  OutlookSenderPrepopulation,
} from "@/lib/m365/outlook-sender-types";

export type { OutlookAddContactInput, OutlookAddContactResult };

export { resolveCompanyByDomain, resolveCompanyByName, resolveCompanyForEmail, canonicalCompanyDisplayName } from "@/lib/m365/company-resolution";

const PERSONAL_DOMAINS = new Set([
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "icloud.com",
  "live.com",
]);

function buildCompanyEnrichmentPatch(
  enrichment: OutlookContactEnrichment,
): Parameters<typeof updateCompany>[1] {
  const patch: Parameters<typeof updateCompany>[1] = {};

  if (enrichment.phone?.trim()) {
    patch.Phone = normalizePhoneNumber(enrichment.phone);
  }

  if (enrichment.address?.trim()) {
    Object.assign(patch, parseCompanyAddressInput(enrichment.address));
  }

  // Do not patch Domain from body websites — survey/vendor links (e.g. Questback)
  // must never overwrite an existing company domain.

  return patch;
}

export async function buildOutlookSenderPrepopulation(input: {
  email: string;
  displayName?: string;
  messageBody?: string;
}): Promise<OutlookSenderPrepopulation> {
  const email = input.email.trim().toLowerCase();
  const messageBody = input.messageBody ?? "";

  logOutlookImport("RAW SIGNATURE", {
    email,
    displayName: input.displayName ?? null,
    messageBodyLength: messageBody.length,
    messageBodyPreview: messageBody.slice(0, 500),
  });

  const signatureName = parseSignaturePersonName(messageBody, email);
  const parsed = parsePersonName(input.displayName ?? signatureName ?? "", email);
  const domain = extractEmailDomain(email);
  const companies = await readLiveCompanies().catch(() => [] as Company[]);

  const enrichment = parseSignatureIntelligence(messageBody, email);
  const colleague = await resolveInternalColleague(email);
  const signatureCompany = enrichment.suggestions.find((item) => item.id === "company")?.value;
  const usableSignatureCompany =
    colleague || (signatureCompany && /standard\s*bio/i.test(signatureCompany) && !isInternalEmail(email))
      ? undefined
      : signatureCompany;

  const matched = resolveCompanyForEmail(companies, email, {
    companyName: usableSignatureCompany,
  });

  const filteredSuggestions = enrichment.suggestions.filter((item) => {
    if (colleague) return false;
    if (matched && item.id === "company") return false;
    if (isInternalEmail(email)) return true;
    if (item.id === "email" && isInternalEmail(item.value)) return false;
    if (item.id === "website" && /standard\.bio|standardbio\.(com|no)/i.test(item.value)) {
      return false;
    }
    if (item.id === "company" && /standard\s*bio/i.test(item.value)) return false;
    return true;
  });

  logOutlookImport("EXTRACTED FIELDS", {
    signatureName,
    parsedName: parsed,
    suggestions: enrichment.suggestions,
    filteredSuggestions,
    matchedCompanyId: matched?.CompanyID ?? null,
    matchedCompanyTitle: matched?.Title ?? null,
  });

  const companyDisplay = buildOutlookCompanyDisplay(matched, usableSignatureCompany, domain);

  const prepopulation: OutlookSenderPrepopulation = {
    email,
    displayName: parsed.displayName,
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    domain,
    companyResolved: colleague ? false : companyDisplay.companyResolved,
    companyId: colleague ? null : companyDisplay.companyId,
    companyName: colleague ? "" : companyDisplay.companyName,
    companyHint: colleague ? "" : companyDisplay.companyHint,
    enrichment: { suggestions: colleague ? [] : filteredSuggestions },
    companyOptions: colleague ? [] : listOutlookCompanyOptions(companies),
    colleague,
  };

  logOutlookImport("SENDER-CONTEXT RESPONSE", prepopulation);

  return prepopulation;
}

export async function addOutlookContact(
  input: OutlookAddContactInput,
): Promise<OutlookAddContactResult> {
  const email = input.email.trim().toLowerCase();
  assertExternalContactEmail(email);
  const domain = extractEmailDomain(email);
  const companies = await readLiveCompanies().catch(() => [] as Company[]);

  logOutlookImport("ADD-CONTACT REQUEST", {
    email,
    firstName: input.firstName,
    lastName: input.lastName,
    companyName: input.companyName,
    matchedCompanyId: input.matchedCompanyId ?? null,
    skipAutoCompanyMatch: input.skipAutoCompanyMatch ?? false,
    companyTypes: input.companyTypes ?? null,
    enrichment: input.enrichment ?? null,
  });

  if (input.enrichment) {
    logOutlookImport("ACCEPTED FIELDS", input.enrichment);
  }

  for (const existing of companies) {
    for (const contact of existing.contacts) {
      if (contact.Email?.trim().toLowerCase() === email) {
        return finishExistingContact(contact, existing);
      }
    }
  }

  const prismaContact = await findPrismaContactByIdOrEmail(email).catch(() => null);
  if (prismaContact) {
    const companyLookup = prismaContact.company
      ? {
          Id: 0,
          Title: prismaContact.company.name,
          CompanyID:
            prismaContact.company.code?.trim() || prismaContact.company.id,
        }
      : { Id: 0, Title: "Unknown company", CompanyID: "" };
    const mapped = mapPrismaContactToApp(prismaContact, companyLookup);
    const companyFromLive =
      companies.find(
        (row) =>
          row.CompanyID === companyLookup.CompanyID ||
          row.CompanyID === prismaContact.companyId ||
          (prismaContact.company?.code &&
            row.CompanyID === prismaContact.company.code) ||
          row.Title.trim().toLowerCase() === companyLookup.Title.trim().toLowerCase(),
      ) ?? null;
    if (companyFromLive) {
      return finishExistingContact(mapped, companyFromLive);
    }
    throw new Error(
      `${getContactDisplayName(mapped) || email} is already in SmartCRM. Open the existing contact instead of creating a duplicate.`,
    );
  }

  let company =
    input.matchedCompanyId
      ? companies.find((item) => item.CompanyID === input.matchedCompanyId) ?? null
      : null;

  if (input.matchedCompanyId && !company) {
    throw new Error("The matched company is no longer available in SmartCRM.");
  }

  if (!company && !input.skipAutoCompanyMatch) {
    company = resolveCompanyForEmail(companies, email, {
      companyName: input.companyName,
    });
  }

  const enrichment = input.enrichment ?? {};
  let companyCreated = false;

  if (!company) {
    const title = titleForNewCompanyCreation(input.companyName, domain);
    const industry = resolveOutlookCompanyIndustry(input.industry);
    if (!industry) {
      throw new Error("Select an industry when creating a new company.");
    }
    const companyTypes = resolveOutlookCompanyTypes(input.companyTypes);
    if (companyTypes.length === 0) {
      throw new Error(
        "Select what kind of relationship this is (Supplier, Prospect, Partner, …).",
      );
    }
    const addressFields = enrichment.address?.trim()
      ? parseCompanyAddressInput(enrichment.address)
      : null;
    const websiteDomain = enrichment.website?.trim()
      ? websiteToDomain(enrichment.website)
      : "";
    // Prefer sender email domain over unrelated body websites when creating.
    const createDomain =
      websiteDomain &&
      websiteDomain.toLowerCase() === domain.toLowerCase()
        ? websiteDomain
        : domain || websiteDomain;

    const newCompanyInput = {
      Title: title,
      Domain: createDomain,
      Industry: industry,
      CompanyTypes: companyTypes,
      // Active + explicit types — never invent Prospect/Customer from Outlook mail.
      Status: "Active" as const,
      City: addressFields?.City ?? "",
      Phone: normalizePhoneNumber(enrichment.phone ?? ""),
      AddressLine1: addressFields?.AddressLine1 ?? "",
      Email: "",
      Country: addressFields?.Country ?? null,
      AccountOwner: resolveAccountOwner(null),
    };

    company = await createRegistryCompany(newCompanyInput);
    if (!company) {
      throw new Error(
        "Could not save the company to SmartCRM. Check database connectivity and try again.",
      );
    }
    companyCreated = true;
  } else {
    const enrichmentPatch = buildCompanyEnrichmentPatch(enrichment);
    if (Object.keys(enrichmentPatch).length > 0) {
      const { updateRegistryCompany } = await import("@/lib/company-registry");
      company =
        (await updateRegistryCompany(company.CompanyID, enrichmentPatch)) ??
        (await updateCompany(company.CompanyID, enrichmentPatch));
    }
  }

  const role = resolveOutlookContactRole(input.role, enrichment.jobTitle);
  const officePhone = normalizePhoneNumber(enrichment.phone ?? "");
  const mobilePhone = normalizePhoneNumber(enrichment.mobile ?? "");
  const addressFields = enrichment.address?.trim()
    ? parseCompanyAddressInput(enrichment.address)
    : null;

  const contactInput = {
    FirstName: input.firstName.trim() || "Contact",
    LastName: input.lastName.trim(),
    Email: email,
    Company: { CompanyID: company.CompanyID },
    JobTitle: enrichment.jobTitle?.trim() ?? "",
    Role: role,
    Phone: officePhone,
    Mobile: mobilePhone,
    LinkedInURL: "",
    Status: "Active" as ContactStatus,
    RelationshipLevel: "Operational" as RelationshipLevel,
    streetAddress: addressFields?.AddressLine1?.trim() || undefined,
    city: addressFields?.City?.trim() || undefined,
    country: addressFields?.Country?.Title?.trim() || undefined,
  };

  // Registry-first only — never Prisma company + JSON-only contact (list disappears).
  let contact = await createRegistryContact(contactInput);
  if (!contact) {
    // Matched JSON-only company: allow JSON contact write, then try promote is out of scope.
    const liveCompanies = await readLiveCompanies().catch(() => [] as typeof companies);
    const inLive = liveCompanies.some((row) => row.CompanyID === company!.CompanyID);
    if (inLive || companyCreated) {
      throw new Error(
        "Company was saved but the contact could not be written to SmartCRM. Try again.",
      );
    }
    contact = await createCompanyContact(company.CompanyID, contactInput);
  }

  logOutlookImport("PERSISTED CONTACT", {
    ContactID: contact.ContactID,
    FirstName: contact.FirstName,
    LastName: contact.LastName,
    Email: contact.Email,
    JobTitle: contact.JobTitle,
    Mobile: contact.Mobile,
    Phone: contact.Phone,
  });

  logOutlookImport("PERSISTED COMPANY", {
    CompanyID: company.CompanyID,
    Title: company.Title,
    Domain: company.Domain,
    Phone: company.Phone,
    AddressLine1: company.AddressLine1,
    City: company.City,
    Country: company.Country,
  });

  const ctx = await loadM365DataContext();
  let refreshedCompany =
    ctx.companies.find((item) => item.CompanyID === company!.CompanyID) ?? null;

  if (!refreshedCompany) {
    const prismaCompany = await findPrismaCompanyByRouteKey(company.CompanyID).catch(
      () => null,
    );
    if (prismaCompany) {
      refreshedCompany = await loadMappedPrismaCompany(prismaCompany.id).catch(() => null);
    }
  }
  refreshedCompany = refreshedCompany ?? company;

  // Ensure the new contact is nested on the company for relationship-card build.
  const refreshedContact =
    (await getRegistryContactById(contact.ContactID).catch(() => null)) ?? contact;
  if (
    !refreshedCompany.contacts.some(
      (entry) => entry.ContactID === refreshedContact.ContactID,
    )
  ) {
    refreshedCompany = {
      ...refreshedCompany,
      contacts: [...refreshedCompany.contacts, refreshedContact],
    };
  }

  let relationshipCard: M365RelationshipCardPayload | null = null;
  try {
    relationshipCard = buildM365RelationshipCard(refreshedCompany, {
      ...ctx,
      companies: ctx.companies.some((row) => row.CompanyID === refreshedCompany!.CompanyID)
        ? ctx.companies.map((row) =>
            row.CompanyID === refreshedCompany!.CompanyID ? refreshedCompany! : row,
          )
        : [...ctx.companies, refreshedCompany],
    });
  } catch {
    relationshipCard = null;
  }

  return {
    contactId: refreshedContact.ContactID,
    companyId: refreshedCompany.CompanyID,
    companyCreated,
    relationshipCard,
  };
}

async function finishExistingContact(
  contact: Contact,
  company: Company,
): Promise<OutlookAddContactResult> {
  logOutlookImport("REUSE EXISTING CONTACT", {
    ContactID: contact.ContactID,
    Email: contact.Email,
    CompanyID: company.CompanyID,
  });

  const pane = await loadM365PaneContext({
    companyId: company.CompanyID,
    email: contact.Email,
  });
  let refreshedCompany = pane.resolved?.company ?? company;
  const refreshedContact =
    (await getRegistryContactById(contact.ContactID).catch(() => null)) ?? contact;
  if (
    !refreshedCompany.contacts.some(
      (entry) => entry.ContactID === refreshedContact.ContactID,
    )
  ) {
    refreshedCompany = {
      ...refreshedCompany,
      contacts: [...refreshedCompany.contacts, refreshedContact],
    };
  }

  let relationshipCard: M365RelationshipCardPayload | null = null;
  try {
    relationshipCard = buildM365RelationshipCard(
      refreshedCompany,
      {
        ...pane.ctx,
        companies: [refreshedCompany],
      },
      { correspondence: pane.correspondence },
    );
  } catch {
    relationshipCard = null;
  }

  return {
    contactId: refreshedContact.ContactID,
    companyId: refreshedCompany.CompanyID,
    companyCreated: false,
    relationshipCard,
  };
}

export function isLikelyPersonalDomain(domain: string): boolean {
  return PERSONAL_DOMAINS.has(domain.trim().toLowerCase());
}

export function resolveOutlookCompanyIndustry(
  industry: string | undefined,
): CompanyIndustry | null {
  const trimmed = industry?.trim() ?? "";
  if (!trimmed) return null;
  return resolveCompanyIndustry(trimmed) || null;
}

/** Reality First — only persist selectable ecosystem roles the user chose. */
export function resolveOutlookCompanyTypes(
  types: string[] | undefined,
): CompanyType[] {
  const resolved: CompanyType[] = [];
  for (const value of types ?? []) {
    const next = canonicalizeCompanyType(String(value));
    if (
      next &&
      next !== "Unclassified" &&
      COMPANY_TYPE_SELECT_OPTIONS.includes(next) &&
      !resolved.includes(next)
    ) {
      resolved.push(next);
    }
  }
  return resolved;
}

/** Map user/signature role text — prefer explicit choice; never invent a job. */
export function resolveOutlookContactRole(
  role: string | undefined,
  jobTitle: string | undefined,
): ContactListRole {
  const explicit = resolveContactListRole(role);
  if (explicit) return explicit;

  const suggested = suggestContactListRoleFromTitle(jobTitle);
  if (suggested) return suggested;

  const fromTitle = resolveContactListRole(jobTitle);
  return fromTitle || "Other";
}
