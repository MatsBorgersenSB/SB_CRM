/**
 * Company sector tags — Standard Bio go-to-market sectors.
 * Presets are available in the UI; companies stay untagged until a person assigns them.
 */

export const COMPANY_SECTOR_PRESETS = [
  "Timber & Forestry",
  "Municipal & Sludge",
  "Energy & Utilities",
] as const;

export type CompanySectorPreset = (typeof COMPANY_SECTOR_PRESETS)[number];

const MAX_SECTOR_LABEL_LENGTH = 60;

const SECTOR_KEYWORD_PATTERNS: Array<{
  sector: CompanySectorPreset;
  patterns: RegExp[];
}> = [
  {
    sector: "Timber & Forestry",
    patterns: [
      /\b(timber|forestry|sawmill|lumber|logging|woodchip|wood chips|skog|tømmer|tommer|sagbruk)\b/i,
      /\b(forest (residue|biomass|industry|products)|wood waste|pulp wood)\b/i,
    ],
  },
  {
    sector: "Municipal & Sludge",
    patterns: [
      /\b(sludge|biosolid|biosolids|wastewater|sewage|wwtp|kommunal|kommune)\b/i,
      /\b(municipal (waste|sludge|treatment|wwtp)|avløp|avlop|slambehandling|renser(i|y))\b/i,
    ],
  },
  {
    sector: "Energy & Utilities",
    patterns: [
      /\b(district heat(ing)?|fjernvarme|kraftvarme|power plant|utilities|utility company)\b/i,
      /\b(energy (utility|utilities|producer|company)|grid operator|kraftverk|kraftselskap)\b/i,
    ],
  },
];

export function normalizeSectorLabel(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  const preset = COMPANY_SECTOR_PRESETS.find(
    (item) => item.toLowerCase() === trimmed.toLowerCase(),
  );
  return (preset ?? trimmed).slice(0, MAX_SECTOR_LABEL_LENGTH);
}

export function normalizeCompanySectors(
  values: string[] | null | undefined,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values ?? []) {
    const label = normalizeSectorLabel(raw);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

export function companyHasSectors(
  company: { Sectors?: string[] | null } | null | undefined,
): boolean {
  return normalizeCompanySectors(company?.Sectors).length > 0;
}

export type DetectedSector = {
  sector: CompanySectorPreset;
  hits: number;
};

export function detectSectorsFromText(text: string | null | undefined): DetectedSector[] {
  const haystack = (text ?? "").trim();
  if (!haystack) return [];

  const scored: DetectedSector[] = [];
  for (const entry of SECTOR_KEYWORD_PATTERNS) {
    let hits = 0;
    for (const pattern of entry.patterns) {
      const match = haystack.match(pattern);
      if (match) hits += 1;
    }
    if (hits > 0) scored.push({ sector: entry.sector, hits });
  }

  return scored.sort((a, b) => b.hits - a.hits || a.sector.localeCompare(b.sector));
}

export function formatSectorsLabel(sectors: string[] | null | undefined): string {
  const normalized = normalizeCompanySectors(sectors);
  if (normalized.length === 0) return "";
  if (normalized.length === 1) return normalized[0]!;
  if (normalized.length === 2) return `${normalized[0]} and ${normalized[1]}`;
  return `${normalized.slice(0, -1).join(", ")}, and ${normalized[normalized.length - 1]}`;
}

/** ROI / economics focus for draft messaging — no invented numbers. */
export function sectorRoiHint(sector: string): string {
  const label = normalizeSectorLabel(sector);
  switch (label) {
    case "Timber & Forestry":
      return "forestry residue disposal cost, biochar offtake, and carbon value from wood by-products";
    case "Municipal & Sludge":
      return "sludge volume reduction, avoided disposal cost, and wastewater compliance";
    case "Energy & Utilities":
      return "heat and power substitution, district-heat offtake, and carbon intensity reduction";
    default:
      return `${label} operating economics and carbon outcomes`;
  }
}

export function formatSectorRoiHint(sectors: string[] | null | undefined): string {
  const normalized = normalizeCompanySectors(sectors);
  if (normalized.length === 0) return "";
  const unique = [...new Set(normalized.map(sectorRoiHint))];
  if (unique.length === 1) {
    return `ROI for ${formatSectorsLabel(normalized)} should emphasise ${unique[0]}.`;
  }
  return `ROI should be sector-specific: ${normalized
    .map((sector) => `${sector} (${sectorRoiHint(sector)})`)
    .join("; ")}.`;
}

/** Short paragraph for drafts — only when sectors are assigned. */
export function sectorDraftParagraph(sectors: string[] | null | undefined): string {
  const normalized = normalizeCompanySectors(sectors);
  if (normalized.length === 0) return "";
  return `Given ${formatSectorsLabel(normalized).toLowerCase()} operations, the relevant economics are ${normalized
    .map(sectorRoiHint)
    .join("; ")} — not a generic industrial case.`;
}

export function sectorTintClass(sector: string): string {
  const label = normalizeSectorLabel(sector);
  switch (label) {
    case "Timber & Forestry":
      return "border-carbon-blue/18 bg-carbon-blue/[0.07] text-carbon-blue";
    case "Municipal & Sludge":
      return "border-carbon-blue/12 bg-carbon-blue/[0.04] text-carbon-blue/85";
    case "Energy & Utilities":
      return "border-upcycle-orange/30 bg-upcycle-orange/10 text-upcycle-orange";
    default:
      return "border-carbon-blue/12 bg-white text-carbon-blue/80";
  }
}
