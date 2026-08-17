import { parseCompanyAddressInput } from "@/lib/company-identity";
import { normalizeCompanyDomain } from "@/lib/company-domain";
import {
  parseSignatureAddress,
  parseSignatureIntelligence,
  parseSignaturePersonName,
  websiteToDomain,
} from "@/lib/m365/signature-intelligence";
import {
  extractEmailDomain,
  parsePersonName,
} from "@/lib/m365/outlook-sender-utils";
import { normalizePhoneNumber } from "@/lib/m365/phone-normalization";
import {
  resolveCompanyByDomain,
  resolveCompanyForEmail,
} from "@/lib/m365/company-resolution";
import {
  createCompany,
  createCompanyContact,
  updateCompany,
  updateCompanyContact,
} from "@/lib/pipeline-db";
import { readLiveCompanies } from "@/lib/prisma-data";
import { resolveAccountOwner } from "@/lib/company-owner";
import type { Company, SharePointPerson } from "@/types/company";
import type { Contact, ContactListRole } from "@/types/contact";

export type CompanyImportOptions = {
  accountOwner?: SharePointPerson | null;
};

export type QuickImportExtracted = {
  companyName: string;
  contactName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mobile: string;
  website: string;
  jobTitle: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  linkedInUrl: string;
};

export type QuickImportFieldPreview = {
  field: string;
  value: string;
  action: "create" | "update" | "unchanged";
};

export type QuickImportMatchPreview = {
  companyId: string | null;
  companyName: string;
  action: "create" | "update" | "skip";
  confidence: "high" | "medium" | "low" | "none";
  reason: string;
};

export type QuickImportContactMatchPreview = {
  contactId: string | null;
  contactName: string;
  action: "create" | "update" | "skip";
  confidence: "high" | "medium" | "low" | "none";
  reason: string;
};

export type QuickImportIntelligence = {
  emailDomain: string;
  emailDomainMatchesWebsite: boolean;
  websiteValid: boolean;
  websiteDomain: string;
  addressNormalized: boolean;
  duplicateWarning: string | null;
  freeEmailProvider: boolean;
};

export type QuickImportPreview = {
  extracted: QuickImportExtracted;
  company: QuickImportMatchPreview;
  contact: QuickImportContactMatchPreview;
  fields: QuickImportFieldPreview[];
  intelligence: QuickImportIntelligence;
  recommendedNextAction: string | null;
  hasCompanyData: boolean;
  hasContactData: boolean;
};

export type QuickImportResult = {
  company: Company;
  companyCreated: boolean;
  companyUpdated: boolean;
  contact: Contact | null;
  contactCreated: boolean;
  contactUpdated: boolean;
  contactSkipped: boolean;
  websiteLinked: boolean;
  errors: string[];
  recommendedNextAction: string | null;
};

const LINKEDIN_PATTERN = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w%-]+/i;
const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
]);

const COMPANY_SUFFIX =
  /\b(AS|ASA|AB|Oy|Ltd|Limited|Inc|Corp|GmbH|AG|SA|SRL|BV|PLC|Group|Co\.|Norge|Nordic)\b/i;

const WEBSITE_LINE_PATTERN =
  /^(?:https?:\/\/)?(?:www\.)?[\w.-]+\.[a-z]{2,}(?:\/[\w./%-]*)?$/i;

function looksLikeCompanyName(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.includes("@")) return false;
  if (WEBSITE_LINE_PATTERN.test(trimmed)) return false;
  return COMPANY_SUFFIX.test(trimmed);
}

function extractWebsiteFromLines(lines: string[]): string {
  for (const line of lines) {
    if (WEBSITE_LINE_PATTERN.test(line.trim())) return line.trim();
    const match = line.match(/((?:https?:\/\/)?(?:www\.)[\w.-]+\.[a-z]{2,})/i);
    if (match?.[1]) return match[1];
  }
  return "";
}

function extractAddressLines(lines: string[], companyIndex: number): string {
  const block: string[] = [];
  for (let i = companyIndex + 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) break;
    if (EMAIL_PATTERN.test(line) || WEBSITE_LINE_PATTERN.test(line)) break;
    block.push(line);
  }
  return block.join("\n");
}

