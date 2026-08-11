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

/** Exact title match, or title + common legal suffix (e.g. Intility → Intility AS). */
function companyTitleMatches(companyTitle: string, candidate: string): boolean {
  const title = normalizeCompanyTitle(companyTitle);
  const name = normalizeCompanyTitle(candidate);
  if (!title || !name) return false;
  if (title === name) return true;
  if (!title.startsWith(`${name} `)) return false;
  const remainder = title.slice(name.length + 1).trim();
  const firstToken = remainder.split(/\s+/)[0] ?? "";
  return COMPANY_LEGAL_SUFFIX.test(firstToken);
}

/** Exact company title match (case-insensitive). Never invents a company. */
export function resolveCompanyByName(
  companies: Company[],
  name: string,
): Company | null {
  const normalized = normalizeCompanyTitle(name);
  if (!normalized) return null;

  return (
    companies.find((company) => companyTitleMatches(company.Title, normalized)) ??
    null
  );
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
