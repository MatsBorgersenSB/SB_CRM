/**
 * Niche Channel & Gathering Radar — multi-sector biochar & pyrolysis intelligence.
 * Reality First: channel recommendations grounded in company industry, geography,
 * tags, and ICP profile — never invents account-specific claims.
 */

import { findPrismaCompanyByRouteKey } from "@/lib/data/companies";
import { mapPrismaCompanyToApp } from "@/lib/prisma-mappers";
import { calculateICPScore, companyToICPInput } from "@/lib/marketing/icp-matcher";
import { companyRouteKey } from "@/types/company-360";
import type { Company } from "@/types/company";
import type {
  ChannelCategory,
  ChannelFocusArea,
  NicheChannel,
  NicheChannelRadarResult,
} from "@/lib/marketing/channel-radar-types";

export type {
  ChannelCategory,
  ChannelFocusArea,
  NicheChannel,
  NicheChannelRadarResult,
} from "@/lib/marketing/channel-radar-types";
export {
  CATEGORY_LABELS,
  FOCUS_AREA_LABELS,
} from "@/lib/marketing/channel-radar-types";

// ---------------------------------------------------------------------------
// Master channel database — curated biochar/pyrolysis gathering knowledge
// ---------------------------------------------------------------------------

type ChannelEntry = Omit<NicheChannel, "relevanceScore"> & {
  geoAffinity: string[];
  industryPatterns: RegExp[];
  tagPatterns: RegExp[];
  baseRelevance: number;
};

