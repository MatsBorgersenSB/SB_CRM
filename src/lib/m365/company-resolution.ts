import type { Company } from "@/types/company";
import { extractEmailDomain, domainToSuggestedCompanyName } from "@/lib/m365/outlook-sender-utils";

/** SmartCRM company record is the only display source of truth. */
export function canonicalCompanyDisplayName(company: Company): string {
  return company.Title.trim();
}

export function resolveCompanyByDomain(
  companies: Company[],
  domain: string,
): Company | null {
  const normalized = domain.trim().toLowerCase();
  if (!normalized) return null;

  return (
    companies.find((company) => company.Domain?.trim().toLowerCase() === normalized) ??
    null
  );
}

/** Resolve an existing company from a counterparty email — contact match first, then domain. */
export function resolveCompanyForEmail(
  companies: Company[],
  email: string,
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

  return resolveCompanyByDomain(companies, extractEmailDomain(normalized));
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
