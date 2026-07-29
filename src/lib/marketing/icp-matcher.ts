/**
 * ICP Precision Matcher & ABM Scanner
 * Scores companies against Standard Bio B2B ideal-customer criteria.
 * Reality First: only observed company fields — never invent fit.
 */

import type { Company, CompanyIndustry, CompanyStatus } from "@/types/company";
import { normalizeCompanyTypes } from "@/lib/company-classification";

export type ICPTier = "TIER_1_ABM" | "TIER_2_WATCHLIST" | "TIER_3_DISQUALIFIED";

export type ICPTargetSector =
  | "Cleantech"
  | "Transport"
  | "Industrial"
  | "Aquaculture"
  | "Energy"
  | "Manufacturing";

export type ICPCompanyInput = {
  Title?: string;
  Industry?: string | null;
  Status?: string | null;
  Country?: string | { Title?: string } | null;
  countryCode?: string | null;
  continent?: string | null;
  organizationNumber?: string | null;
  vatNumber?: string | null;
  CompanyTypes?: string[] | null;
  companyType?: string | null;
  /** Prisma CompanySize: micro | small | medium | large | unknown */
  size?: string | null;
  /** Optional employee count when known */
  employeeCount?: number | null;
  City?: string | null;
  Tags?: string[] | null;
};

export type ICPScoreResult = {
  score: number;
  tier: ICPTier;
  matchingCriteria: string[];
  gaps: string[];
  breakdown: {
    geography: number;
    sectors: number;
    companyFit: number;
  };
};

const NORDIC_COUNTRIES = new Set([
  "norway",
  "sweden",
  "denmark",
  "finland",
  "iceland",
  "norge",
  "sverige",
  "danmark",
  "suomi",
]);

const NORDIC_CODES = new Set(["NO", "SE", "DK", "FI", "IS"]);

const EU_CODES = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
]);

const INDUSTRY_TO_SECTORS: Record<string, ICPTargetSector[]> = {
  "Waste Management": ["Cleantech", "Industrial"],
  "Energy & Infrastructure": ["Energy", "Cleantech"],
  "Polymer Processing": ["Manufacturing", "Industrial"],
  "Textile Recovery": ["Cleantech", "Manufacturing"],
  "Chemical Manufacturing": ["Manufacturing", "Industrial"],
};

const SECTOR_PATTERNS: Array<{ sector: ICPTargetSector; pattern: RegExp }> = [
  {
    sector: "Cleantech",
    pattern:
      /\bclean\s*tech\b|\bcircular\b|\bbiochar\b|\bpyrolysis\b|\brecycl|\bsustainab|\bwaste\b|\benvironment/i,
  },
  {
    sector: "Transport",
    pattern: /\btransport\b|\blogistics\b|\bshipping\b|\bfleet\b|\bmaritime\b|\bport\b/i,
  },
  {
    sector: "Industrial",
    pattern: /\bindustrial\b|\bmanufactur|\bplant\b|\bfactory\b|\bprocess(?:ing)?\b/i,
  },
  {
    sector: "Aquaculture",
    pattern: /\baquaculture\b|\bfish\s*farm|\bseafood\b|\bsalmon\b|\baqua\b/i,
  },
  {
    sector: "Energy",
    pattern: /\benergy\b|\brenewable\b|\bpower\b|\butility\b|\bhydrogen\b|\bbiogas\b/i,
  },
  {
    sector: "Manufacturing",
    pattern: /\bmanufactur|\bproduction\b|\bpolymer\b|\bchemical\b|\btextile\b/i,
  },
];

function countryTitle(country: ICPCompanyInput["Country"]): string {
  if (!country) return "";
  if (typeof country === "string") return country.trim();
  return country.Title?.trim() ?? "";
}

function normalizeCode(code: string | null | undefined): string {
  return (code ?? "").trim().toUpperCase();
}