const CHANNEL_DATABASE: ChannelEntry[] = [
  // ── METALLURGY & REDUCTANTS ────────────────────────────────────────────
  {
    channelName: "METEC — International Metallurgical Trade Fair",
    category: "EXPO",
    focusArea: "METALLURGY",
    strategicAdvice: "Present biocarbon as a coal-replacement reductant for silicon metal and ferrosilicon producers. Target process engineers and procurement leads evaluating fossil-free alternatives.",
    geoAffinity: ["Germany", "DE", "Europe"],
    industryPatterns: [/metal/i, /steel/i, /silicon/i, /ferro/i, /smelt/i, /foundry/i],
    tagPatterns: [/reductant/i, /biocarbon/i, /green\s*steel/i],
    baseRelevance: 85,
  },
  {
    channelName: "Eurofer — European Steel Association",
    category: "ASSOCIATION",
    focusArea: "METALLURGY",
    strategicAdvice: "Engage policy and technical committees focused on fossil-free steelmaking pathways. Position Standard Bio as an enabler of biocarbon supply chains for EU steel decarbonization.",
    geoAffinity: ["Europe", "EU"],
    industryPatterns: [/steel/i, /metal/i, /ferro/i, /iron/i],
    tagPatterns: [/green\s*steel/i, /decarboni/i, /reductant/i],
    baseRelevance: 75,
  },
  {
    channelName: "Green Steel World Conference",
    category: "EXPO",
    focusArea: "METALLURGY",
    strategicAdvice: "Showcase pyrolysis-based biocarbon as a scalable fossil-free reductant. Network with steel producers committed to near-zero-carbon production.",
    geoAffinity: ["Europe", "Germany", "DE", "Sweden", "SE"],
    industryPatterns: [/steel/i, /metal/i, /ferro/i, /smelt/i],
    tagPatterns: [/green\s*steel/i, /biocarbon/i],
    baseRelevance: 80,
  },
  {
    channelName: "Nordic Metallurgical Research Network",
    category: "COMMUNITY",
    focusArea: "METALLURGY",
    strategicAdvice: "Collaborate with Nordic smelters and research institutes evaluating biocarbon quality requirements for silicon and ferroalloy production.",
    geoAffinity: ["Norway", "NO", "Sweden", "SE", "Finland", "FI", "Nordic"],
    industryPatterns: [/metal/i, /silicon/i, /ferro/i, /smelt/i],
    tagPatterns: [/biocarbon/i, /reductant/i, /nordic/i],
    baseRelevance: 70,
  },

  // ── BATTERY & ENERGY STORAGE ───────────────────────────────────────────
  {
    channelName: "The Battery Show Europe",
    category: "EXPO",
    focusArea: "BATTERY_STORAGE",
    strategicAdvice: "Position hard carbon from pyrolysis as a sustainable anode material for sodium-ion batteries. Target battery cell manufacturers and material sourcing teams.",
    geoAffinity: ["Europe", "Germany", "DE"],
    industryPatterns: [/battery/i, /energy\s*storage/i, /sodium/i, /anode/i, /electro/i],
    tagPatterns: [/hard\s*carbon/i, /sodium\s*ion/i, /anode/i],
    baseRelevance: 80,
  },
  {
    channelName: "International Sodium-Ion Battery Summit",
    category: "EXPO",
    focusArea: "BATTERY_STORAGE",
    strategicAdvice: "Present biomass-derived hard carbon as a cost-effective, sustainable anode alternative. Engage R&D leads benchmarking anode precursor supply chains.",
    geoAffinity: ["Europe", "Asia"],
    industryPatterns: [/sodium/i, /battery/i, /anode/i, /energy\s*storage/i],
    tagPatterns: [/sodium\s*ion/i, /hard\s*carbon/i],
    baseRelevance: 75,
  },
  {
    channelName: "European Battery Alliance (EBA)",
    category: "ASSOCIATION",
    focusArea: "BATTERY_STORAGE",
    strategicAdvice: "Join working groups on sustainable raw materials for European battery value chains. Advocate for biochar-derived hard carbon in EU battery regulations.",
    geoAffinity: ["Europe", "EU"],
    industryPatterns: [/battery/i, /energy/i, /storage/i, /electro/i],
    tagPatterns: [/battery/i, /hard\s*carbon/i, /eu\s*battery/i],
    baseRelevance: 70,
  },
  {
    channelName: "Advanced Carbon Materials Conference",
    category: "EXPO",
    focusArea: "BATTERY_STORAGE",
    strategicAdvice: "Showcase pyrolysis-derived carbon materials for supercapacitors, activated carbon electrodes, and next-gen energy storage applications.",
    geoAffinity: ["Europe", "Global"],
    industryPatterns: [/carbon/i, /material/i, /supercapacitor/i, /electrode/i],
    tagPatterns: [/activated\s*carbon/i, /advanced\s*carbon/i, /supercap/i],
    baseRelevance: 65,
  },

  // ── CONSTRUCTION & INFRASTRUCTURE ──────────────────────────────────────
  {
    channelName: "Concrete Innovation Summit Europe",
    category: "EXPO",
    focusArea: "CONSTRUCTION",
    strategicAdvice: "Present biochar as a carbon-negative cement addite and concrete filler. Target concrete producers evaluating pathways to reduce embodied carbon.",
    geoAffinity: ["Europe"],
    industryPatterns: [/construct/i, /concrete/i, /cement/i, /building/i, /infra/i],
    tagPatterns: [/carbon\s*negative/i, /concrete/i, /cement/i, /asphalt/i],
    baseRelevance: 70,
  },
  {
    channelName: "Sustainable Materials Summit",
    category: "EXPO",
    focusArea: "CONSTRUCTION",
    strategicAdvice: "Position biochar-enhanced building materials as a pathway to carbon-negative construction. Engage architects, developers, and material specifiers.",
    geoAffinity: ["Europe", "Nordic"],
    industryPatterns: [/construct/i, /building/i, /material/i, /architect/i],
    tagPatterns: [/sustainable\s*material/i, /bio\s*based/i, /green\s*build/i],
    baseRelevance: 65,
  },
  {
    channelName: "European Asphalt & Road Construction Association",
    category: "ASSOCIATION",
    focusArea: "CONSTRUCTION",
    strategicAdvice: "Explore biochar as an asphalt modifier for improved binder performance and carbon sequestration in road infrastructure.",
    geoAffinity: ["Europe"],
    industryPatterns: [/asphalt/i, /road/i, /pav/i, /infra/i],
    tagPatterns: [/asphalt/i, /road/i, /bitumen/i],
    baseRelevance: 55,
  },

  // ── ENVIRONMENTAL & WATER TREATMENT ────────────────────────────────────
  {
    channelName: "IFAT Europe — Environmental Technology",
    category: "EXPO",
    focusArea: "WATER_TREATMENT",
    strategicAdvice: "Showcase active biochar for wastewater treatment, stormwater filtration, and industrial effluent remediation. IFAT is the world's largest environmental technology trade fair.",
    geoAffinity: ["Europe", "Germany", "DE", "Global"],
    industryPatterns: [/water/i, /waste/i, /environment/i, /filtr/i, /treatment/i, /remediat/i],
    tagPatterns: [/wastewater/i, /stormwater/i, /filtration/i, /activated\s*carbon/i],
    baseRelevance: 80,
  },
  {
    channelName: "Aquatech — Water Technology Exhibition",
    category: "EXPO",
    focusArea: "WATER_TREATMENT",
    strategicAdvice: "Present biochar-based adsorbents as a sustainable alternative to conventional activated carbon in drinking water and industrial water treatment.",
    geoAffinity: ["Europe", "Netherlands", "NL", "Global"],
    industryPatterns: [/water/i, /aqua/i, /filtr/i, /treatment/i, /purif/i],
    tagPatterns: [/water\s*treatment/i, /adsorbent/i, /activated/i],
    baseRelevance: 75,
  },
  {
    channelName: "International Water Association (IWA)",
    category: "ASSOCIATION",
    focusArea: "WATER_TREATMENT",
    strategicAdvice: "Engage with research and practitioner networks exploring biochar for nutrient removal, micropollutant adsorption, and nature-based solutions.",
    geoAffinity: ["Europe", "Global"],
    industryPatterns: [/water/i, /environment/i, /treatment/i],
    tagPatterns: [/water/i, /nutrient/i, /micropollutant/i],
    baseRelevance: 60,
  },

  // ── BIOCHAR & CDR ──────────────────────────────────────────────────────
  {
    channelName: "European Biochar Industry Consortium (EBI) Summit",
    category: "EXPO",
    focusArea: "BIOCHAR_CDR",
    strategicAdvice: "Core gathering for the European biochar industry. Present pyrolysis technology, engage certification bodies (EBC), and network with biochar producers and offtakers.",
    geoAffinity: ["Europe", "Germany", "DE", "Switzerland", "CH"],
    industryPatterns: [/biochar/i, /pyrolysis/i, /carbon/i, /clean/i, /waste/i, /energy/i],
    tagPatterns: [/biochar/i, /ebi/i, /ebc/i, /carbon\s*removal/i],
    baseRelevance: 90,
  },
  {
    channelName: "Carbon Unbound Europe",
    category: "EXPO",
    focusArea: "BIOCHAR_CDR",
    strategicAdvice: "CDR-focused conference attracting carbon removal buyers, registries, and technology providers. Position pyrolysis biochar as a durable, verifiable CDR pathway.",
    geoAffinity: ["Europe"],
    industryPatterns: [/carbon/i, /cdr/i, /removal/i, /climate/i, /clean/i],
    tagPatterns: [/carbon\s*removal/i, /cdr/i, /biochar/i, /negative\s*emission/i],
    baseRelevance: 85,
  },
  {
    channelName: "Bio360 Expo — Bioeconomy & Bioenergy",
    category: "EXPO",
    focusArea: "BIOCHAR_CDR",
    strategicAdvice: "Broad bioeconomy expo covering pyrolysis, gasification, and biomass conversion. Good for feedstock sourcing partnerships and technology showcases.",
    geoAffinity: ["Europe", "France", "FR"],
    industryPatterns: [/bio/i, /energy/i, /biomass/i, /pyrolysis/i, /gasif/i],
    tagPatterns: [/bioeconomy/i, /bioenergy/i, /biomass/i],
    baseRelevance: 75,
  },
  {
    channelName: "Nordic Biochar Network",
    category: "COMMUNITY",
    focusArea: "BIOCHAR_CDR",
    strategicAdvice: "Regional network connecting Nordic biochar producers, researchers, and municipalities. Ideal for local market intelligence and collaborative project development.",
    geoAffinity: ["Norway", "NO", "Sweden", "SE", "Denmark", "DK", "Finland", "FI", "Nordic"],
    industryPatterns: [/biochar/i, /pyrolysis/i, /carbon/i],
    tagPatterns: [/nordic/i, /biochar/i],
    baseRelevance: 70,
  },
  {
    channelName: "Puro.earth Carbon Removal Registry",
    category: "REGISTRY",
    focusArea: "BIOCHAR_CDR",
    strategicAdvice: "Leading carbon removal credit registry for biochar. Relevant if the customer plans to monetize carbon removal credits from pyrolysis operations.",
    geoAffinity: ["Europe", "Global"],
    industryPatterns: [/carbon/i, /cdr/i, /credit/i, /offset/i, /removal/i],
    tagPatterns: [/puro/i, /carbon\s*credit/i, /carbon\s*removal/i, /registry/i],
    baseRelevance: 65,
  },
  {
    channelName: "European Biochar Certificate (EBC) Network",
    category: "ASSOCIATION",
    focusArea: "BIOCHAR_CDR",
    strategicAdvice: "Certification body for biochar quality. Essential engagement if the customer's market requires EBC-certified biochar for soil, feed, or material applications.",
    geoAffinity: ["Europe", "Switzerland", "CH", "Germany", "DE"],
    industryPatterns: [/biochar/i, /certif/i, /quality/i, /standard/i],
    tagPatterns: [/ebc/i, /certif/i, /biochar\s*quality/i],
    baseRelevance: 60,
  },

  // ── FEEDSTOCK & BIOMASS ────────────────────────────────────────────────
  {
    channelName: "World Biomass Conference & Expo",
    category: "EXPO",
    focusArea: "FEEDSTOCK",
    strategicAdvice: "Source feedstock partnerships and evaluate biomass supply chain logistics. Critical for customers needing reliable, contracted feedstock volumes.",
    geoAffinity: ["Europe", "Global"],
    industryPatterns: [/biomass/i, /feedstock/i, /wood/i, /forest/i, /residual/i, /waste/i],
    tagPatterns: [/biomass/i, /feedstock/i, /wood\s*chip/i, /pellet/i],
    baseRelevance: 70,
  },
  {
    channelName: "European Biomass Association (AEBIOM / Bioenergy Europe)",
    category: "ASSOCIATION",
    focusArea: "FEEDSTOCK",
    strategicAdvice: "Engage policy teams shaping EU biomass sustainability criteria. Important for understanding feedstock eligibility and RED III compliance.",
    geoAffinity: ["Europe", "EU"],
    industryPatterns: [/biomass/i, /bio\s*energy/i, /feedstock/i, /wood/i, /forest/i],
    tagPatterns: [/biomass/i, /red\s*iii/i, /sustainability\s*criteria/i],
    baseRelevance: 60,
  },
  {
    channelName: "Waste-to-Resource Europe Summit",
    category: "EXPO",
    focusArea: "FEEDSTOCK",
    strategicAdvice: "Connect with waste management operators exploring pyrolysis for residual waste valorization. Good for securing contaminated or mixed-stream feedstock agreements.",
    geoAffinity: ["Europe"],
    industryPatterns: [/waste/i, /residual/i, /resource/i, /valoris/i, /circular/i],
    tagPatterns: [/waste\s*to/i, /residual/i, /circular/i],
    baseRelevance: 65,
  },
];

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

