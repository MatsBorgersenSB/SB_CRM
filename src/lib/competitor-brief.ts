import { htmlToPlainText, type SourceFinding, type SourceFindingClaim } from "@/lib/source-findings";
import type { Company } from "@/types/company";

/** Cap at five — internal competitor knowledge, not a SWOT essay. */
export const COMPETITOR_BRIEF_MAX_CLAIMS = 5;

export type CompetitorDealOverlap = {
  dealId: string;
  dealName: string;
};

export type CompetitorBriefInput = {
  companyName: string;
  htmlOrText?: string;
  sourceUrl?: string;
  overlap: CompetitorDealOverlap[];
};

function claim(id: string, statement: string, impact: string): SourceFindingClaim {
  return { id, statement, impact };
}

function isFluff(text: string): boolean {
  const lower = text.toLowerCase();
  if (text.length < 24) return true;
  const fluffOnly =
    /leading (global|provider|company)|world-?class|cutting-?edge|innovative solutions|sustainable solutions|our mission is|passionate about|state-of-the-art solutions/;
  const hasFact =
    /pyrolysis|pyrolyse|carboni|biochar|feedstock|manure|reactor|plant|equipment|tonn|kg\/h|overlap|tender|render|sludge|plastic|tyre|tire|wood|biomass/i;
  if (fluffOnly.test(lower) && !hasFact.test(text)) return true;
  return false;
}

/**
 * Names we can safely search for in our own deals — not legal suffixes.
 */
export function competitorSearchNames(title: string): string[] {
  const raw = title.trim();
  if (!raw) return [];
  const stripped = raw
    .replace(
      /\b(b\.?\s?v\.?|ltd\.?|inc\.?|gmbh|s\.?a\.?|a\/?s|ab|oy|llc|plc|n\.?v\.?|pty|co\.?|corp\.?)\b/gi,
      " ",
    )
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const names = new Set<string>();
  if (raw.length >= 5) names.add(raw.toLowerCase());
  if (stripped.length >= 5) names.add(stripped.toLowerCase());
  const first = stripped.split(/\s+/)[0] ?? "";
  if (first.length >= 5) names.add(first.toLowerCase());
  return [...names];
}

type DealOverlapSource = {
  id: string;
  assetName: string;
  currentMilestone?: string;
  targetFeedstock?: string;
  understanding?: unknown;
  ClientLookup?: string;
};

export function findCompetitorDealOverlap(
  deals: DealOverlapSource[],
  company: Pick<Company, "CompanyID" | "Title">,
): CompetitorDealOverlap[] {
  const names = competitorSearchNames(company.Title);
  if (names.length === 0) return [];
  const selfIds = new Set(
    [company.CompanyID, company.Title].map((value) => value.trim().toLowerCase()).filter(Boolean),
  );

  const hits: CompetitorDealOverlap[] = [];
  for (const deal of deals) {
    const client = (deal.ClientLookup ?? "").trim().toLowerCase();
    if (client && selfIds.has(client)) continue;

    const hay = [
      deal.assetName,
      deal.currentMilestone,
      deal.targetFeedstock,
      deal.understanding ? JSON.stringify(deal.understanding) : "",
    ]
      .join(" ")
      .toLowerCase();

    if (!names.some((name) => hay.includes(name))) continue;
    const dealName = deal.assetName.trim();
    if (!dealName) continue;
    hits.push({ dealId: deal.id, dealName });
    if (hits.length >= 2) break;
  }
  return hits;
}

function collectFeedstocks(text: string): string[] {
  const rules: Array<[RegExp, string]> = [
    [/animal by-?products?|rendering|carcass|slaughter/i, "animal by-products"],
    [/manure|husdyr|slurry/i, "manure"],
    [/digestate/i, "digestate"],
    [/sewage sludge|wastewater sludge|\bsewage\b/i, "sewage sludge"],
    [/biosolids?|\bsludge\b/i, "sludge / biosolids"],
    [/fish sludge|aquaculture|fiskeslam/i, "aquaculture sludge"],
    [/food waste|organic waste|matavfall/i, "food waste"],
    [/\btyres?\b|\btires?\b|rubber/i, "tyres"],
    [/\bplastics?\b|mixed plastic|rdf\b/i, "plastics / RDF"],
    [/wood|forestry|woodchip|trevirke|lignocellul/i, "woody biomass"],
    [/agricultural residue|straw|halm|husk/i, "agricultural residues"],
    [/\bbiomass\b/i, "biomass"],
  ];
  const found: string[] = [];
  for (const [pattern, label] of rules) {
    if (pattern.test(text) && !found.includes(label)) found.push(label);
    if (found.length >= 4) break;
  }
  return found;
}

