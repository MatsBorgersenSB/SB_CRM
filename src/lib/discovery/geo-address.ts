import {
  countryNameFromCode,
  getContinentByCountryCode,
  inferCountryCodeFromDomain,
  resolveCountry,
  type Continent,
} from "@/lib/geo/country-continent";

export type StructuredGeoAddress = {
  streetAddress: string;
  postalCode: string;
  city: string;
  stateRegion: string;
  country: string;
  countryCode: string;
  continent: Continent | string;
};

const EMPTY_GEO: StructuredGeoAddress = {
  streetAddress: "",
  postalCode: "",
  city: "",
  stateRegion: "",
  country: "",
  countryCode: "",
  continent: "",
};

const POSTAL_COUNTRY_PREFIX_MAP: Record<string, string> = {
  D: "DE",
  DE: "DE",
  A: "AT",
  AT: "AT",
  CH: "CH",
  N: "NO",
  NO: "NO",
  S: "SE",
  SE: "SE",
  DK: "DK",
  FI: "FI",
  F: "FR",
  FR: "FR",
  NL: "NL",
  B: "BE",
  BE: "BE",
  I: "IT",
  IT: "IT",
  E: "ES",
  ES: "ES",
  PT: "PT",
  PL: "PL",
};

const US_STATE_ZIP = /\b([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\b/;
const DUTCH_POSTAL_CITY = /\b(\d{4}\s?[A-Z]{2})\s+([A-ZÀ-Ÿ][A-Za-zÀ-ÿ\s.-]{1,})\b/;
const POLISH_POSTAL_CITY = /\b(\d{2}-\d{3})\s+([A-ZÀ-Ÿ][A-Za-zÀ-ÿ\s.-]{1,})\b/;
const SWEDISH_POSTAL_CITY =
  /(?:\b(SE|S)-)?\b(\d{3}\s\d{2})\s+([A-ZÀ-Ÿ][A-Za-zÀ-ÿ\s.-]{1,})\b/;
const EUROPEAN_POSTAL_CITY =
  /(?:\b(DE|AT|CH|NO|SE|DK|FI|FR|BE|NL|IT|ES|PT|PL|D|A|N|S|F|B|I|E)-)?\b(\d{4,6})\s+([A-ZÀ-Ÿ][A-Za-zÀ-ÿ\s.-]{1,})\b/;

function cleanCitySegment(value: string): string {
  return value
    .split(/[|/]/)
    .map((part) => part.trim())
    .find(Boolean)
    ?.replace(/[,;.-]+$/, "")
    .trim() ?? "";
}

function matchPostalAndCity(input: string): {
  index: number;
  postalCode: string;
  city: string;
  stateRegion: string;
  countryCode: string;
} | null {
  const us = input.match(US_STATE_ZIP);
  if (us?.[1] && us[2] && typeof us.index === "number") {
    return {
      index: us.index,
      postalCode: us[2],
      city: "",
      stateRegion: us[1],
      countryCode: "US",
    };
  }

  const nl = input.match(DUTCH_POSTAL_CITY);
  if (nl?.[1] && nl[2] && typeof nl.index === "number") {
    return {
      index: nl.index,
      postalCode: nl[1].replace(/\s+/, " ").trim(),
      city: cleanCitySegment(nl[2]),
      stateRegion: "",
      countryCode: "NL",
    };
  }

  const pl = input.match(POLISH_POSTAL_CITY);
  if (pl?.[1] && pl[2] && typeof pl.index === "number") {
    return {
      index: pl.index,
      postalCode: pl[1],
      city: cleanCitySegment(pl[2]),
      stateRegion: "",
      countryCode: "PL",
    };
  }

  const se = input.match(SWEDISH_POSTAL_CITY);
  if (se?.[2] && se[3] && typeof se.index === "number") {
    const prefix = se[1] ? POSTAL_COUNTRY_PREFIX_MAP[se[1].toUpperCase()] ?? "" : "";
    return {
      index: se.index,
      postalCode: se[2],
      city: cleanCitySegment(se[3]),
      stateRegion: "",
      countryCode: prefix || "SE",
    };
  }

  const eu = input.match(EUROPEAN_POSTAL_CITY);
  if (eu?.[2] && eu[3] && typeof eu.index === "number") {
    const prefix = eu[1] ? POSTAL_COUNTRY_PREFIX_MAP[eu[1].toUpperCase()] ?? "" : "";
    return {
      index: eu.index,
      postalCode: eu[2],
      city: cleanCitySegment(eu[3]),
      stateRegion: "",
      countryCode: prefix,
    };
  }

  return null;
}

function applyCountryFields(
  geo: StructuredGeoAddress,
  countryInput: string,
): StructuredGeoAddress {
  const resolved = resolveCountry(countryInput);
  if (!resolved) {
    return {
      ...geo,
      country: countryInput.trim() || geo.country,
    };
  }
  return {
    ...geo,
    country: resolved.name,
    countryCode: resolved.code,
    continent: getContinentByCountryCode(resolved.code),
  };
}

function finalizeGeo(
  partial: Partial<StructuredGeoAddress>,
  domainHint = "",
): StructuredGeoAddress {
  let geo: StructuredGeoAddress = {
    ...EMPTY_GEO,
    ...partial,
    streetAddress: (partial.streetAddress ?? "").trim(),
    postalCode: (partial.postalCode ?? "").trim(),
    city: (partial.city ?? "").trim(),
    stateRegion: (partial.stateRegion ?? "").trim(),
    country: (partial.country ?? "").trim(),
    countryCode: (partial.countryCode ?? "").trim().toUpperCase(),
    continent: (partial.continent ?? "").trim(),
  };

  if (geo.country && !geo.countryCode) {
    geo = applyCountryFields(geo, geo.country);
  } else if (geo.countryCode && !geo.country) {
    geo.country = countryNameFromCode(geo.countryCode);
  }

  if (geo.countryCode && !geo.continent) {
    geo.continent = getContinentByCountryCode(geo.countryCode);
  }

  if (!geo.countryCode && domainHint) {
    const fromTld = inferCountryCodeFromDomain(domainHint);
    if (fromTld) {
      geo = applyCountryFields(geo, fromTld);
    }
  }

  // Norwegian-style 4-digit postal + city with no country and no country-code TLD → Norway
  if (!geo.countryCode && geo.postalCode && /^\d{4}$/.test(geo.postalCode) && geo.city) {
    geo = applyCountryFields(geo, "Norway");
  }

  return geo;
}

/** Parse a free-text / single-line company address into structured geo fields. */
export function parseStructuredGeoAddress(
  address: string,
  domainHint = "",
): StructuredGeoAddress {
  const raw = address.trim();
  if (!raw) return finalizeGeo({}, domainHint);

  const lines = raw
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean);

  let streetAddress = "";
  let postalCode = "";
  let city = "";
  let stateRegion = "";
  let country = "";
  let countryCode = "";

  const remaining = [...lines];

  if (remaining.length > 0) {
    const maybeCountry = resolveCountry(remaining[remaining.length - 1]!);
    if (maybeCountry) {
      country = maybeCountry.name;
      countryCode = maybeCountry.code;
      remaining.pop();
    }
  }

  if (remaining.length > 0) {
    const last = remaining[remaining.length - 1]!;
    const matched = matchPostalAndCity(last);
    if (matched) {
      postalCode = matched.postalCode;
      city = matched.city;
      stateRegion = matched.stateRegion;
      countryCode = countryCode || matched.countryCode;
      const before = last.slice(0, matched.index).replace(/[,;\s-]+$/, "").trim();
      remaining.pop();
      if (before) {
        remaining.push(before);
      }
    }
  }

  // Also try full string for postal/city when split lines didn't isolate it
  if (!postalCode || (!city && !stateRegion)) {
    const fullMatch = matchPostalAndCity(raw);
    if (fullMatch) {
      postalCode = postalCode || fullMatch.postalCode;
      city = city || fullMatch.city;
      stateRegion = stateRegion || fullMatch.stateRegion;
      countryCode = countryCode || fullMatch.countryCode;
      if (remaining.length === 1 && fullMatch.index > 0) {
        const before = raw.slice(0, fullMatch.index).replace(/[,;\s-]+$/, "").trim();
        if (before) {
          remaining[0] = before;
        }
      }
    }
  }

  streetAddress = remaining.join(", ").trim();
  if (!streetAddress) {
    const fullMatch = matchPostalAndCity(raw);
    if (fullMatch && fullMatch.index > 0) {
      streetAddress = raw.slice(0, fullMatch.index).replace(/[,;\s-]+$/, "").trim();
    }
  }

  // Normalize house-number-first streets: "5 Industrivegen" stays as-is (already correct).
  // Also accept "Industrivegen 5" unchanged.
  streetAddress = streetAddress.replace(/^,+|,+$/g, "").trim();

  return finalizeGeo(
    { streetAddress, postalCode, city, stateRegion, country, countryCode },
    domainHint,
  );
}

function readJsonLdString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object" && "name" in value) {
    const name = (value as { name?: unknown }).name;
    if (typeof name === "string") return name.trim();
  }
  return "";
}

