/**
 * Thermal tender keyword qualification — pyrolysis + torrefaction only.
 * Guardrails reject stale, closed, China-domain, and incineration-only notices.
 */

export const PYROLYSIS_KEYWORDS = [
  "pyrolysis",
  "pyrolyse",
  "pyrolytic",
  "biochar",
  "biokull",
  "biokohle",
  "py-oil",
  "pyoil",
  "thermal carbonization",
] as const;

export const TORREFACTION_KEYWORDS = [
  "torrefaction",
  "torrefied",
  "torrefysering",
  "torrefisert",
  "torrefizierung",
  "torrefiziert",
  "biocoal",
  "bio-coal",
  "black pellets",
  "roasted biomass",
] as const;

export const POSITIVE_KEYWORDS = [
  ...PYROLYSIS_KEYWORDS,
  ...TORREFACTION_KEYWORDS,
] as const;

export const NEGATIVE_KEYWORDS = [
  "incineration",
  "incinerator",
  "mass burn",
  "composting",
  "landfill",
] as const;

export const TENDER_FRESHNESS_DAYS = 14;

export const TENDER_SECTORS = [
  "Timber & Forestry",
  "Municipal & Sludge",
  "Energy & Utilities",
] as const;

export const TENDER_TECHNOLOGIES = ["Pyrolysis", "Torrefaction", "Both"] as const;

export type TenderSectorTag = (typeof TENDER_SECTORS)[number];
export type TenderTechnologyType = (typeof TENDER_TECHNOLOGIES)[number];
export type TenderSource = "TED" | "Doffin" | "Mercell" | "SAM";
export type TenderStatus = "PENDING" | "PROMOTED" | "EXPIRED" | "DISMISSED";

export type ThermalNoticeInput = {
  externalId: string;
  source: TenderSource;
  title: string;
  authorityName: string;
  country: string;
  publicationDate: string | Date;
  submissionDeadline: string | Date;
  estimatedBudget?: number | null;
  summary?: string | null;
  rawUrl?: string | null;
  rawText?: string | null;
};

export type ThermalFilterRejectReason =
  | "stale_publication"
  | "deadline_passed"
  | "china_domain"
  | "negative_without_positive"
  | "invalid_dates";

export type ThermalFilterResult =
  | {
      accepted: true;
      haystack: string;
      hasPyrolysis: boolean;
      hasTorrefaction: boolean;
      suggestedTechnology: TenderTechnologyType;
      publicationDate: Date;
      submissionDeadline: Date;
    }
  | {
      accepted: false;
      reason: ThermalFilterRejectReason;
    };

function normalizeHaystack(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function containsPhrase(haystack: string, phrase: string): boolean {
  return haystack.includes(phrase.toLowerCase());
}

function hasAny(haystack: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => containsPhrase(haystack, phrase));
}

function parseDate(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function isChinaBlocked(country: string, rawUrl: string | null | undefined): boolean {
  const countryNorm = country.trim().toLowerCase();
  if (
    countryNorm === "cn" ||
    countryNorm === "china" ||
    countryNorm === "people's republic of china" ||
    countryNorm === "peoples republic of china" ||
    countryNorm === "prc"
  ) {
    return true;
  }
  const url = (rawUrl ?? "").trim().toLowerCase();
  if (!url) return false;
  return (
    url.includes(".cn/") ||
    url.endsWith(".cn") ||
    url.includes(".cn?") ||
    /https?:\/\/[^/]*\.cn(?:[:/?]|$)/i.test(url)
  );
}

export function qualifyThermalNotice(
  notice: ThermalNoticeInput,
  now: Date = new Date(),
): ThermalFilterResult {
  const publicationDate = parseDate(notice.publicationDate);
  const submissionDeadline = parseDate(notice.submissionDeadline);
  if (!publicationDate || !submissionDeadline) {
    return { accepted: false, reason: "invalid_dates" };
  }

  const freshnessCutoff = new Date(now.getTime() - TENDER_FRESHNESS_DAYS * 24 * 60 * 60 * 1000);
  if (publicationDate.getTime() < freshnessCutoff.getTime()) {
    return { accepted: false, reason: "stale_publication" };
  }

  if (submissionDeadline.getTime() <= now.getTime()) {
    return { accepted: false, reason: "deadline_passed" };
  }

  if (isChinaBlocked(notice.country, notice.rawUrl)) {
    return { accepted: false, reason: "china_domain" };
  }

  const haystack = normalizeHaystack(
    [
      notice.title,
      notice.authorityName,
      notice.summary ?? "",
      notice.rawText ?? "",
    ].join("\n"),
  );

  const hasPyrolysis = hasAny(haystack, PYROLYSIS_KEYWORDS);
  const hasTorrefaction = hasAny(haystack, TORREFACTION_KEYWORDS);
  const hasPositive = hasPyrolysis || hasTorrefaction;
  const hasNegative = hasAny(haystack, NEGATIVE_KEYWORDS);

  if (hasNegative && !hasPositive) {
    return { accepted: false, reason: "negative_without_positive" };
  }

  const suggestedTechnology: TenderTechnologyType =
    hasPyrolysis && hasTorrefaction
      ? "Both"
      : hasTorrefaction
        ? "Torrefaction"
        : "Pyrolysis";

  return {
    accepted: true,
    haystack,
    hasPyrolysis,
    hasTorrefaction,
    suggestedTechnology,
    publicationDate,
    submissionDeadline,
  };
}

export function daysUntilDeadline(deadline: Date, now: Date = new Date()): number {
  return Math.ceil((deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

export function isTenderSectorTag(value: string): value is TenderSectorTag {
  return (TENDER_SECTORS as readonly string[]).includes(value);
}

export function isTenderTechnologyType(value: string): value is TenderTechnologyType {
  return (TENDER_TECHNOLOGIES as readonly string[]).includes(value);
}

export function suggestSectorTag(haystack: string): TenderSectorTag {
  const text = haystack.toLowerCase();
  if (
    /timber|forestry|wood|sawmill|biomass pellet|forest|lignocellul/.test(text)
  ) {
    return "Timber & Forestry";
  }
  if (/sludge|sewage|wastewater|municipal|wwtp|digestate/.test(text)) {
    return "Municipal & Sludge";
  }
  return "Energy & Utilities";
}