function extractOffer(text: string, companyName: string): SourceFindingClaim | null {
  const pyrolysis = /pyrolysis|pyrolyse|carboni[sz]ation|torrefaction|slow pyrolysis/i.test(text);
  const gasification = /gasif(?:y|ication|ier)/i.test(text);
  const thermal = pyrolysis || gasification;
  const equipment =
    /equipment|machinery|reactor|plant|system|installation|unit|technology|turnkey|gasifier/i.test(
      text,
    );
  const rendering = /render(ing)?|animal by-?product/i.test(text);
  const biochar = /\bbiochar\b|biokull/i.test(text);
  const name = companyName.trim() || "This competitor";
  const thermalLabel = [
    pyrolysis ? "pyrolysis" : null,
    gasification ? "gasification" : null,
  ]
    .filter(Boolean)
    .join(" / ");
  const feed = collectFeedstocks(text);
  const feedForThermal = feed.filter((item) => item !== "animal by-products");

  if (thermal && equipment && rendering) {
    const feedBit =
      feedForThermal.length > 0 ? ` for ${feedForThermal.slice(0, 2).join(" and ")}` : "";
    return claim(
      "offer",
      `${name} sells ${thermalLabel} equipment${feedBit}, plus rendering systems for animal by-products.`,
      "If they sell the same plant type as we do, they are a real rival — not a different category.",
    );
  }
  if (thermal && equipment) {
    const forWhat = feedForThermal.length > 0 ? ` for ${feedForThermal.slice(0, 2).join(" and ")}` : "";
    return claim(
      "offer",
      `${name} sells ${thermalLabel} equipment${forWhat}.`,
      "Offer overlap is why this company belongs in our competitor knowledge — not as a slogan on a website.",
    );
  }
  if (equipment && biochar && !thermal) {
    return claim(
      "offer",
      `${name} sells equipment used in biochar production.`,
      "Selling biochar is not the same as selling the machine. Confirm which, or we mis-read the competition.",
    );
  }
  if (rendering && equipment) {
    return claim(
      "offer",
      `${name} sells rendering / animal-by-product processing equipment.`,
      "Rendering kit is a different category than a pyrolysis plant. Record it so we do not mix rivals.",
    );
  }
  if (thermal && biochar && !equipment) {
    return claim(
      "offer",
      `${name} is tied to ${thermalLabel} / biochar — confirm whether they sell plants or carbon product.`,
      "Selling biochar is not the same as selling the machine. Confirm which before we treat them as a machinery rival.",
    );
  }
  return null;
}

function extractCapacity(text: string): SourceFindingClaim | null {
  const match = text.match(
    /(\d{1,4}(?:[.,]\d+)?)\s*(?:t\/h|tonnes? per hour|kg\/h|tpa|t\/year|tonnes?\/year|tonn per \u00e5r)/i,
  );
  if (!match) return null;
  return claim(
    "capacity",
    `Public material states a capacity around ${match[0].replace(/\s+/g, " ")}.`,
    "Capacity tells us whether they play in the same size band as we do.",
  );
}

function cleanPlaceName(raw: string): string | null {
  const stop = new Set([
    "for",
    "the",
    "our",
    "a",
    "an",
    "we",
    "with",
    "and",
    "this",
    "their",
    "to",
    "of",
    "on",
    "as",
  ]);
  const parts = raw.split(/[\s,]+/).filter(Boolean);
  const kept: string[] = [];
  for (const part of parts) {
    if (stop.has(part.toLowerCase())) break;
    kept.push(part);
  }
  const place = kept.join(" ").replace(/[,.]$/, "");
  if (place.length < 4) return null;
  if (/cookie|privacy|linkedin|facebook/i.test(place)) return null;
  return place;
}

