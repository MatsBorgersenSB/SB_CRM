const DEFAULT_INTERNAL_DOMAINS = [
  "standard.bio",
  "standardbio.com",
  "standardbio.no",
  "example.com",
] as const;

/**
 * Normalize a domain for comparison (lowercase, strip leading @ / trailing dots).
 */
export function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^@+/, "").replace(/\.+$/, "");
}

/**
 * Extract the domain portion of an email address.
 * Returns empty string when the address is malformed.
 */
export function extractEmailDomain(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at < 0 || at === trimmed.length - 1) return "";
  return normalizeDomain(trimmed.slice(at + 1));
}

/**
 * Enterprise internal mail domains from INTERNAL_DOMAINS (comma-separated).
 * Defaults: standardbio.com, standardbio.no, example.com
 */
export function getInternalDomains(): string[] {
  const raw = process.env.INTERNAL_DOMAINS?.trim();
  if (!raw) {
    return [...DEFAULT_INTERNAL_DOMAINS];
  }
  const parsed = raw
    .split(",")
    .map((part) => normalizeDomain(part))
    .filter(Boolean);
  return parsed.length > 0 ? parsed : [...DEFAULT_INTERNAL_DOMAINS];
}

function domainMatchesInternal(emailDomain: string, internalDomain: string): boolean {
  if (!emailDomain || !internalDomain) return false;
  return (
    emailDomain === internalDomain || emailDomain.endsWith(`.${internalDomain}`)
  );
}

/**
 * True when the email's domain matches any configured internal domain
 * (exact or subdomain, e.g. mail.standardbio.com → standardbio.com).
 */
export function isInternalEmail(email: string): boolean {
  const domain = extractEmailDomain(email);
  if (!domain) return false;
  return getInternalDomains().some((internal) =>
    domainMatchesInternal(domain, internal),
  );
}

/** Logical negation of isInternalEmail. */
export function isExternalEmail(email: string): boolean {
  return !isInternalEmail(email);
}