function detectSectors(input: ICPCompanyInput): ICPTargetSector[] {
  const found = new Set<ICPTargetSector>();
  const industry = input.Industry?.trim() ?? "";
  for (const sector of INDUSTRY_TO_SECTORS[industry] ?? []) {
    found.add(sector);
  }

  const corpus = [
    industry,
    input.Title ?? "",
    ...(input.Tags ?? []),
    ...(input.CompanyTypes ?? []),
    input.companyType ?? "",
  ]
    .join(" ")
    .toLowerCase();

  for (const entry of SECTOR_PATTERNS) {
    if (entry.pattern.test(corpus)) found.add(entry.sector);
  }

  return [...found];
}

function scoreGeography(input: ICPCompanyInput): {
  points: number;
  matches: string[];
  gaps: string[];
} {
  const matches: string[] = [];
  const gaps: string[] = [];
  let points = 0;

  const country = countryTitle(input.Country);
  const code = normalizeCode(input.countryCode);
  const continent = (input.continent ?? "").trim().toLowerCase();
  const isNorway =
    code === "NO" || /\bnorway\b|\bnorge\b/i.test(country);
  const isNordic =
    isNorway ||
    NORDIC_CODES.has(code) ||
    NORDIC_COUNTRIES.has(country.toLowerCase());
  const isEu =
    EU_CODES.has(code) ||
    /\beuropean union\b|\beu\b/i.test(country) ||
    (continent === "europe" && !isNordic);

  if (isNorway) {
    points += 30;
    matches.push("Geography: Norway (priority market)");
  } else if (isNordic) {
    points += 24;
    matches.push(`Geography: Nordic market (${country || code || "Nordics"})`);
  } else if (isEu || continent === "europe") {
    points += 16;
    matches.push(
      `Geography: ${isEu ? "EU" : "Europe"} footprint (${country || code || continent})`,
    );
  } else if (country || code || continent) {
    points += 4;
    gaps.push(
      `Geography outside priority Nordics/EU (${country || code || continent})`,
    );
  } else {
    gaps.push("Geography unknown — add country / continent");
  }

  const registryVerified = Boolean(
    input.organizationNumber?.trim() || input.vatNumber?.trim(),
  );
  if (registryVerified) {
    points += 8;
    matches.push(
      input.organizationNumber?.trim()
        ? `Registry verified (orgnr ${input.organizationNumber.trim()})`
        : "VAT / registry identifier present",
    );
  } else {
    gaps.push("No organization / VAT number — not registry verified");
  }

  return { points: Math.min(40, points), matches, gaps };
}

function scoreSectors(input: ICPCompanyInput): {
  points: number;
  matches: string[];
  gaps: string[];
} {
  const sectors = detectSectors(input);
  const matches: string[] = [];
  const gaps: string[] = [];

  if (sectors.length === 0) {
    gaps.push(
      "No target sector match (Cleantech, Transport, Industrial, Aquaculture, Energy, Manufacturing)",
    );
    return { points: 0, matches, gaps };
  }

  // Base for any target sector + bonus for multiple / cleantech-energy combo
  let points = 18;
  matches.push(`Target sector(s): ${sectors.join(", ")}`);

  if (sectors.includes("Cleantech") || sectors.includes("Energy")) {
    points += 10;
    matches.push("High-priority Cleantech / Energy alignment");
  }
  if (sectors.includes("Industrial") || sectors.includes("Manufacturing")) {
    points += 6;
  }
  if (sectors.includes("Aquaculture") || sectors.includes("Transport")) {
    points += 5;
  }
  if (sectors.length >= 2) {
    points += 4;
    matches.push("Multi-sector fit");
  }

  return { points: Math.min(35, points), matches, gaps };
}