function extractWhere(text: string): SourceFindingClaim | null {
  const named = text.match(
    /(?:[Gg]asifier|[Pp]yrolysis|[Pp]yrolyse|[Pp]lant|[Rr]eactor)\s+installation in\s+([A-Z][A-Za-z\u00e0-\u00ff]+(?:[\s,][A-Z][A-Za-z\u00e0-\u00ff]+){0,4})/,
  );
  if (named?.[1]) {
    const place = cleanPlaceName(named[1]);
    if (place) {
      return claim(
        "where",
        `They name an installation in ${place}.`,
        "A named site is competitor knowledge. A country list in a footer is not.",
      );
    }
  }

  const match = text.match(
    /(?:headquartered|based|facilities|plants?|installations?|references?)\s+in\s+([A-Z][A-Za-z\u00e0-\u00ff]+(?:[\s,][A-Z][A-Za-z\u00e0-\u00ff]+){0,4})/,
  );
  if (!match?.[1]) return null;
  const place = cleanPlaceName(match[1]);
  if (!place) return null;
  return claim(
    "where",
    `They describe operations or references in ${place}.`,
    "Where they operate is part of knowing the competition — not a global website footer.",
  );
}

function extractChange(text: string): SourceFindingClaim | null {
  const match = text.match(
    /((?:launched|opened|acquired|expanded|new plant|partnership|commissioned)[^.!?]{0,80}(20(?:2[4-9]|3\d))|(20(?:2[4-9]|3\d))[^.!?]{0,40}(?:launched|opened|acquired|expanded|new plant|partnership|commissioned))/i,
  );
  if (!match) return null;
  const snippet = match[0].replace(/\s+/g, " ").trim();
  if (snippet.length < 20) return null;
  return claim(
    "changed",
    `What changed: ${snippet}.`,
    "Stale competitor knowledge is not knowledge. Keep this current.",
  );
}

/**
 * High-value internal competitor knowledge only. No SWOT, no slogans, no customer talk-tracks.
 */
export function extractCompetitorBriefClaims(input: CompetitorBriefInput): SourceFindingClaim[] {
  const text = input.htmlOrText ? htmlToPlainText(input.htmlOrText) : "";
  const claims: SourceFindingClaim[] = [];

  for (const overlap of input.overlap.slice(0, 2)) {
    claims.push(
      claim(
        `overlap-${overlap.dealId}`,
        `This name appears on our live opportunity “${overlap.dealName}”.`,
        "They already appear in our own pipeline picture. Confirm so we know where we compete — we do not invent overlap.",
      ),
    );
  }

  const offer = text ? extractOffer(text, input.companyName) : null;
  if (offer && !isFluff(offer.statement)) claims.push(offer);

  if (text) {
    const feedstocks = collectFeedstocks(text);
    if (feedstocks.length > 0 && !claims.some((row) => row.id === "offer")) {
      claims.push(
        claim(
          "feedstock",
          `Public material ties them to ${feedstocks.slice(0, 3).join(", ")}.`,
          "Shared feedstock is where we actually compete. That is internal knowledge.",
        ),
      );
    }

    const where = extractWhere(text);
    if (where) claims.push(where);

    const capacity = extractCapacity(text);
    if (capacity) claims.push(capacity);

    const changed = extractChange(text);
    if (changed) claims.push(changed);
  }

  const unique: SourceFindingClaim[] = [];
  const seen = new Set<string>();
  for (const row of claims) {
    const key = row.statement.toLowerCase();
    if (seen.has(key) || isFluff(row.statement)) continue;
    seen.add(key);
    unique.push(row);
    if (unique.length >= COMPETITOR_BRIEF_MAX_CLAIMS) break;
  }

  if (unique.length === 0) {
    unique.push(
      claim(
        "unknown",
        input.sourceUrl
          ? "SmartAssist found nothing that increases our knowledge of this competitor — slogans are not knowledge. Paste a product or reference page."
          : "No website on this record, and no overlap on live deals. Paste a product page or write one fact we already know internally.",
        "Until we know their offer, feedstock, or overlap with us, this competitor record does not increase understanding.",
      ),
    );
  }

  return unique;
}

export function competitorBriefTitle(companyName: string, sourceHost?: string): string {
  const name = companyName.trim() || "Competitor";
  if (sourceHost) return `${name} — what we know from ${sourceHost}`;
  return `${name} — what we know`;
}

export function hasConfirmedCompetitorKnowledge(findings: SourceFinding[] | undefined): boolean {
  return (findings ?? []).some((finding) =>
    finding.claims.some(
      (row) => row.decision === "confirmed" && row.id !== "unknown" && row.statement.trim().length > 0,
    ),
  );
}

