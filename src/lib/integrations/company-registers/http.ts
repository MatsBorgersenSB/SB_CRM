import type { UnifiedEuropeanCompany } from "@/lib/integrations/company-registers/types";

const DEFAULT_TIMEOUT_MS = 8_000;
const USER_AGENT = "SmartCRM-StandardBio/1.0 (mats.borgersen@standard.bio)";

export async function fetchRegistryJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T | null> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, headers, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
        ...(headers ?? {}),
      },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchRegistryText(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<string | null> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, headers, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": USER_AGENT,
        ...(headers ?? {}),
      },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function emptyCompany(
  partial: Partial<UnifiedEuropeanCompany> &
    Pick<UnifiedEuropeanCompany, "legalName" | "registrationNumber" | "country" | "countryCode" | "sourceRegistry">,
): UnifiedEuropeanCompany {
  return {
    continent: "Europe",
    ...partial,
  };
}

export function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

export function firstString(...values: unknown[]): string {
  for (const value of values) {
    const cleaned = cleanText(value);
    if (cleaned) return cleaned;
  }
  return "";
}

export function decodeHtml(value: string): string {
  return cleanText(
    value
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&middot;/g, "·")
      .replace(/&bull;/g, "·")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code))),
  );
}
