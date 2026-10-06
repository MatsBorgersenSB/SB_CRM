export type MarketPlaceId = "europe" | "nordics" | "denmark" | "sweden" | "norway";

export type MarketFactDecision = "confirmed" | "dismissed";

export type MarketBudgetYear = {
  year: string;
  millionDkk: number;
};

export type MarketFact = {
  id: string;
  title: string;
  placeId: MarketPlaceId;
  placeLabel: string;
  /** Words used to match a question. */
  subjects: string[];
  /**
   * When set, a deal only inherits this card if feedstock or industry contains one of these words.
   * Funding and regulation cards leave this empty and follow place alone.
   */
  dealTerms?: string[];
  statement: string;
  offerLine: string;
  asOf: string;
  source: string;
  budget?: MarketBudgetYear[];
  budgetNote?: string;
};

export type ResolvedMarketFact = MarketFact & {
  decision?: MarketFactDecision;
};

export const MARKET_FACT_READ_LABEL = "Read 6 October 2026";

export const MARKET_FACTS: MarketFact[] = [
  {
    id: "dk-soil-storage-aid",
    title: "Danish soil-storage aid",
    placeId: "denmark",
    placeLabel: "Denmark",
    subjects: ["funding", "biochar", "soil", "aid", "digestate", "subsidy"],
    statement:
      "DKK 10.2 billion (2025 prices) from 2027 to 2045 for biochar applied to Danish mineral agricultural soils. Tender tentatively December 2026, bids due March 2027. Operating aid only — not plant capex. Digestate from biogas is a named eligible chain.",
    offerLine:
      "A Danish project can underwrite carbon storage. It still needs a bankable plant, a feedstock contract, and a soil offtake.",
    asOf: "2026-06-26",
    source: "Danish Energy Agency, market dialogue on the biochar aid scheme, 26 June 2026",
    budget: [
      { year: "2027", millionDkk: 184 },
      { year: "2028", millionDkk: 270 },
      { year: "2029", millionDkk: 398 },
      { year: "2030", millionDkk: 586 },
    ],
    budgetNote:
      "Million DKK per year, 2025 prices. From 2030 through 2045 the annual budget stays at 586 million DKK. Money cannot move between years, and it pays stored carbon, not construction.",
  },
  {
    id: "dk-bid-cap",
    title: "Danish bid cap and minimum volume",
    placeId: "denmark",
    placeLabel: "Denmark",
    subjects: ["funding", "biochar", "bid", "cap", "volume"],
    statement:
      "Expected cap DKK 1,750 per tonne of permanently stored CO2, equal to DKK 6,416 per tonne of carbon. Offers above the cap are rejected. Minimum commitment is 400 tonnes CO2 per year (109 tonnes of carbon).",
    offerLine:
      "Credit-style aid does not pay for the machine. Heat and a real offtake still have to carry the investment. A modular plant can clear the minimum volume.",
    asOf: "2026-06-26",
    source: "Danish Energy Agency, market dialogue on the biochar aid scheme, 26 June 2026",
  },
  {
    id: "eu-biochar-certification",
    title: "EU biochar certification",
    placeId: "europe",
    placeLabel: "Europe",
    subjects: ["regulation", "biochar", "crcf", "certification", "certificate"],
    statement:
      "The first CRCF methodology for biochar carbon removal entered into force on 7 May 2026. Eligible storage is soil, or incorporation into cement, concrete, or asphalt. Production and storage must be in the EU. First certificates are expected late 2026 or in 2027. Puro, Isometric and others applied for recognition in June–July 2026; assessment was still in progress.",
    offerLine:
      "Quote a certification path. Leave CRCF revenue out of a customer model until a scheme is recognised and a unit can be issued.",
    asOf: "2026-05-29",
    source:
      "European Parliament EPRS briefing on CRCF permanent removals, 2026. European Commission certification schemes page and CRCF Days note, 29 May 2026",
  },
  {
    id: "se-sewage-sludge",
    title: "Sewage-sludge pyrolysis",
    placeId: "sweden",
    placeLabel: "Sweden",
    subjects: ["feedstock", "sewage", "sludge", "pyrolysis", "municipal"],
    dealTerms: ["sludge", "sewage", "wastewater", "avlop", "avløp", "slam"],
    statement:
      "Roslagsvatten’s full-scale sludge pyrolysis plant at Margretelund is due to start in 2026 — the first in Sweden. Svenskt Vatten finds the market for the char still open: phosphorus plant-availability is unproven, and fertiliser or end-of-waste approval is required before it can be sold.",
    offerLine:
      "A municipal sludge lead is a real project. The sale waits until the char has a legal product status. Fertiliser value matters more than a soil-improver story.",
    asOf: "2025-08-01",
    source:
      "Svenskt Vatten, Slambiokol — marknadspotential, kolkrediter och affärsmodell, 2025",
  },
  {
    id: "se-metallurgical-biocarbon",
    title: "Metallurgical biocarbon",
    placeId: "sweden",
    placeLabel: "Sweden",
    subjects: ["offtake", "metallurgy", "biocarbon", "phosphorus", "coal"],
    dealTerms: ["metal", "steel", "ferro", "metall", "silicon", "smelter"],
    statement:
      "Swerim’s HåBiMet feasibility study, finished June 2025, found biocarbon can replace fossil coal in metallurgy. Phosphorus in the char is the critical technical problem. EnviGas, LTU, Swerim, Stena and Outokumpu are in a Vinnova project through May 2027 aimed at a price that can meet metallurgical coal.",
    offerLine:
      "Industrial offtake is the Nordic demand that does not depend on a farm subsidy. Qualify fixed carbon and phosphorus before proposing a machinery package.",
    asOf: "2025-06-30",
    source:
      "Vinnova: HåBiMet technical feasibility (completed June 2025) and EnviGas two-stage pyrolysis (June 2024–May 2027)",
  },
  {
    id: "eu-few-furnaces",
    title: "Few delivered furnaces",
    placeId: "europe",
    placeLabel: "Europe",
    subjects: ["supply", "pyrolysis", "furnace", "capacity", "supplier"],
    statement:
      "Sweden Water Research’s Ellinge testbed reports few pyrolysis furnace suppliers, and few units delivered by each. European production cited by the Danish Energy Agency is still a field of smaller plants: more than 170 facilities and about 75,000 tonnes of biochar a year, after capacity rose about 50 percent from 2020 to 2023. On those prices, pyrolysis was not profitable without support.",
    offerLine:
      "References, commissioning, and a heat user are the competitive ground. A capacity headline is not a purchase order.",
    asOf: "2026-06-26",
    source:
      "Sweden Water Research, Testbed Ellinge. Danish Energy Agency pyrolysis strategy, citing European production through 2023",
  },
];