function suggestionMap(text: string): Record<string, string> {
  const { suggestions } = parseSignatureIntelligence(text);
  return Object.fromEntries(suggestions.map((item) => [item.id, item.value]));
}

function extractLinkedInUrl(text: string): string {
  const match = text.match(LINKEDIN_PATTERN);
  return match?.[0] ?? "";
}

function extractAllEmails(text: string): string[] {
  const matches = text.match(EMAIL_PATTERN) ?? [];
  return [...new Set(matches.map((email) => email.toLowerCase()))];
}

function findCompanyByName(companies: Company[], name: string): Company | null {
  const normalized = name.trim().toLowerCase();
  if (!normalized || normalized.length < 3) return null;

  return (
    companies.find((company) => company.Title.trim().toLowerCase() === normalized) ??
    companies.find(
      (company) =>
        company.Title.toLowerCase().includes(normalized) ||
        normalized.includes(company.Title.toLowerCase()),
    ) ??
    null
  );
}

function splitContactName(fullName: string, email: string): {
  firstName: string;
  lastName: string;
  displayName: string;
} {
  if (fullName.trim()) {
    return parsePersonName(fullName.trim(), email);
  }
  return parsePersonName("", email);
}

export function extractQuickImportFields(text: string): QuickImportExtracted {
  const trimmed = text.trim();
  const lines = trimmed.split("\n").map((line) => line.trim()).filter(Boolean);
  const suggestions = suggestionMap(trimmed);

  let companyName = suggestions.company ?? "";
  if (!companyName && lines[0] && looksLikeCompanyName(lines[0])) {
    companyName = lines[0];
  }

  const emails = extractAllEmails(trimmed);
  const email = suggestions.email ?? emails[0] ?? "";

  let personName = parseSignaturePersonName(trimmed);
  if (personName && companyName && personName === companyName) {
    personName = null;
  }
  if (!personName) {
    const candidate = lines.find((line) => {
      if (line === companyName) return false;
      if (line.includes("@") || WEBSITE_LINE_PATTERN.test(line)) return false;
      if (looksLikeCompanyName(line)) return false;
      const words = line.split(/\s+/);
      return words.length >= 2 && words.length <= 5 && line.length <= 60;
    });
    personName = candidate ?? null;
  }
  if (!personName && email) {
    const derived = parsePersonName("", email);
    if (derived.displayName && derived.displayName !== email) {
      personName = derived.displayName;
    }
  }

  const { firstName, lastName, displayName } = splitContactName(personName ?? "", email);

  let addressRaw = suggestions.address ?? "";
  if (!addressRaw && companyName) {
    const companyIndex = lines.findIndex((line) => line === companyName);
    if (companyIndex >= 0) addressRaw = extractAddressLines(lines, companyIndex);
  }

  const parsedAddress = addressRaw ? parseSignatureAddress(addressRaw) : null;
  const normalizedAddress = addressRaw ? parseCompanyAddressInput(addressRaw) : null;

  const website = suggestions.website || extractWebsiteFromLines(lines);
  const linkedInUrl = extractLinkedInUrl(trimmed);

  return {
    companyName,
    contactName: displayName,
    firstName,
    lastName,
    email,
    phone: suggestions.phone ?? "",
    mobile: suggestions.mobile ?? "",
    website,
    jobTitle: suggestions.jobTitle ?? "",
    address: addressRaw,
    postalCode: normalizedAddress?.PostalCode ?? "",
    city: parsedAddress?.city || normalizedAddress?.City || "",
    country: normalizedAddress?.Country?.Title ?? "",
    linkedInUrl,
  };
}

function isValidWebsite(website: string): boolean {
  if (!website.trim()) return false;
  try {
    const url = website.startsWith("http") ? website : `https://${website}`;
    const hostname = new URL(url).hostname;
    return hostname.includes(".");
  } catch {
    return false;
  }
}

function fieldAction(
  current: string,
  incoming: string,
): "create" | "update" | "unchanged" {
  const next = incoming.trim();
  if (!next) return "unchanged";
  if (!current.trim()) return "create";
  if (current.trim().toLowerCase() !== next.toLowerCase()) return "update";
  return "unchanged";
}

