import {
  createCompany,
  createCompanyContact,
  readCompanies,
  updateCompany,
} from "@/lib/pipeline-db";
import { resolveAccountOwner } from "@/lib/company-owner";
import { buildM365RelationshipCard } from "@/lib/m365/relationship-card";
import { loadM365DataContext } from "@/lib/m365/resolve-context";
import type { M365RelationshipCardPayload } from "@/types/m365";
import type { ContactListRole, ContactStatus, RelationshipLevel } from "@/types/contact";
import { CONTACT_LIST_ROLES } from "@/types/contact";
import { extractEmailDomain, parsePersonName } from "@/lib/m365/outlook-sender-utils";
import {
  parseSignatureIntelligence,
  parseSignaturePersonName,
  websiteToDomain,
} from "@/lib/m365/signature-intelligence";
import { normalizePhoneNumber } from "@/lib/m365/phone-normalization";
import { parseCompanyAddressInput } from "@/lib/company-identity";
import {
  buildOutlookCompanyDisplay,
  resolveCompanyForEmail,
  titleForNewCompanyCreation,
} from "@/lib/m365/company-resolution";
import { logOutlookImport } from "@/lib/m365/outlook-import-diagnostics";

export type { OutlookSenderPrepopulation } from "@/lib/m365/outlook-sender-types";

import type {
  OutlookAddContactInput,
  OutlookAddContactResult,
  OutlookContactEnrichment,
  OutlookSenderPrepopulation,
} from "@/lib/m365/outlook-sender-types";

export type { OutlookAddContactInput, OutlookAddContactResult };

export { resolveCompanyByDomain, resolveCompanyForEmail, canonicalCompanyDisplayName } from "@/lib/m365/company-resolution";

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

  if (enrichment.website?.trim()) {
    patch.Domain = websiteToDomain(enrichment.website);
  }

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
  const companies = await readCompanies();
  const matched = resolveCompanyForEmail(companies, email);

  const enrichment = parseSignatureIntelligence(messageBody, email);
  const filteredSuggestions = enrichment.suggestions.filter(
    (item) => !(matched && item.id === "company"),
  );

  logOutlookImport("EXTRACTED FIELDS", {
    signatureName,
    parsedName: parsed,
    suggestions: enrichment.suggestions,
    filteredSuggestions,
  });

  const signatureCompany = enrichment.suggestions.find((item) => item.id === "company")?.value;
  const companyDisplay = buildOutlookCompanyDisplay(matched, signatureCompany, domain);

  const prepopulation: OutlookSenderPrepopulation = {
    email,
    displayName: parsed.displayName,
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    domain,
    companyResolved: companyDisplay.companyResolved,
    companyId: companyDisplay.companyId,
    companyName: companyDisplay.companyName,
    companyHint: companyDisplay.companyHint,
    enrichment: { suggestions: filteredSuggestions },
  };

  logOutlookImport("SENDER-CONTEXT RESPONSE", prepopulation);

  return prepopulation;
}

