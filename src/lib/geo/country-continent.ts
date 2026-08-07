/** Country / continent geo helpers for discovery and company registry. */

export type Continent =
  | "Africa"
  | "Asia"
  | "Europe"
  | "North America"
  | "South America"
  | "Oceania"
  | "Antarctica"
  | "";

type CountryEntry = {
  name: string;
  code: string;
  continent: Exclude<Continent, "">;
  aliases?: string[];
};

const COUNTRIES: CountryEntry[] = [
  { name: "Norway", code: "NO", continent: "Europe", aliases: ["norge", "noreg"] },
  { name: "Sweden", code: "SE", continent: "Europe", aliases: ["sverige"] },
  { name: "Denmark", code: "DK", continent: "Europe", aliases: ["danmark"] },
  { name: "Finland", code: "FI", continent: "Europe", aliases: ["suomi"] },
  { name: "Iceland", code: "IS", continent: "Europe", aliases: ["island"] },
  { name: "Germany", code: "DE", continent: "Europe", aliases: ["deutschland"] },
  { name: "France", code: "FR", continent: "Europe" },
  { name: "Spain", code: "ES", continent: "Europe", aliases: ["españa", "espana"] },
  { name: "Portugal", code: "PT", continent: "Europe" },
  { name: "Italy", code: "IT", continent: "Europe", aliases: ["italia"] },
  { name: "Netherlands", code: "NL", continent: "Europe", aliases: ["holland", "the netherlands"] },
  { name: "Belgium", code: "BE", continent: "Europe" },
  { name: "Austria", code: "AT", continent: "Europe", aliases: ["österreich", "osterreich"] },
  { name: "Switzerland", code: "CH", continent: "Europe", aliases: ["schweiz", "suisse", "svizzera"] },
  { name: "Poland", code: "PL", continent: "Europe", aliases: ["polska"] },
  { name: "Ireland", code: "IE", continent: "Europe" },
  {
    name: "United Kingdom",
    code: "GB",
    continent: "Europe",
    aliases: ["uk", "great britain", "england", "scotland", "wales"],
  },
  {
    name: "United States",
    code: "US",
    continent: "North America",
    aliases: ["usa", "united states of america", "u.s.", "u.s.a."],
  },
  { name: "Canada", code: "CA", continent: "North America" },
  { name: "Brazil", code: "BR", continent: "South America", aliases: ["brasil"] },
  { name: "Australia", code: "AU", continent: "Oceania" },
  { name: "New Zealand", code: "NZ", continent: "Oceania" },
  { name: "Japan", code: "JP", continent: "Asia" },
  { name: "China", code: "CN", continent: "Asia" },
  { name: "India", code: "IN", continent: "Asia" },
  { name: "South Africa", code: "ZA", continent: "Africa" },
];

const TLD_TO_COUNTRY: Record<string, string> = {
  no: "NO",
  se: "SE",
  dk: "DK",
  fi: "FI",
  is: "IS",
  de: "DE",
  fr: "FR",
  es: "ES",
  pt: "PT",
  it: "IT",
  nl: "NL",
  be: "BE",
  at: "AT",
  ch: "CH",
  pl: "PL",
  ie: "IE",
  uk: "GB",
  us: "US",
  ca: "CA",
  br: "BR",
  au: "AU",
  nz: "NZ",
  jp: "JP",
  in: "IN",
  za: "ZA",
};

const byCode = new Map(COUNTRIES.map((entry) => [entry.code, entry]));

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Resolve continent from an ISO 3166-1 alpha-2 country code. */
export function getContinentByCountryCode(countryCode: string): Continent {
  const code = countryCode.trim().toUpperCase();
  if (!code) return "";
  return byCode.get(code)?.continent ?? "";
}

/** Resolve canonical country name + ISO code from a free-text country label or code. */
export function resolveCountry(input: string): { name: string; code: string } | null {
  const raw = input.trim();
  if (!raw) return null;

  if (/^[A-Za-z]{2}$/.test(raw)) {
    const entry = byCode.get(raw.toUpperCase());
    if (entry) return { name: entry.name, code: entry.code };
  }

  const key = normalizeKey(raw);
  for (const entry of COUNTRIES) {
    if (normalizeKey(entry.name) === key) return { name: entry.name, code: entry.code };
    if (entry.aliases?.some((alias) => normalizeKey(alias) === key)) {
      return { name: entry.name, code: entry.code };
    }
  }

  return null;
}

/** Infer country from a hostname / domain TLD when address text has no country. */
export function inferCountryCodeFromDomain(domainOrUrl: string): string {
  const host = domainOrUrl
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    ?.replace(/^www\./, "");
  if (!host) return "";
  const parts = host.split(".").filter(Boolean);
  const tld = parts[parts.length - 1] ?? "";
  return TLD_TO_COUNTRY[tld] ?? "";
}

export function countryNameFromCode(countryCode: string): string {
  return byCode.get(countryCode.trim().toUpperCase())?.name ?? "";
}

export type CountryOption = {
  name: string;
  code: string;
  continent: Exclude<Continent, "">;
};

/** Sorted catalog for country dropdowns. */
export function listCountries(): CountryOption[] {
  return [...COUNTRIES]
    .map(({ name, code, continent }) => ({ name, code, continent }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Resolve a catalog entry from ISO code or free-text country label. */
export function findCountryEntry(input: string): CountryOption | null {
  const resolved = resolveCountry(input);
  if (!resolved) return null;
  const entry = byCode.get(resolved.code);
  if (!entry) return null;
  return { name: entry.name, code: entry.code, continent: entry.continent };
}