function buildFieldPreviews(
  company: Company | null,
  contact: Contact | null,
  extracted: QuickImportExtracted,
): QuickImportFieldPreview[] {
  const rows: QuickImportFieldPreview[] = [];

  const push = (field: string, value: string, current: string) => {
    const action = fieldAction(current, value);
    if (action !== "unchanged" || value.trim()) {
      rows.push({ field, value: value.trim() || "—", action });
    }
  };

  push("Company Name", extracted.companyName, company?.Title ?? "");
  push("Contact Name", extracted.contactName, contact?.Title ?? "");
  push("Email", extracted.email, contact?.Email ?? company?.Email ?? "");
  push("Phone", extracted.phone, contact?.Phone ?? company?.Phone ?? "");
  push("Mobile", extracted.mobile, contact?.Mobile ?? "");
  push("Website", extracted.website, company?.Domain ?? "");
  push("Job Title", extracted.jobTitle, contact?.JobTitle ?? "");
  push("Address", extracted.address, company?.AddressLine1 ?? "");
  push("Postal Code", extracted.postalCode, company?.PostalCode ?? "");
  push("City", extracted.city, company?.City ?? "");
  push("Country", extracted.country, company?.Country?.Title ?? "");

  return rows;
}

function resolveCompanyMatch(
  companies: Company[],
  extracted: QuickImportExtracted,
  contextCompanyId?: string,
): QuickImportMatchPreview {
  const contextCompany = contextCompanyId
    ? companies.find((record) => record.CompanyID === contextCompanyId) ?? null
    : null;

  const emailDomain = extractEmailDomain(extracted.email);
  const websiteDomain = extracted.website
    ? normalizeCompanyDomain(websiteToDomain(extracted.website))
    : "";

  let matched: Company | null = null;
  let confidence: QuickImportMatchPreview["confidence"] = "none";
  let reason = "No existing company match";

  if (contextCompany) {
    matched = contextCompany;
    confidence = "high";
    reason = "Importing into current company workspace";
  } else if (extracted.email) {
    matched = resolveCompanyForEmail(companies, extracted.email);
    if (matched) {
      confidence = "high";
      reason = "Matched via contact email or domain";
    }
  }

  if (!matched && websiteDomain) {
    matched = resolveCompanyByDomain(companies, websiteDomain);
    if (matched) {
      confidence = confidence === "none" ? "medium" : confidence;
      reason = "Matched via website domain";
    }
  }

  if (!matched && extracted.companyName) {
    matched = findCompanyByName(companies, extracted.companyName);
    if (matched) {
      confidence = "medium";
      reason = "Matched via company name";
    }
  }

  if (!matched) {
    const name = extracted.companyName || (emailDomain ? emailDomain.split(".")[0] : "");
    return {
      companyId: null,
      companyName: name ?? "",
      action: extracted.companyName || emailDomain || websiteDomain ? "create" : "skip",
      confidence: "none",
      reason: extracted.companyName ? "New company will be created" : "No company data detected",
    };
  }

  const hasUpdates =
    (extracted.companyName && fieldAction(matched.Title, extracted.companyName) !== "unchanged") ||
    (extracted.website && fieldAction(matched.Domain, websiteDomain) !== "unchanged") ||
    (extracted.phone && fieldAction(matched.Phone, extracted.phone) !== "unchanged") ||
    (extracted.email && fieldAction(matched.Email ?? "", extracted.email) !== "unchanged") ||
    Boolean(extracted.address);

  return {
    companyId: matched.CompanyID,
    companyName: matched.Title,
    action: hasUpdates ? "update" : "skip",
    confidence,
    reason,
  };
}

