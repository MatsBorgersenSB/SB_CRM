/**
 * Live Web Recon & Competitor Battlecards
 * Reality First: summaries and signals come from observed website text only.
 * Battlecards are sales-prep templates keyed off detected site signals — never invented news.
 */

import { promises as fs } from "fs";
import path from "path";
import { findPrismaCompanyByRouteKey } from "@/lib/data/companies";
import { fetchWebsitePages, normalizeWebsiteUrl } from "@/lib/discovery/website-fetch";
import { companyWebsiteHref } from "@/lib/company-identity";
import { normalizeCompanyDomain } from "@/lib/company-domain";
import { mapPrismaCompanyToApp } from "@/lib/prisma-mappers";
import { companyRouteKey } from "@/types/company-360";

export type ReconBattlecard = {
  competitorOrObjection: string;
  winStrategy: string;
  keyTalkingPoints: string[];
};

export type AccountReconBrief = {
  companyId: string;
  companyName: string;
  domain: string | null;
  sourceUrl: string | null;
  executiveSummary: string;
  recentSignals: string[];
  perceivedTechStack: string[];
  battlecards: ReconBattlecard[];
  generatedAt: string;
  cached: boolean;
  source: "website" | "crm_only" | "unavailable";
  confidenceNote: string;
};

type CacheFile = {
  updatedAt: string;
  briefs: Record<string, AccountReconBrief>;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_PATH = path.join(process.cwd(), "src", "data", "account-recon-cache.json");

const memoryCache = new Map<string, { expiresAt: number; brief: AccountReconBrief }>();

const TECH_KEYWORDS: Array<{ label: string; pattern: RegExp }> = [
  { label: "Pyrolysis", pattern: /\bpyrolysis\b/i },
  { label: "Biochar", pattern: /\bbiochar\b/i },
  { label: "Gasification", pattern: /\bgasification\b/i },
  { label: "Incineration", pattern: /\bincinerat(?:ion|or|e)\b/i },
  { label: "Anaerobic Digestion", pattern: /\banaerobic\s+digestion\b|\bbiogas\b/i },
  { label: "Recycling", pattern: /\brecycl(?:e|ing|able)\b/i },
  { label: "Waste-to-Energy", pattern: /\bwaste[- ]to[- ]energy\b|\bwte\b/i },
  { label: "Carbon Capture", pattern: /\bcarbon\s+capture\b|\bccs\b|\bccu\b/i },
  { label: "Feedstock", pattern: /\bfeedstock\b/i },
  { label: "Circular Economy", pattern: /\bcircular\s+economy\b|\bcircularity\b/i },
  { label: "Renewable Energy", pattern: /\brenewable\s+energy\b|\bsolar\b|\bwind\s+power\b/i },
  { label: "Hydrogen", pattern: /\bhydrogen\b|\bgreen\s+h2\b/i },
  { label: "Plastic Waste", pattern: /\bplastic\s+waste\b|\bmixed\s+plastics?\b/i },
  { label: "Biomass", pattern: /\bbiomass\b/i },
  { label: "Sustainability Reporting", pattern: /\besg\b|\bsustainability\s+report\b/i },
];

type BattlecardRule = {
  id: string;
  trigger: RegExp;
  card: ReconBattlecard;
};

const BATTLECARD_RULES: BattlecardRule[] = [
  {
    id: "incineration",
    trigger: /\bincinerat(?:ion|or|e)\b|\bwaste[- ]to[- ]energy\b|\bwte\b/i,
    card: {
      competitorOrObjection: "Incineration / WtE as the default disposal path",
      winStrategy:
        "Reframe from disposal cost to material + carbon value — pyrolysis recovers products incineration destroys.",
      keyTalkingPoints: [
        "Incineration destroys feedstock value; pyrolysis can create recoverable outputs.",
        "Ask: what residual streams still leave the plant as ash or flue-gas cost?",
        "Position Standard Bio around predictable feedstock conversion, not volume disposal.",
      ],
    },
  },
  {
    id: "gasification",
    trigger: /\bgasification\b/i,
    card: {
      competitorOrObjection: "Gasification preference",
      winStrategy:
        "Differentiate on operating envelope, feedstock flexibility, and product pathway clarity — not abstract thermal efficiency.",
      keyTalkingPoints: [
        "Clarify target product: syngas vs solid carbon / biochar pathways.",
        "Probe feedstock variability — many gasifiers struggle with mixed/contaminated streams.",
        "Bring a concrete reference case for similar feedstock and capacity.",
      ],
    },
  },
  {
    id: "anaerobic",
    trigger: /\banaerobic\s+digestion\b|\bbiogas\b/i,
    card: {
      competitorOrObjection: "Anaerobic digestion / biogas first",
      winStrategy:
        "Position pyrolysis as complementary for dry/residual fractions AD cannot monetize well.",
      keyTalkingPoints: [
        "AD is strong on wet organics; dry residuals often remain a disposal problem.",
        "Ask which post-AD or non-digestible streams still cost money.",
        "Offer a dual-pathway view: AD + pyrolysis for residual solids.",
      ],
    },
  },
  {
    id: "recycling",
    trigger: /\brecycl(?:e|ing)\b|\bcircular\b/i,
    card: {
      competitorOrObjection: "Mechanical recycling is enough",
      winStrategy:
        "Agree on recycling first, then show pyrolysis for streams recycling rejects.",
      keyTalkingPoints: [
        "Mechanical recycling plateaus on contaminated / mixed plastics.",
        "Ask what share of inbound material is currently rejected or downcycled.",
        "Frame Standard Bio as the next step after sorting — not a rival to recycling.",
      ],
    },
  },
  {
    id: "capex",
    trigger: /\bcapex\b|\binvestment\b|\bbudget\b|\bcost[- ]efficient\b/i,
    card: {
      competitorOrObjection: "CapEx / budget pressure",
      winStrategy:
        "Lead with phased deployment and paid professional services before full machinery commitment.",
      keyTalkingPoints: [
        "Propose a discovery / feedstock study before CapEx decisions.",
        "Quantify avoided disposal cost and recovered product value, not only purchase price.",
        "Offer a staged path: assess → pilot → plant.",
      ],
    },
  },
  {
    id: "permitting",
    trigger: /\bpermit\b|\bpermitting\b|\bregulation\b|\benvironmental\s+impact\b|\beia\b/i,
    card: {
      competitorOrObjection: "Permitting / regulatory uncertainty",
      winStrategy:
        "Make predictability the product — map national/regional/local requirements before design lock.",
      keyTalkingPoints: [
        "Ask which authority owns the critical permit for their site.",
        "Separate technology risk from site/permit risk explicitly.",
        "Bring a regulation checklist tailored to their jurisdiction.",
      ],
    },
  },
];

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&([a-z]+);/gi, " ");
}