function companyTextSignal(company: Company): string {
  const parts: string[] = [
    company.Industry ?? "",
    company.Title ?? "",
    ...(company.Tags ?? []),
    company.companyType ? String(company.companyType) : "",
  ];
  return parts.join(" ");
}

function geographyTokens(company: Company): string[] {
  const tokens: string[] = [];
  if (company.Country?.Title) tokens.push(company.Country.Title);
  if (company.countryCode) tokens.push(company.countryCode.toUpperCase());
  if (company.continent) tokens.push(company.continent);
  const isNordic = /norway|sweden|denmark|finland|iceland/i.test(
    [company.Country?.Title, company.countryCode, company.continent].join(" "),
  );
  if (isNordic) tokens.push("Nordic");
  const isEu = /europe|eu|germany|france|netherlands|belgium|austria|spain|italy|portugal|poland|czech|romania|bulgaria|croatia|ireland/i.test(
    [company.Country?.Title, company.countryCode, company.continent].join(" "),
  );
  if (isEu) tokens.push("Europe", "EU");
  return tokens;
}

function scoreChannel(entry: ChannelEntry, company: Company): number {
  let score = entry.baseRelevance;

  const signal = companyTextSignal(company);
  const geoTokens = geographyTokens(company);

  // Industry pattern match bonus
  const industryHits = entry.industryPatterns.filter((p) => p.test(signal)).length;
  score += Math.min(industryHits * 5, 15);

  // Tag pattern match bonus
  const tagHits = entry.tagPatterns.filter((p) => p.test(signal)).length;
  score += Math.min(tagHits * 4, 12);

  // Geo affinity bonus
  const geoMatch = entry.geoAffinity.some((g) =>
    geoTokens.some((t) => t.toLowerCase() === g.toLowerCase()),
  );
  if (geoMatch) score += 8;

  // Universal biochar/pyrolysis signals — every channel gets a small boost
  if (/pyrolysis|biochar/i.test(signal)) score += 3;

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function findNicheGatheringChannels(
  companyId: string,
): Promise<NicheChannelRadarResult> {
  const prismaCompany = await findPrismaCompanyByRouteKey(companyId);
  if (!prismaCompany) {
    return {
      companyId,
      companyName: companyId,
      channels: [],
      groundedIn: [],
    };
  }

  const company = mapPrismaCompanyToApp(prismaCompany);
  const routeKey = companyRouteKey(company) || companyId;

  const icp = calculateICPScore(
    companyToICPInput({ ...company, size: prismaCompany.size }),
  );

  const scored: NicheChannel[] = CHANNEL_DATABASE.map((entry) => ({
    channelName: entry.channelName,
    category: entry.category,
    focusArea: entry.focusArea,
    relevanceScore: scoreChannel(entry, company),
    strategicAdvice: entry.strategicAdvice,
  }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore);

  const grounded: string[] = [
    `Industry: ${company.Industry ?? "Unknown"}`,
    `Geography: ${company.Country?.Title ?? company.countryCode ?? "Unknown"}`,
  ];
  if ((company.Tags ?? []).length > 0) {
    grounded.push(`Tags: ${company.Tags!.join(", ")}`);
  }
  if (icp.matchingCriteria.length > 0) {
    grounded.push("ICP matching criteria");
  }

  return {
    companyId: routeKey,
    companyName: company.Title,
    channels: scored,
    groundedIn: grounded,
  };
}