const PLACE_RANK: Record<MarketPlaceId, number> = {
  europe: 0,
  nordics: 1,
  denmark: 2,
  sweden: 2,
  norway: 2,
};

const COUNTRY_PLACES: Record<string, MarketPlaceId[]> = {
  denmark: ["europe", "nordics", "denmark"],
  danmark: ["europe", "nordics", "denmark"],
  sweden: ["europe", "nordics", "sweden"],
  sverige: ["europe", "nordics", "sweden"],
  norway: ["europe", "nordics", "norway"],
  norge: ["europe", "nordics", "norway"],
  finland: ["europe", "nordics"],
  suomi: ["europe", "nordics"],
  iceland: ["europe", "nordics"],
};

const QUERY_PLACE: Array<{ words: string[]; places: MarketPlaceId[] }> = [
  { words: ["denmark", "danish", "danmark"], places: ["denmark"] },
  { words: ["sweden", "swedish", "sverige"], places: ["sweden"] },
  { words: ["norway", "norwegian", "norge"], places: ["norway"] },
  { words: ["nordic", "nordics"], places: ["nordics", "denmark", "sweden", "norway"] },
  {
    words: ["europe", "european"],
    places: ["europe", "nordics", "denmark", "sweden", "norway"],
  },
];

const STOP = new Set([
  "a",
  "an",
  "the",
  "of",
  "on",
  "in",
  "and",
  "or",
  "for",
  "to",
  "from",
  "with",
  "related",
  "about",
  "market",
  "facts",
  "fact",
  "what",
  "is",
  "are",
  "how",
  "treatment",
  "treating",
  "using",
  "use",
]);

export function resolveMarketFacts(
  decisions: Record<string, MarketFactDecision | undefined>,
): ResolvedMarketFact[] {
  return MARKET_FACTS.map((fact) => {
    const decision = decisions[fact.id];
    return decision ? { ...fact, decision } : { ...fact };
  });
}

export function placesForCountry(country: string | null | undefined): MarketPlaceId[] {
  const key = (country ?? "").trim().toLowerCase();
  if (!key) return ["europe"];
  return COUNTRY_PLACES[key] ?? (key ? [] : ["europe"]);
}

export function marketFactsForDeal(
  facts: ResolvedMarketFact[],
  input: { country?: string | null; feedstock?: string | null; industry?: string | null },
): ResolvedMarketFact[] {
  const places = new Set(placesForCountry(input.country));
  if (places.size === 0) return [];
  const hay = `${input.feedstock ?? ""} ${input.industry ?? ""}`.toLowerCase();
  return facts.filter((fact) => {
    if (fact.decision !== "confirmed") return false;
    if (!places.has(fact.placeId)) return false;
    if (!fact.dealTerms?.length) return true;
    return fact.dealTerms.some((term) => hay.includes(term));
  });
}

export type MarketFactSearch = {
  confirmed: ResolvedMarketFact[];
  /** Matched the question but nobody has confirmed them yet. */
  pending: ResolvedMarketFact[];
};

export function searchMarketFacts(
  query: string,
  facts: ResolvedMarketFact[],
): MarketFactSearch {
  const raw = query.toLowerCase().replace(/[^a-z0-9æøå\s-]/g, " ");
  const namedPlaces = new Set<MarketPlaceId>();
  for (const entry of QUERY_PLACE) {
    if (entry.words.some((word) => raw.includes(word))) {
      for (const place of entry.places) namedPlaces.add(place);
    }
  }
  const tokens = raw
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP.has(token))
    .filter(
      (token) => !QUERY_PLACE.some((entry) => entry.words.includes(token)),
    );

  const hits = (fact: ResolvedMarketFact) => {
    if (namedPlaces.size > 0 && !namedPlaces.has(fact.placeId)) return false;
    if (tokens.length === 0) return namedPlaces.size > 0;
    const hay = `${fact.title} ${fact.statement} ${fact.offerLine} ${fact.subjects.join(" ")} ${fact.placeLabel}`.toLowerCase();
    return tokens.every((token) => hay.includes(token));
  };

  const matched = facts.filter(hits);
  return {
    confirmed: matched
      .filter((fact) => fact.decision === "confirmed")
      .sort((a, b) => PLACE_RANK[a.placeId] - PLACE_RANK[b.placeId]),
    pending: matched.filter((fact) => !fact.decision),
  };
}