function stripTags(html: string): string {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " "),
  )
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMeta(html: string, property: string): string {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
      "i",
    ),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]?.trim()) return decodeHtml(match[1].trim());
  }
  return "";
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? stripTags(match[1]).slice(0, 200) : "";
}

function extractHeadings(html: string): string[] {
  const headings: string[] = [];
  const pattern = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const text = stripTags(match[2] ?? "").trim();
    if (text.length >= 8 && text.length <= 160) headings.push(text);
  }
  return [...new Set(headings)].slice(0, 12);
}

function detectTechStack(corpus: string): string[] {
  return TECH_KEYWORDS.filter((item) => item.pattern.test(corpus)).map(
    (item) => item.label,
  );
}

function detectBattlecards(corpus: string): ReconBattlecard[] {
  const cards: ReconBattlecard[] = [];
  const seen = new Set<string>();
  for (const rule of BATTLECARD_RULES) {
    if (!rule.trigger.test(corpus)) continue;
    if (seen.has(rule.id)) continue;
    seen.add(rule.id);
    cards.push(rule.card);
  }
  return cards.slice(0, 5);
}

function extractRecentSignals(headings: string[], plainText: string): string[] {
  const signalLike = headings.filter((heading) =>
    /\b(news|press|announce|launch|partner|expand|project|invest|award|open|build|plant|facility|202[4-9]|202[0-3])\b/i.test(
      heading,
    ),
  );

  if (signalLike.length > 0) return signalLike.slice(0, 6);

  const sentences = plainText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 40 && s.length <= 220)
    .filter((s) =>
      /\b(announce|launch|partner|expand|invest|open|build|commission|award|sustainab|circular|waste|energy)\b/i.test(
        s,
      ),
    );

  return [...new Set(sentences)].slice(0, 4);
}

