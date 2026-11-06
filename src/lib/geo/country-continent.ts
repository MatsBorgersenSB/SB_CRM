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
  dialCode: string;
  aliases?: string[];
};

const COUNTRIES: CountryEntry[] = [
  { name: "Norway", code: "NO", continent: "Europe", dialCode: "+47", aliases: ["norge", "noreg"] },
  { name: "Sweden", code: "SE", continent: "Europe", dialCode: "+46", aliases: ["sverige"] },
  { name: "Denmark", code: "DK", continent: "Europe", dialCode: "+45", aliases: ["danmark"] },
  { name: "Finland", code: "FI", continent: "Europe", dialCode: "+358", aliases: ["suomi"] },
  { name: "Iceland", code: "IS", continent: "Europe", dialCode: "+354", aliases: ["island"] },
  { name: "Germany", code: "DE", continent: "Europe", dialCode: "+49", aliases: ["deutschland"] },
  { name: "France", code: "FR", continent: "Europe", dialCode: "+33" },
  { name: "Spain", code: "ES", continent: "Europe", dialCode: "+34", aliases: ["españa", "espana"] },
  { name: "Portugal", code: "PT", continent: "Europe", dialCode: "+351" },
  { name: "Italy", code: "IT", continent: "Europe", dialCode: "+39", aliases: ["italia"] },
  { name: "Netherlands", code: "NL", continent: "Europe", dialCode: "+31", aliases: ["holland", "the netherlands"] },
  { name: "Belgium", code: "BE", continent: "Europe", dialCode: "+32" },
  { name: "Austria", code: "AT", continent: "Europe", dialCode: "+43", aliases: ["österreich", "osterreich"] },
  { name: "Switzerland", code: "CH", continent: "Europe", dialCode: "+41", aliases: ["schweiz", "suisse", "svizzera"] },
  { name: "Poland", code: "PL", continent: "Europe", dialCode: "+48", aliases: ["polska"] },
  { name: "Ireland", code: "IE", continent: "Europe", dialCode: "+353" },
  {
    name: "United Kingdom",
    code: "GB",
    continent: "Europe",
    dialCode: "+44",
    aliases: ["uk", "great britain", "england", "scotland", "wales"],
  },
  {
    name: "United States",
    code: "US",
    continent: "North America",
    dialCode: "+1",
    aliases: ["usa", "united states of america", "u.s.", "u.s.a."],
  },
  { name: "Canada", code: "CA", continent: "North America", dialCode: "+1" },
  { name: "Brazil", code: "BR", continent: "South America", dialCode: "+55", aliases: ["brasil"] },
  { name: "Australia", code: "AU", continent: "Oceania", dialCode: "+61" },
  { name: "New Zealand", code: "NZ", continent: "Oceania", dialCode: "+64" },
  { name: "Japan", code: "JP", continent: "Asia", dialCode: "+81" },
  { name: "China", code: "CN", continent: "Asia", dialCode: "+86" },
  { name: "India", code: "IN", continent: "Asia", dialCode: "+91" },
  { name: "Sri Lanka", code: "LK", continent: "Asia", dialCode: "+94" },
  { name: "Bangladesh", code: "BD", continent: "Asia", dialCode: "+880" },
  { name: "Romania", code: "RO", continent: "Europe", dialCode: "+40", aliases: ["românia", "romania"] },
  { name: "South Africa", code: "ZA", continent: "Africa", dialCode: "+27" },
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
  lk: "LK",
  bd: "BD",
  ro: "RO",
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
  dialCode: string;
};

/** Sorted catalog for country dropdowns. */
export function listCountries(): CountryOption[] {
  return [...COUNTRIES]
    .map(({ name, code, continent, dialCode }) => ({
      name,
      code,
      continent,
      dialCode,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Resolve a catalog entry from ISO code or free-text country label. */
export function findCountryEntry(input: string): CountryOption | null {
  const resolved = resolveCountry(input);
  if (!resolved) return null;
  const entry = byCode.get(resolved.code);
  if (!entry) return null;
  return {
    name: entry.name,
    code: entry.code,
    continent: entry.continent,
    dialCode: entry.dialCode,
  };
}

/** Resolve international calling code (e.g. "+47") from country name or ISO code. */
export function getDialCodeForCountry(input?: string | null): string {
  if (!input?.trim()) return "";
  return findCountryEntry(input.trim())?.dialCode ?? "";
}

/**
 * Infer default international calling code from known country, domain, email, or company phone.
 * Defaults to "+47" (Norway) when no country signal is present yet.
 */
export function inferPhoneDialCode(context?: {
  countryCode?: string | null;
  country?: string | null;
  domain?: string | null;
  email?: string | null;
  companyPhone?: string | null;
}): string {
  if (context?.countryCode?.trim()) {
    const byIso = getDialCodeForCountry(context.countryCode);
    if (byIso) return byIso;
  }
  if (context?.country?.trim()) {
    const byName = getDialCodeForCountry(context.country);
    if (byName) return byName;
  }
  if (context?.email?.includes("@")) {
    const emailDomain = context.email.split("@")[1]?.trim() ?? "";
    const inferredIso = inferCountryCodeFromDomain(emailDomain);
    if (inferredIso) {
      const byEmail = getDialCodeForCountry(inferredIso);
      if (byEmail) return byEmail;
    }
  }
  if (context?.domain?.trim()) {
    const inferredIso = inferCountryCodeFromDomain(context.domain);
    if (inferredIso) {
      const byDomain = getDialCodeForCountry(inferredIso);
      if (byDomain) return byDomain;
    }
  }
  if (context?.companyPhone?.trim()) {
    const match = context.companyPhone.trim().match(/^(\+\d{1,3})\b/);
    if (match?.[1]) return match[1];
  }
  return "+47";
}
