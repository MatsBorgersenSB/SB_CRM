import type { Company } from "@/types/company";
import { normalizeCompanyDomain } from "@/lib/company-domain";
import {
  extractEmailDomain,
  domainToSuggestedCompanyName,
} from "@/lib/m365/outlook-sender-utils";

/** SmartCRM company record is the only display source of truth. */
export function canonicalCompanyDisplayName(company: Company): string {
  return company.Title.trim();
}

function normalizeCompanyTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

const COMPANY_LEGAL_SUFFIX =
  /^(as|a\/s|asa|ab|ltd|llc|inc|gmbh|oy|aps|plc|sa|nv|bv|co|company|group)\.?$/i;

const PERSONAL_DOMAINS = new Set([
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "icloud.com",
  "live.com",
]);

function stripLegalSuffixTokens(value: string): string {
  const tokens = normalizeCompanyTitle(value).split(/\s+/).filter(Boolean);
  while (tokens.length > 1 && COMPANY_LEGAL_SUFFIX.test(tokens[tokens.length - 1]!)) {
    tokens.pop();
  }
  return tokens.join(" ");
}

/** Exact title match, or title + common legal suffix (e.g. Intility → Intility AS). */
function companyTitleMatches(companyTitle: string, candidate: string): boolean {
  const title = normalizeCompanyTitle(companyTitle);
  const name = normalizeCompanyTitle(candidate);
  if (!title || !name) return false;
  if (title === name) return true;
  const strippedTitle = stripLegalSuffixTokens(title);
  const strippedName = stripLegalSuffixTokens(name);
  if (strippedTitle && strippedName && strippedTitle === strippedName) return true;
  if (!title.startsWith(`${name} `)) return false;
  const remainder = title.slice(name.length + 1).trim();
  const firstToken = remainder.split(/\s+/)[0] ?? "";
  return COMPANY_LEGAL_SUFFIX.test(firstToken);
}

/**
 * Unique first-word match: "Guard" → "GUARD AUTOMATION AS".
 * Only when exactly one company starts with that token. Never invents.
 */
function resolveCompanyByUniqueFirstToken(
  companies: Company[],
  name: string,
): Company | null {
  const candidate = stripLegalSuffixTokens(name);
  if (candidate.length < 4 || candidate.includes(" ")) return null;

  const matches = companies.filter((company) => {
    const firstToken = stripLegalSuffixTokens(company.Title).split(/\s+/)[0] ?? "";
    return firstToken === candidate;
  });
  return matches.length === 1 ? matches[0]! : null;
}

/** Exact company title match (case-insensitive). Never invents a company. */
export function resolveCompanyByName(
  companies: Company[],
  name: string,
): Company | null {
  const normalized = normalizeCompanyTitle(name);
  if (!normalized) return null;

  const exact = companies.filter((company) =>
    companyTitleMatches(company.Title, normalized),
  );
  if (exact.length === 1) return exact[0]!;
  if (exact.length > 1) return exact[0]!;

  return resolveCompanyByUniqueFirstToken(companies, normalized);
}

export function resolveCompanyByDomain(
  companies: Company[],
  domain: string,
): Company | null {
  const normalized = normalizeCompanyDomain(domain);
  if (!normalized) return null;

  return (
    companies.find(
      (company) => normalizeCompanyDomain(company.Domain ?? "") === normalized,
    ) ?? null
  );
}

/**
 * If colleagues at one company already use this email domain, that company is the match.
 * Ambiguous (several companies sharing @guard.no) → null; user picks.
 */
export function resolveCompanyByContactDomain(
  companies: Company[],
  domain: string,
): Company | null {
  const normalized = normalizeCompanyDomain(domain);
  if (!normalized || PERSONAL_DOMAINS.has(normalized)) return null;

  const matches = companies.filter((company) =>
    company.contacts.some(
      (contact) => extractEmailDomain(contact.Email ?? "") === normalized,
    ),
  );
  return matches.length === 1 ? matches[0]! : null;
}

export type OutlookCompanyOption = {
  id: string;
  name: string;
  domain?: string;
};

export function listOutlookCompanyOptions(companies: Company[]): OutlookCompanyOption[] {
  return [...companies]
    .sort((a, b) => a.Title.localeCompare(b.Title))
    .map((company) => ({
      id: company.CompanyID,
      name: company.Title,
      domain: company.Domain?.trim() || undefined,
    }));
}

export type ResolveCompanyForEmailHints = {
  /** Signature / user-confirmed company name — used only for exact Title match. */
  companyName?: string;
};

/**
 * Resolve an existing company from a counterparty email.
 * Order (FS-012): contact email → domain → known company name → domain-derived name.
 */
export function resolveCompanyForEmail(
  companies: Company[],
  email: string,
  hints?: ResolveCompanyForEmailHints,
): Company | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  for (const company of companies) {
    for (const contact of company.contacts) {
      if (contact.Email?.trim().toLowerCase() === normalized) {
        return company;
      }
    }
  }

  const domain = extractEmailDomain(normalized);
  const byDomain = resolveCompanyByDomain(companies, domain);
  if (byDomain) return byDomain;

  const byColleagueDomain = resolveCompanyByContactDomain(companies, domain);
  if (byColleagueDomain) return byColleagueDomain;

  const hintName = hints?.companyName?.trim() ?? "";
  if (hintName) {
    const byHint = resolveCompanyByName(companies, hintName);
    if (byHint) return byHint;
  }

  const fromDomain = domainToSuggestedCompanyName(domain);
  if (fromDomain) {
    const byDomainName = resolveCompanyByName(companies, fromDomain);
    if (byDomainName) return byDomainName;
  }

  return null;
}

export type OutlookCompanyDisplay = {
  companyName: string;
  companyResolved: boolean;
  companyId: string | null;
  companyHint: string;
};

export type CompanyNameSource = "crm" | "signature" | "domain" | "none";

/** CRM → signature → domain-derived (creation/display fallback only). */
export function resolveOutlookCompanyName(
  company: Company | null,
  signatureCompanyName?: string,
  domain?: string,
): { name: string; resolved: boolean; source: CompanyNameSource } {
  if (company) {
    return {
      name: canonicalCompanyDisplayName(company),
      resolved: true,
      source: "crm",
    };
  }

  const signatureName = signatureCompanyName?.trim() ?? "";
  if (signatureName) {
    return { name: signatureName, resolved: false, source: "signature" };
  }

  const domainName = domain?.trim() ? domainToSuggestedCompanyName(domain) : "";
  if (domainName) {
    return { name: domainName, resolved: false, source: "domain" };
  }

  return { name: "", resolved: false, source: "none" };
}

/**
 * Display name for Outlook contact flows.
 * Never derives from email domain when a company record exists.
 */
export function buildOutlookCompanyDisplay(
  company: Company | null,
  signatureCompanyName?: string,
  domain?: string,
): OutlookCompanyDisplay {
  const resolved = resolveOutlookCompanyName(company, signatureCompanyName, domain);

  if (resolved.resolved && company) {
    return {
      companyName: resolved.name,
      companyResolved: true,
      companyId: company.CompanyID,
      companyHint: resolved.name,
    };
  }

  return {
    companyName: resolved.name,
    companyResolved: false,
    companyId: null,
    companyHint: "Will be created when contact is added",
  };
}

/** Title for new company creation only — not for display. */
export function titleForNewCompanyCreation(
  confirmedName: string,
  domain: string,
): string {
  const trimmed = confirmedName.trim();
  if (trimmed) return trimmed;
  return domainToSuggestedCompanyName(domain);
}