function buildExecutiveSummary(input: {
  companyName: string;
  title: string;
  description: string;
  industry?: string;
  techStack: string[];
  source: AccountReconBrief["source"];
}): string {
  if (input.source === "unavailable") {
    return `${input.companyName}: no website domain is on file and no live web context could be gathered. Add a website on the company record, then refresh recon.`;
  }

  if (input.source === "crm_only") {
    const industryBit = input.industry
      ? ` CRM lists industry as ${input.industry}.`
      : "";
    return `${input.companyName} is in the registry but the website could not be fetched or returned no usable content.${industryBit} Refresh after confirming the domain is reachable.`;
  }

  const parts: string[] = [];
  if (input.description) {
    parts.push(input.description.slice(0, 280));
  } else if (input.title) {
    parts.push(
      `${input.companyName} presents itself online as “${input.title}”.`,
    );
  } else {
    parts.push(
      `${input.companyName} has a reachable website, but positioning copy was sparse on the scanned pages.`,
    );
  }

  if (input.techStack.length > 0) {
    parts.push(
      `Observed technology themes include ${input.techStack.slice(0, 4).join(", ")}.`,
    );
  }

  if (input.industry) {
    parts.push(`SmartCRM industry tag: ${input.industry}.`);
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

async function readDiskCache(): Promise<CacheFile> {
  try {
    const raw = await fs.readFile(CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw) as CacheFile;
    if (parsed && typeof parsed === "object" && parsed.briefs) return parsed;
  } catch {
    // missing or invalid — start fresh
  }
  return { updatedAt: new Date().toISOString(), briefs: {} };
}

async function writeDiskCache(file: CacheFile): Promise<void> {
  try {
    await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
    await fs.writeFile(
      CACHE_PATH,
      `${JSON.stringify({ ...file, updatedAt: new Date().toISOString() }, null, 2)}\n`,
      "utf8",
    );
  } catch (error) {
    console.warn(
      "[web-recon] Could not persist cache:",
      error instanceof Error ? error.message : error,
    );
  }
}

function isFresh(generatedAt: string): boolean {
  const ts = Date.parse(generatedAt);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < CACHE_TTL_MS;
}

async function getCachedBrief(
  cacheKey: string,
): Promise<AccountReconBrief | null> {
  const mem = memoryCache.get(cacheKey);
  if (mem && Date.now() < mem.expiresAt) {
    return { ...mem.brief, cached: true };
  }

  const disk = await readDiskCache();
  const brief = disk.briefs[cacheKey];
  if (brief && isFresh(brief.generatedAt)) {
    memoryCache.set(cacheKey, {
      expiresAt: Date.parse(brief.generatedAt) + CACHE_TTL_MS,
      brief,
    });
    return { ...brief, cached: true };
  }
  return null;
}

async function setCachedBrief(
  cacheKey: string,
  brief: AccountReconBrief,
): Promise<void> {
  memoryCache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    brief,
  });
  const disk = await readDiskCache();
  disk.briefs[cacheKey] = { ...brief, cached: false };
  await writeDiskCache(disk);
}