function resolveContactMatch(
  company: Company | null,
  extracted: QuickImportExtracted,
): QuickImportContactMatchPreview {
  const hasContactData =
    Boolean(extracted.contactName.trim()) ||
    Boolean(extracted.email.trim()) ||
    Boolean(extracted.phone.trim()) ||
    Boolean(extracted.mobile.trim());

  if (!hasContactData) {
    return {
      contactId: null,
      contactName: "",
      action: "skip",
      confidence: "none",
      reason: "No contact data detected",
    };
  }

  const displayName = extracted.contactName || extracted.email || "Contact";
  let matched: Contact | null = null;
  let confidence: QuickImportContactMatchPreview["confidence"] = "none";
  let reason = "New contact will be created";

  if (company && extracted.email) {
    matched =
      company.contacts.find(
        (contact) => contact.Email.trim().toLowerCase() === extracted.email.trim().toLowerCase(),
      ) ?? null;
    if (matched) {
      confidence = "high";
      reason = "Matched via email on company record";
    }
  }

  if (!matched && company && extracted.contactName) {
    matched =
      company.contacts.find(
        (contact) =>
          contact.Title.trim().toLowerCase() === extracted.contactName.trim().toLowerCase(),
      ) ?? null;
    if (matched) {
      confidence = "medium";
      reason = "Matched via name on company record";
    }
  }

  if (!matched) {
    return {
      contactId: null,
      contactName: displayName,
      action: "create",
      confidence: "none",
      reason,
    };
  }

  const hasUpdates =
    (extracted.jobTitle && fieldAction(matched.JobTitle, extracted.jobTitle) !== "unchanged") ||
    (extracted.phone && fieldAction(matched.Phone, extracted.phone) !== "unchanged") ||
    (extracted.mobile && fieldAction(matched.Mobile, extracted.mobile) !== "unchanged") ||
    (extracted.linkedInUrl &&
      fieldAction(matched.LinkedInURL, extracted.linkedInUrl) !== "unchanged");

  return {
    contactId: matched.ContactID,
    contactName: matched.Title,
    action: hasUpdates ? "update" : "skip",
    confidence,
    reason: hasUpdates ? "Existing contact will be enriched" : "Contact already up to date",
  };
}

function buildIntelligence(extracted: QuickImportExtracted): QuickImportIntelligence {
  const emailDomain = extractEmailDomain(extracted.email);
  const websiteDomain = extracted.website
    ? normalizeCompanyDomain(websiteToDomain(extracted.website))
    : "";

  return {
    emailDomain,
    emailDomainMatchesWebsite: Boolean(
      emailDomain && websiteDomain && emailDomain === websiteDomain,
    ),
    websiteValid: isValidWebsite(extracted.website),
    websiteDomain,
    addressNormalized: Boolean(extracted.address && (extracted.city || extracted.postalCode)),
    duplicateWarning: null,
    freeEmailProvider: FREE_EMAIL_DOMAINS.has(emailDomain),
  };
}

function buildRecommendedNextAction(
  extracted: QuickImportExtracted,
  intelligence: QuickImportIntelligence,
): string | null {
  if (intelligence.websiteValid && extracted.website) {
    return "Website detected — run Website Discovery to discover additional stakeholders.";
  }
  if (extracted.companyName && !extracted.contactName) {
    return "Company record enriched — add contacts or run Website Discovery for stakeholders.";
  }
  if (extracted.contactName && !extracted.email) {
    return "Contact added — follow up to capture email for relationship tracking.";
  }
  return null;
}

export async function analyzeQuickImport(
  text: string,
  contextCompanyId?: string,
): Promise<QuickImportPreview> {
  const companies = await readLiveCompanies();
  const extracted = extractQuickImportFields(text);

  const hasCompanyData = Boolean(
    extracted.companyName ||
      extracted.website ||
      extracted.phone ||
      extracted.address ||
      extracted.email,
  );
  const hasContactData = Boolean(
    extracted.contactName || extracted.email || extracted.phone || extracted.mobile,
  );

  const companyPreview = resolveCompanyMatch(companies, extracted, contextCompanyId);
  const matchedCompany =
    companyPreview.companyId
      ? companies.find((record) => record.CompanyID === companyPreview.companyId) ?? null
      : null;

  const contactPreview = resolveContactMatch(matchedCompany, extracted);
  const intelligence = buildIntelligence(extracted);

  if (contactPreview.action === "create" && contactPreview.confidence === "none") {
    for (const company of companies) {
      const dup = company.contacts.find(
        (contact) =>
          extracted.email &&
          contact.Email.trim().toLowerCase() === extracted.email.trim().toLowerCase(),
      );
      if (dup) {
        intelligence.duplicateWarning = `${dup.Title} at ${company.Title} has the same email`;
        break;
      }
    }
  }

  const contact =
    contactPreview.contactId && matchedCompany
      ? matchedCompany.contacts.find((record) => record.ContactID === contactPreview.contactId) ??
        null
      : null;

  return {
    extracted,
    company: companyPreview,
    contact: contactPreview,
    fields: buildFieldPreviews(matchedCompany, contact, extracted),
    intelligence,
    recommendedNextAction: buildRecommendedNextAction(extracted, intelligence),
    hasCompanyData,
    hasContactData,
  };
}

