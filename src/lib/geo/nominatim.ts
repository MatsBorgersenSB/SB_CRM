import { getContinentByCountryCode } from "@/lib/geo/continent-mapper";

export type OsmLookupResult = {
  streetAddress: string;
  postalCode: string;
  city: string;
  stateRegion: string;
  country: string;
  countryCode: string;
  continent: string;
};

const USER_AGENT = "SmartCRM-StandardBio/1.0 (mats.borgersen@standard.bio)";

function pickCity(address: Record<string, unknown> | undefined): string {
  const candidates = [
    address?.city,
    address?.town,
    address?.village,
    address?.hamlet,
    address?.municipality,
    address?.county,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return "";
}

function pickStateRegion(address: Record<string, unknown> | undefined): string {
  const candidates = [
    address?.state,
    address?.region,
    address?.province,
    address?.county,
    address?.state_district,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return "";
}

function pickStreetAddress(address: Record<string, unknown> | undefined): string {
  const house = typeof address?.house_number === "string" ? address.house_number.trim() : "";
  const road = typeof address?.road === "string" ? address.road.trim() : "";
  const suburb = typeof address?.suburb === "string" ? address.suburb.trim() : "";
  if (road && house) return `${house} ${road}`.trim();
  if (road && suburb) return `${suburb}, ${road}`.trim();
  if (road) return road;
  return typeof address?.display_name === "string" ? address.display_name.trim() : "";
}

export async function lookupAddressOSM(
  query: string,
  options?: { timeoutMs?: number },
): Promise<OsmLookupResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      streetAddress: "",
      postalCode: "",
      city: "",
      stateRegion: "",
      country: "",
      countryCode: "",
      continent: "Other",
    };
  }

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&addressdetails=1&limit=1`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? 6_000);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
      },
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Nominatim lookup failed: ${response.status}`);
  }

  const data = (await response.json()) as unknown;
  const first = Array.isArray(data) ? data[0] : undefined;
  const firstRecord =
    first && typeof first === "object" ? (first as { address?: unknown }) : undefined;
  const address =
    firstRecord?.address && typeof firstRecord.address === "object"
      ? (firstRecord.address as Record<string, unknown>)
      : undefined;

  const countryCodeRaw =
    address && typeof address.country_code === "string" ? address.country_code : "";
  const countryCode = String(countryCodeRaw || "").trim().toUpperCase();
  const continent = getContinentByCountryCode(countryCode);

  return {
    streetAddress: pickStreetAddress(address),
    postalCode:
      address && typeof address.postcode === "string" ? address.postcode.trim() : "",
    city: pickCity(address),
    stateRegion: pickStateRegion(address),
    country: address && typeof address.country === "string" ? address.country.trim() : "",
    countryCode,
    continent,
  };
}