function scoreCompanyFit(input: ICPCompanyInput): {
  points: number;
  matches: string[];
  gaps: string[];
} {
  const matches: string[] = [];
  const gaps: string[] = [];
  let points = 0;

  const status = (input.Status ?? "").trim() as CompanyStatus | string;
  if (status === "Active" || status === "Contracted") {
    points += 10;
    matches.push(`Status: ${status}`);
  } else if (status === "Prospecting") {
    points += 7;
    matches.push("Status: Prospecting (ABM-ready)");
  } else if (status === "On Hold") {
    points += 3;
    gaps.push("Status On Hold — lower near-term ABM priority");
  } else if (status === "Inactive") {
    gaps.push("Inactive status — disqualify unless reactivated");
  } else {
    gaps.push("Company status unknown");
  }

  const size = (input.size ?? "unknown").toLowerCase();
  if (size === "medium" || size === "large") {
    points += 12;
    matches.push(`Company size: ${size} (ideal for machinery / services)`);
  } else if (size === "small") {
    points += 7;
    matches.push("Company size: small (services-led entry possible)");
  } else if (size === "micro") {
    points += 2;
    gaps.push("Micro company — may lack CapEx capacity");
  } else {
    gaps.push("Company size unknown");
  }

  const employees = input.employeeCount;
  if (typeof employees === "number" && employees > 0) {
    if (employees >= 50 && employees <= 5000) {
      points += 6;
      matches.push(`Employee count in ICP band (${employees})`);
    } else if (employees > 5000) {
      points += 4;
      matches.push(`Large enterprise (${employees} employees)`);
    } else {
      points += 2;
      gaps.push(`Very small headcount (${employees})`);
    }
  }

  const types = [
    ...(input.CompanyTypes ?? []),
    ...(input.companyType ? [input.companyType] : []),
  ].map((value) => String(value).toLowerCase());
  if (types.some((type) => type.includes("customer") || type.includes("prospect"))) {
    points += 4;
    matches.push("Company type is Customer or Prospect");
  } else if (types.some((type) => type.includes("competitor"))) {
    gaps.push("Tagged as Competitor — not an ABM account target");
    points = Math.max(0, points - 8);
  } else if (types.some((type) => type.includes("partner"))) {
    points += 2;
    matches.push("Partner classification — watchlist / co-sell");
  }

  return { points: Math.min(30, points), matches, gaps };
}

function tierFromScore(score: number): ICPTier {
  if (score >= 75) return "TIER_1_ABM";
  if (score >= 45) return "TIER_2_WATCHLIST";
  return "TIER_3_DISQUALIFIED";
}

/**
 * Evaluate a company against Standard Bio ICP / ABM criteria.
 */
export function calculateICPScore(companyData: ICPCompanyInput): ICPScoreResult {
  const geography = scoreGeography(companyData);
  const sectors = scoreSectors(companyData);
  const fit = scoreCompanyFit(companyData);

  const raw =
    geography.points + sectors.points + fit.points;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  return {
    score,
    tier: tierFromScore(score),
    matchingCriteria: [
      ...geography.matches,
      ...sectors.matches,
      ...fit.matches,
    ],
    gaps: [...geography.gaps, ...sectors.gaps, ...fit.gaps],
    breakdown: {
      geography: geography.points,
      sectors: sectors.points,
      companyFit: fit.points,
    },
  };
}

/** Map app Company → ICP input (optional size from Prisma if present on object). */
export function companyToICPInput(
  company: Company & { size?: string | null; employeeCount?: number | null },
): ICPCompanyInput {
  return {
    Title: company.Title,
    Industry: company.Industry,
    Status: company.Status,
    Country: company.Country,
    countryCode: company.countryCode,
    continent: company.continent,
    organizationNumber: company.organizationNumber,
    vatNumber: company.vatNumber,
    CompanyTypes: normalizeCompanyTypes(company),
    companyType: company.companyType ? String(company.companyType) : undefined,
    size: company.size ?? null,
    employeeCount: company.employeeCount ?? null,
    City: company.City,
    Tags: company.Tags,
  };
}

export function icpTierLabel(tier: ICPTier): string {
  if (tier === "TIER_1_ABM") return "Tier 1 ABM Target";
  if (tier === "TIER_2_WATCHLIST") return "Tier 2 Watchlist";
  return "Tier 3 Disqualified";
}

export function icpTierShortLabel(tier: ICPTier): string {
  if (tier === "TIER_1_ABM") return "Tier 1";
  if (tier === "TIER_2_WATCHLIST") return "Tier 2";
  return "Tier 3";
}

/** Convenience for Industry typing consumers */
export type { CompanyIndustry };