async function upsertCompanyFromQuickImport(
  preview: QuickImportPreview,
  options?: CompanyImportOptions,
): Promise<{ company: Company; created: boolean; updated: boolean; websiteLinked: boolean }> {
  const { extracted, company: companyPreview } = preview;
  const websiteDomain = extracted.website
    ? normalizeCompanyDomain(websiteToDomain(extracted.website))
    : "";
  const addressPatch = extracted.address
    ? parseCompanyAddressInput(extracted.address)
    : {
        AddressLine1: "",
        AddressLine2: "",
        PostalCode: "",
        City: "",
        Country: null as Company["Country"],
      };

  if (companyPreview.action === "skip" && companyPreview.companyId) {
    const companies = await readLiveCompanies();
    const existing = companies.find((record) => record.CompanyID === companyPreview.companyId)!;
    return {
      company: existing,
      created: false,
      updated: false,
      websiteLinked: Boolean(existing.Domain),
    };
  }

  if (companyPreview.companyId) {
    const companies = await readLiveCompanies();
    const existing = companies.find((record) => record.CompanyID === companyPreview.companyId)!;
    const patch: Parameters<typeof updateCompany>[1] = {};

    if (
      extracted.companyName &&
      fieldAction(existing.Title, extracted.companyName) !== "unchanged"
    ) {
      patch.Title = extracted.companyName.trim();
    }
    if (websiteDomain && fieldAction(existing.Domain, websiteDomain) !== "unchanged") {
      patch.Domain = websiteDomain;
    }
    if (extracted.phone && fieldAction(existing.Phone, extracted.phone) !== "unchanged") {
      patch.Phone = normalizePhoneNumber(extracted.phone);
    }
    if (extracted.email && fieldAction(existing.Email ?? "", extracted.email) !== "unchanged") {
      patch.Email = extracted.email.trim().toLowerCase();
    }
    if (extracted.address) Object.assign(patch, addressPatch);
    if (extracted.city && fieldAction(existing.City, extracted.city) !== "unchanged") {
      patch.City = extracted.city;
    }
    if (!existing.AccountOwner && options?.accountOwner) {
      patch.AccountOwner = options.accountOwner;
    }

    if (Object.keys(patch).length === 0) {
      return {
        company: existing,
        created: false,
        updated: false,
        websiteLinked: Boolean(existing.Domain),
      };
    }

    const company = await updateCompany(companyPreview.companyId, patch);
    return {
      company,
      created: false,
      updated: Object.keys(patch).length > 0,
      websiteLinked: Boolean(websiteDomain || company.Domain),
    };
  }

  const title =
    extracted.companyName.trim() ||
    (preview.intelligence.websiteDomain
      ? preview.intelligence.websiteDomain.split(".")[0] ?? "New Company"
      : "New Company");

  const company = await createCompany({
    Title: title,
    Industry: "Polymer Processing",
    Status: "Prospecting",
    City: extracted.city || addressPatch.City || "",
    Domain: websiteDomain,
    Phone: normalizePhoneNumber(extracted.phone),
    Email: extracted.email.trim().toLowerCase(),
    AddressLine1: addressPatch.AddressLine1 ?? "",
    Country: addressPatch.Country ?? null,
    AccountOwner: resolveAccountOwner(options?.accountOwner),
  });

  if (addressPatch.PostalCode || addressPatch.AddressLine2) {
    const updated = await updateCompany(company.CompanyID, {
      PostalCode: addressPatch.PostalCode,
      AddressLine2: addressPatch.AddressLine2,
    });
    return { company: updated, created: true, updated: false, websiteLinked: Boolean(websiteDomain) };
  }

  return { company, created: true, updated: false, websiteLinked: Boolean(websiteDomain) };
}

