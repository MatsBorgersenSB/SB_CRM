import {
  toCompanyTrackingId,
  toContactTrackingId,
} from "@/lib/prisma-mappers";

/**
 * Normalize a dynamic route segment for entity lookup.
 * Accepts whichever param the page uses (id / contactId / companyId).
 */
export function normalizeRouteKey(
  ...candidates: Array<string | undefined | null>
): string {
  for (const candidate of candidates) {
    if (candidate == null) continue;
    const raw = String(candidate);
    if (!raw.trim()) continue;
    try {
      return decodeURIComponent(raw).trim();
    } catch {
      return raw.trim();
    }
  }
  return "";
}

/** Re-throw Next.js notFound() errors; everything else is a soft failure. */
export function isNextNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).includes("NEXT_HTTP_ERROR")
  );
}

export function emailsIncludeAddress(emails: unknown, needle: string): boolean {
  if (!Array.isArray(emails)) return false;
  const target = needle.trim().toLowerCase();
  if (!target) return false;
  return emails.some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const address = (entry as { address?: unknown }).address;
    return typeof address === "string" && address.trim().toLowerCase() === target;
  });
}

export function isContactTrackingCode(key: string): boolean {
  return /^CT-[A-Z0-9]+$/i.test(key.trim());
}

export function isCompanyTrackingCode(key: string): boolean {
  return /^CO-[A-Z0-9]+$/i.test(key.trim());
}

export function isPipelineTrackingCode(key: string): boolean {
  return /^PL-[A-Z0-9]+$/i.test(key.trim());
}

export function contactTrackingMatches(prismaId: string, routeKey: string): boolean {
  return (
    toContactTrackingId(prismaId).toUpperCase() === routeKey.trim().toUpperCase()
  );
}

export function companyTrackingMatches(prismaId: string, routeKey: string): boolean {
  return (
    toCompanyTrackingId(prismaId).toUpperCase() === routeKey.trim().toUpperCase()
  );
}