export async function addOutlookContact(
  input: OutlookAddContactInput,
): Promise<OutlookAddContactResult> {
  const email = input.email.trim().toLowerCase();
  const domain = extractEmailDomain(email);
  const companies = await readCompanies();

  logOutlookImport("ADD-CONTACT REQUEST", {
    email,
    firstName: input.firstName,
    lastName: input.lastName,
    companyName: input.companyName,
    matchedCompanyId: input.matchedCompanyId ?? null,
    skipAutoCompanyMatch: input.skipAutoCompanyMatch ?? false,
    enrichment: input.enrichment ?? null,
  });

  if (input.enrichment) {
    logOutlookImport("ACCEPTED FIELDS", input.enrichment);
  }

  for (const existing of companies) {
    for (const contact of existing.contacts) {
      if (contact.Email?.trim().toLowerCase() === email) {
        throw new Error("This contact is already in SmartCRM.");
      }
    }
  }

  let company =
    input.matchedCompanyId
      ? companies.find((item) => item.CompanyID === input.matchedCompanyId) ?? null
      : null;

  if (input.matchedCompanyId && !company) {
    throw new Error("The matched company is no longer available in SmartCRM.");
  }

  if (!company && !input.skipAutoCompanyMatch) {
    company = resolveCompanyForEmail(companies, email);
  }

  const enrichment = input.enrichment ?? {};
  let companyCreated = false;

  if (!company) {
    const title = titleForNewCompanyCreation(input.companyName, domain);
    const addressFields = enrichment.address?.trim()
      ? parseCompanyAddressInput(enrichment.address)
      : null;
    const websiteDomain = enrichment.website?.trim()
      ? websiteToDomain(enrichment.website)
      : "";

    company = await createCompany({
      Title: title,
      Domain: websiteDomain || domain,
      // Reality First — do not invent industry from Outlook mail.
      Industry: "",
      Status: "Prospecting",
      City: addressFields?.City ?? "",
      Phone: normalizePhoneNumber(enrichment.phone ?? ""),
      AddressLine1: addressFields?.AddressLine1 ?? "",
      Email: "",
      Country: addressFields?.Country ?? null,
      AccountOwner: resolveAccountOwner(null),
    });
    companyCreated = true;
  } else if (Object.keys(buildCompanyEnrichmentPatch(enrichment)).length > 0) {
    company = await updateCompany(company.CompanyID, buildCompanyEnrichmentPatch(enrichment));
  }

  const role = resolveOutlookContactRole(input.role, enrichment.jobTitle);
  const contact = await createCompanyContact(company.CompanyID, {
    FirstName: input.firstName.trim() || "Contact",
    LastName: input.lastName.trim(),
    Email: email,
    Company: { CompanyID: company.CompanyID },
    JobTitle: enrichment.jobTitle?.trim() ?? "",
    Role: role,
    Phone: "",
    Mobile: normalizePhoneNumber(enrichment.mobile ?? ""),
    LinkedInURL: "",
    Status: "Prospecting" as ContactStatus,
    RelationshipLevel: "Operational" as RelationshipLevel,
  });

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
  const refreshedCompany =
    ctx.companies.find((item) => item.CompanyID === company!.CompanyID) ?? company;

  let relationshipCard: M365RelationshipCardPayload | null = null;
  try {
    relationshipCard = buildM365RelationshipCard(refreshedCompany, ctx);
  } catch {
    relationshipCard = null;
  }

  return {
    contactId: contact.ContactID,
    companyId: refreshedCompany.CompanyID,
    companyCreated,
    relationshipCard,
  };
}

export function isLikelyPersonalDomain(domain: string): boolean {
  return PERSONAL_DOMAINS.has(domain.trim().toLowerCase());
}

/** Map user/signature role text to a SharePoint choice — never invent a job. */
export function resolveOutlookContactRole(
  role: string | undefined,
  jobTitle: string | undefined,
): ContactListRole {
  const candidates = [role, jobTitle]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean);

  for (const candidate of candidates) {
    const exact = CONTACT_LIST_ROLES.find(
      (item) => item.toLowerCase() === candidate.toLowerCase(),
    );
    if (exact) return exact;

    const lower = candidate.toLowerCase();
    if (lower.includes("sponsor") || lower.includes("executive") || lower.includes("ceo")) {
      return "Executive Sponsor";
    }
    if (lower.includes("plant") || lower.includes("operations") || lower.includes("manager")) {
      return "Plant Manager";
    }
    if (lower.includes("compliance") || lower.includes("environment") || lower.includes("hse")) {
      return "Compliance Officer";
    }
    if (lower.includes("procure") || lower.includes("buyer") || lower.includes("purchasing")) {
      return "Procurement";
    }
  }

  // Explicit user selection is required in the UI; fall back only if omitted.
  return "Executive Sponsor";
}