function resolveDomain(
  domain?: string,
  companyDomain?: string,
): string | null {
  const raw = (domain ?? companyDomain ?? "").trim();
  if (!raw) return null;
  try {
    return normalizeCompanyDomain(raw) || null;
  } catch {
    return raw.replace(/^https?:\/\//i, "").split("/")[0] || null;
  }
}

/**
 * Generate (or rebuild) an account recon brief from live website context + CRM facts.
 */
export async function generateAccountReconBrief(
  companyId: string,
  domain?: string,
  companyName?: string,
): Promise<AccountReconBrief> {
  const prismaCompany = await findPrismaCompanyByRouteKey(companyId);
  const company = prismaCompany ? mapPrismaCompanyToApp(prismaCompany) : null;
  const routeKey =
    (company ? companyRouteKey(company) : "") || companyId.trim();
  const name =
    companyName?.trim() || company?.Title || prismaCompany?.name || companyId;
  const resolvedDomain = resolveDomain(domain, company?.Domain ?? undefined);
  const sourceUrl = resolvedDomain
    ? companyWebsiteHref(resolvedDomain)
    : null;

  let source: AccountReconBrief["source"] = "unavailable";
  let title = "";
  let description = "";
  let corpus = "";
  let headings: string[] = [];

  if (sourceUrl) {
    try {
      const { pages } = await fetchWebsitePages(normalizeWebsiteUrl(sourceUrl));
      if (pages.length > 0) {
        source = "website";
        const htmlBlob = pages.map((page) => page.html).join("\n");
        title = extractTitle(pages[0]!.html);
        description =
          extractMeta(pages[0]!.html, "og:description") ||
          extractMeta(pages[0]!.html, "description") ||
          extractMeta(pages[0]!.html, "twitter:description");
        headings = extractHeadings(htmlBlob);
        corpus = `${title}\n${description}\n${headings.join("\n")}\n${stripTags(htmlBlob).slice(0, 40_000)}`;
      } else {
        source = "crm_only";
      }
    } catch {
      source = "crm_only";
    }
  }

  const techStack = detectTechStack(corpus);
  const recentSignals =
    source === "website"
      ? extractRecentSignals(headings, corpus)
      : [];
  const battlecards =
    source === "website"
      ? detectBattlecards(corpus)
      : [];

  // Always offer CapEx prep card when we have a live site but no trigger matched — still Reality First (generic sales prep).
  if (source === "website" && battlecards.length === 0) {
    battlecards.push({
      competitorOrObjection: "No clear competitive trigger on site copy",
      winStrategy:
        "Stay curious — validate objectives, feedstock, and decision process before pitching technology.",
      keyTalkingPoints: [
        "Ask what problem they are trying to solve in the next 12 months.",
        "Confirm feedstock type, volume, and current disposal path.",
        "Identify who owns budget and permitting for any new plant.",
      ],
    });
  }

  const brief: AccountReconBrief = {
    companyId: routeKey,
    companyName: name,
    domain: resolvedDomain,
    sourceUrl,
    executiveSummary: buildExecutiveSummary({
      companyName: name,
      title,
      description,
      industry: company?.Industry,
      techStack,
      source,
    }),
    recentSignals,
    perceivedTechStack: techStack,
    battlecards,
    generatedAt: new Date().toISOString(),
    cached: false,
    source,
    confidenceNote:
      source === "website"
        ? "Based on scanned public website pages. Not a substitute for primary research."
        : source === "crm_only"
          ? "Website scan incomplete — summary limited to CRM context."
          : "No domain available — add a website to enable live recon.",
  };

  await setCachedBrief(routeKey, brief);
  return brief;
}

/**
 * Return cached brief when fresh; otherwise generate.
 */
export async function getAccountReconBrief(
  companyId: string,
  options?: { forceRefresh?: boolean; domain?: string; companyName?: string },
): Promise<AccountReconBrief> {
  const prismaCompany = await findPrismaCompanyByRouteKey(companyId);
  const company = prismaCompany ? mapPrismaCompanyToApp(prismaCompany) : null;
  const routeKey =
    (company ? companyRouteKey(company) : "") || companyId.trim();

  if (!options?.forceRefresh) {
    const cached = await getCachedBrief(routeKey);
    if (cached) return cached;
  }

  return generateAccountReconBrief(
    routeKey,
    options?.domain ?? company?.Domain,
    options?.companyName ?? company?.Title,
  );
}
