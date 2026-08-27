import { normalizeCompanyDomain } from "@/lib/company-domain";

const COMPANY_LEGAL_SUFFIX =
  /^(as|a\/s|asa|ab|ltd|llc|inc|gmbh|oy|aps|plc|sa|nv|bv|co|company|group)\.?$/i;

const PERSONAL_DOMAINS = new Set([
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "icloud.com",
  "live.com",
  "msn.com",
  "protonmail.com",
  "me.com",
]);

export function normalizeWhitespaceName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Strip common legal suffixes for duplicate name matching. */
export function normalizeLegalCompanyName(value: string): string {
  const tokens = normalizeWhitespaceName(value).split(/\s+/).filter(Boolean);
  while (tokens.length > 1 && COMPANY_LEGAL_SUFFIX.test(tokens[tokens.length - 1]!)) {
    tokens.pop();
  }
  return tokens.join(" ");
}

export function normalizeOrgNumber(value: string | null | undefined): string {
  return (value ?? "").replace(/[\s.\-/]/g, "").toUpperCase();
}

export function normalizeVatNumber(value: string | null | undefined): string {
  return (value ?? "").replace(/[\s.\-/]/g, "").toUpperCase();
}

export function normalizePhone(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export function normalizeEmailAddress(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function isPersonalEmailDomain(domain: string): boolean {
  return PERSONAL_DOMAINS.has(domain.toLowerCase());
}

export function domainFromWebsite(website: string | null | undefined): string {
  if (!website?.trim()) return "";
  return normalizeCompanyDomain(website);
}

export function domainFromEmail(email: string | null | undefined): string {
  const normalized = normalizeEmailAddress(email);
  const at = normalized.lastIndexOf("@");
  if (at < 0) return "";
  return normalized.slice(at + 1);
}

export function confidenceRank(
  confidence: "certain" | "high" | "medium",
): number {
  switch (confidence) {
    case "certain":
      return 3;
    case "high":
      return 2;
    default:
      return 1;
  }
}

export function maxConfidence(
  a: "certain" | "high" | "medium",
  b: "certain" | "high" | "medium",
): "certain" | "high" | "medium" {
  return confidenceRank(a) >= confidenceRank(b) ? a : b;
}

type JsonContact = { address?: string; number?: string; isPrimary?: boolean };

export function primaryEmailFromJson(emails: unknown): string | null {
  if (!Array.isArray(emails) || emails.length === 0) return null;
  const rows = emails as JsonContact[];
  const primary = rows.find((row) => row.isPrimary && row.address?.trim());
  const any = rows.find((row) => row.address?.trim());
  return (primary?.address ?? any?.address ?? null)?.trim() || null;
}

export function primaryPhoneFromJson(phones: unknown): string | null {
  if (!Array.isArray(phones) || phones.length === 0) return null;
  const rows = phones as JsonContact[];
  const primary = rows.find((row) => row.isPrimary && row.number?.trim());
  const any = rows.find((row) => row.number?.trim());
  return (primary?.number ?? any?.number ?? null)?.trim() || null;
}

export function allEmailsFromJson(emails: unknown): string[] {
  if (!Array.isArray(emails)) return [];
  return (emails as JsonContact[])
    .map((row) => normalizeEmailAddress(row.address))
    .filter(Boolean);
}
