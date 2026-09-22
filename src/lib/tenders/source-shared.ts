import { POSITIVE_KEYWORDS, type TenderSource, type ThermalNoticeInput } from "@/lib/tenders/thermalFilter";

const LANGUAGE_PREFERENCE = [
  "eng",
  "en",
  "nor",
  "nob",
  "nno",
  "nld",
  "deu",
  "fra",
  "dan",
  "swe",
  "fin",
  "ita",
  "spa",
] as const;

const ISO3_TO_COUNTRY: Record<string, string> = {
  NOR: "Norway",
  SWE: "Sweden",
  DNK: "Denmark",
  FIN: "Finland",
  ISL: "Iceland",
  DEU: "Germany",
  FRA: "France",
  NLD: "Netherlands",
  BEL: "Belgium",
  AUT: "Austria",
  CHE: "Switzerland",
  GBR: "United Kingdom",
  IRL: "Ireland",
  ESP: "Spain",
  PRT: "Portugal",
  ITA: "Italy",
  POL: "Poland",
  CZE: "Czechia",
  SVK: "Slovakia",
  SVN: "Slovenia",
  HUN: "Hungary",
  ROU: "Romania",
  BGR: "Bulgaria",
  GRC: "Greece",
  HRV: "Croatia",
  EST: "Estonia",
  LVA: "Latvia",
  LTU: "Lithuania",
  LUX: "Luxembourg",
  MLT: "Malta",
  CYP: "Cyprus",
  USA: "United States",
  CAN: "Canada",
  AUS: "Australia",
  NZL: "New Zealand",
  CHN: "China",
};

export type SourcePullStatus = "ok" | "skipped" | "error";

export type SourcePullResult = {
  source: TenderSource;
  status: SourcePullStatus;
  fetched: number;
  mapped: number;
  notices: ThermalNoticeInput[];
  reason?: string;
  error?: string;
};

export function skippedSource(
  source: TenderSource,
  reason: string,
): SourcePullResult {
  return { source, status: "skipped", fetched: 0, mapped: 0, notices: [], reason };
}

export function failedSource(source: TenderSource, error: string): SourcePullResult {
  return { source, status: "error", fetched: 0, mapped: 0, notices: [], error };
}

export function tedDateToken(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function usDate(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${month}/${day}/${date.getUTCFullYear()}`;
}

export function freshnessStart(now: Date, days = 14): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function buildTedFullTextQuery(keywords: readonly string[] = POSITIVE_KEYWORDS): string {
  const clauses = keywords.map((keyword) => {
    const needsQuotes = /[^a-z0-9]/i.test(keyword);
    return needsQuotes ? `FT ~ "${keyword}"` : `FT ~ ${keyword}`;
  });
  return `(${clauses.join(" OR ")})`;
}

export function pickLocalizedText(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const picked = pickLocalizedText(entry);
      if (picked) return picked;
    }
    return null;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const lang of LANGUAGE_PREFERENCE) {
      const picked = pickLocalizedText(record[lang] ?? record[lang.toUpperCase()]);
      if (picked) return picked;
    }
    for (const entry of Object.values(record)) {
      const picked = pickLocalizedText(entry);
      if (picked) return picked;
    }
  }
  return null;
}

export function firstDate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const picked = firstDate(entry);
      if (picked) return picked;
    }
  }
  return null;
}

export function parseBudget(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const numeric = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(numeric) ? numeric : null;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const parsed = parseBudget(entry);
      if (parsed != null) return parsed;
    }
  }
  return null;
}

export function countryFromCode(value: unknown): string {
  const raw = pickLocalizedText(value) ?? (Array.isArray(value) ? String(value[0] ?? "") : String(value ?? ""));
  const code = raw.trim().toUpperCase();
  if (!code) return "Unknown";
  if (ISO3_TO_COUNTRY[code]) return ISO3_TO_COUNTRY[code];
  if (code.length === 2) return code;
  return raw.trim();
}

export function authorityFromTitle(title: string): string | null {
  const parts = title.split(" – ").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) return parts[parts.length - 1] ?? null;
  return null;
}

export async function fetchJson(
  url: string,
  init: RequestInit,
  timeoutMs = 20_000,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = { raw: text.slice(0, 400) };
      }
    }
    return { ok: response.ok, status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

export function noticeDedupeKey(notice: ThermalNoticeInput): string {
  return [
    notice.title.trim().toLowerCase(),
    notice.authorityName.trim().toLowerCase(),
    String(notice.publicationDate).slice(0, 10),
  ].join("|");
}