/** Map schema.org PostalAddress (or nested address object) into structured geo. */
export function geoFromJsonLdPostalAddress(
  addressNode: Record<string, unknown>,
  domainHint = "",
): StructuredGeoAddress {
  const streetAddress = readJsonLdString(
    addressNode.streetAddress ?? addressNode.street_address,
  );
  const postalCode = readJsonLdString(addressNode.postalCode ?? addressNode.postal_code);
  const city = readJsonLdString(
    addressNode.addressLocality ?? addressNode.address_locality ?? addressNode.city,
  );
  const stateRegion = readJsonLdString(
    addressNode.addressRegion ?? addressNode.address_region ?? addressNode.region,
  );
  const countryRaw = readJsonLdString(
    addressNode.addressCountry ?? addressNode.address_country ?? addressNode.country,
  );

  return finalizeGeo(
    { streetAddress, postalCode, city, stateRegion, country: countryRaw },
    domainHint,
  );
}

export function hasStructuredGeo(geo: StructuredGeoAddress): boolean {
  return Boolean(
    geo.streetAddress ||
      geo.postalCode ||
      geo.city ||
      geo.stateRegion ||
      geo.country ||
      geo.countryCode,
  );
}

export function formatStructuredGeoLine(geo: StructuredGeoAddress): string {
  const parts = [
    geo.streetAddress,
    [geo.postalCode, geo.city].filter(Boolean).join(" "),
    geo.stateRegion,
    geo.country || geo.countryCode,
  ].filter(Boolean);
  return parts.join(", ");
}

export function emptyStructuredGeo(): StructuredGeoAddress {
  return { ...EMPTY_GEO };
}

/** Fill countryCode / continent from country (or TLD) without wiping existing fields. */
export function enrichStructuredGeo(
  partial: Partial<StructuredGeoAddress>,
  domainHint = "",
): StructuredGeoAddress {
  return finalizeGeo(partial, domainHint);
}
