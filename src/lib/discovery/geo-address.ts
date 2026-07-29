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

const NORWEGIAN_POSTAL_CITY = /\b(\d{4})\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s-]{1,})\b/;
const US_STATE_ZIP = /\b([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\b/;
const GENERIC_POSTAL_CITY = /\b(\d{4,6})\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.-]{1,})\b/;

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

  // Norwegian-style postal + city with no country → Norway
  if (!geo.countryCode && geo.postalCode && /^\d{4}$/.test(geo.postalCode) && geo.city) {
    geo = applyCountryFields(geo, "Norway");
  }

  if (!geo.countryCode && domainHint) {
    const fromTld = inferCountryCodeFromDomain(domainHint);
    if (fromTld) {
      geo = applyCountryFields(geo, fromTld);
    }
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

  const remaining = [...lines];

  if (remaining.length > 0) {
    const maybeCountry = resolveCountry(remaining[remaining.length - 1]!);
    if (maybeCountry) {
      country = maybeCountry.name;
      remaining.pop();
    }
  }

  if (remaining.length > 0) {
    const last = remaining[remaining.length - 1]!;
    const usMatch = last.match(US_STATE_ZIP);
    const noMatch = last.match(NORWEGIAN_POSTAL_CITY) ?? last.match(GENERIC_POSTAL_CITY);
    if (usMatch?.[1] && usMatch[2]) {
      stateRegion = usMatch[1];
      postalCode = usMatch[2];
      remaining.pop();
    } else if (noMatch?.[1] && noMatch[2]) {
      postalCode = noMatch[1];
      city = noMatch[2].trim();
      remaining.pop();
    }
  }

  // "Street 12, 6000 Ålesund" already split — also try full string for postal/city
  if (!postalCode || !city) {
    const fullMatch =
      raw.match(NORWEGIAN_POSTAL_CITY) ?? raw.match(GENERIC_POSTAL_CITY) ?? raw.match(US_STATE_ZIP);
    if (fullMatch) {
      if (fullMatch[0].match(US_STATE_ZIP) && fullMatch[1] && fullMatch[2]) {
        stateRegion = stateRegion || fullMatch[1];
        postalCode = postalCode || fullMatch[2];
      } else if (fullMatch[1] && fullMatch[2]) {
        postalCode = postalCode || fullMatch[1];
        city = city || fullMatch[2].trim();
      }
    }
  }

  streetAddress = remaining.join(", ").trim();
  if (!streetAddress) {
    // Drop trailing postal/city/country from the raw string for street
    streetAddress = raw
      .replace(NORWEGIAN_POSTAL_CITY, "")
      .replace(GENERIC_POSTAL_CITY, "")
      .replace(US_STATE_ZIP, "")
      .replace(/,?\s*(Norway|Norge|Sweden|Denmark|Finland)\s*$/i, "")
      .replace(/,\s*$/, "")
      .trim();
  }

  return finalizeGeo(
    { streetAddress, postalCode, city, stateRegion, country },
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