async function upsertContactFromQuickImport(
  companyId: string,
  preview: QuickImportPreview,
): Promise<{
  contact: Contact | null;
  created: boolean;
  updated: boolean;
  skipped: boolean;
}> {
  const { extracted, contact: contactPreview } = preview;

  if (contactPreview.action === "skip") {
    const companies = await readLiveCompanies();
    const company = companies.find((record) => record.CompanyID === companyId);
    const existing =
      contactPreview.contactId
        ? company?.contacts.find((record) => record.ContactID === contactPreview.contactId) ?? null
        : null;
    return { contact: existing, created: false, updated: false, skipped: true };
  }

  if (contactPreview.contactId) {
    const patch: Parameters<typeof updateCompanyContact>[2] = {};
    if (extracted.jobTitle) patch.JobTitle = extracted.jobTitle.trim();
    if (extracted.phone) patch.Phone = normalizePhoneNumber(extracted.phone);
    if (extracted.mobile) patch.Mobile = normalizePhoneNumber(extracted.mobile);
    if (extracted.linkedInUrl) patch.LinkedInURL = extracted.linkedInUrl;
    if (extracted.email) patch.Email = extracted.email.trim().toLowerCase();

    const contact = await updateCompanyContact(companyId, contactPreview.contactId, patch);
    return { contact, created: false, updated: true, skipped: false };
  }

  const contact = await createCompanyContact(companyId, {
    FirstName: extracted.firstName || "Contact",
    LastName: extracted.lastName,
    JobTitle: extracted.jobTitle.trim(),
    Role: "Plant Manager" as ContactListRole,
    Email: extracted.email.trim().toLowerCase(),
    Company: { CompanyID: companyId },
    Phone: normalizePhoneNumber(extracted.phone),
    Mobile: normalizePhoneNumber(extracted.mobile),
    LinkedInURL: extracted.linkedInUrl,
    Status: "Prospecting",
    RelationshipLevel: "Operational",
  });

  return { contact, created: true, updated: false, skipped: false };
}

export async function importQuickImport(
  preview: QuickImportPreview,
  options?: CompanyImportOptions,
): Promise<QuickImportResult> {
  const errors: string[] = [];

  if (!preview.hasCompanyData && !preview.hasContactData) {
    throw new Error("No importable data detected in pasted text");
  }

  let companyResult = {
    company: null as Company | null,
    created: false,
    updated: false,
    websiteLinked: false,
  };

  if (preview.hasCompanyData && preview.company.action !== "skip") {
    companyResult = await upsertCompanyFromQuickImport(preview, options);
  } else if (preview.company.companyId) {
    const companies = await readLiveCompanies();
    companyResult.company =
      companies.find((record) => record.CompanyID === preview.company.companyId) ?? null;
    companyResult.websiteLinked = Boolean(companyResult.company?.Domain);
  }

  if (!companyResult.company && preview.hasContactData) {
    companyResult = await upsertCompanyFromQuickImport(preview, options);
  }

  if (!companyResult.company) {
    throw new Error("Could not resolve company for import");
  }

  let contactResult = {
    contact: null as Contact | null,
    created: false,
    updated: false,
    skipped: true,
  };

  if (preview.hasContactData) {
    try {
      contactResult = await upsertContactFromQuickImport(companyResult.company.CompanyID, preview);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Contact import failed");
    }
  }

  const refreshed = (await readLiveCompanies()).find(
    (record) => record.CompanyID === companyResult.company!.CompanyID,
  )!;

  return {
    company: refreshed,
    companyCreated: companyResult.created,
    companyUpdated: companyResult.updated,
    contact: contactResult.contact,
    contactCreated: contactResult.created,
    contactUpdated: contactResult.updated,
    contactSkipped: contactResult.skipped,
    websiteLinked: companyResult.websiteLinked,
    errors,
    recommendedNextAction: preview.recommendedNextAction,
  };
}
