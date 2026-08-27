import {
  foldRegistryName,
  stripLegalForm,
} from "@/lib/integrations/company-registers/legal-form";
import {
  cleanText,
  emptyCompany,
  fetchRegistryJson,
  firstString,
} from "@/lib/integrations/company-registers/http";
import type { UnifiedEuropeanCompany } from "@/lib/integrations/company-registers/types";

const COUNTRY_NAMES: Record<string, string> = {
  AT: "Austria",
  BE: "Belgium",
  CH: "Switzerland",
  DE: "Germany",
  ES: "Spain",
  GB: "United Kingdom",
  IT: "Italy",
  LU: "Luxembourg",
  NL: "Netherlands",
  PT: "Portugal",
};

type GleifName = { name?: string };
type GleifAddress = {
  addressLines?: string[];
  city?: string;
  country?: string;
  postalCode?: string;
};
type GleifRecord = {
  attributes?: {
    lei?: string;
    entity?: {
      legalName?: GleifName;
      legalAddress?: GleifAddress;
      registeredAs?: string;
      status?: string;
    };
  };
};
type GleifResponse = { data?: GleifRecord[] };

function mapGleif(
  row: GleifRecord,
  expectedCountry: string,
): UnifiedEuropeanCompany | null {
  const entity = row.attributes?.entity;
  const legalName = firstString(entity?.legalName?.name);
  const registrationNumber = firstString(
    entity?.registeredAs,
    row.attributes?.lei,
  );
  const countryCode = (entity?.legalAddress?.country ?? "").toUpperCase();
  if (!legalName || !registrationNumber) return null;
  if (countryCode && countryCode !== expectedCountry) return null;
  if (entity?.status && entity.status !== "ACTIVE") return null;

  const addr = entity?.legalAddress;
  const street = (addr?.addressLines ?? []).map(cleanText).filter(Boolean).join(", ");

  return emptyCompany({
    legalName,
    registrationNumber,
    country: COUNTRY_NAMES[expectedCountry] ?? expectedCountry,
    countryCode: expectedCountry,
    streetAddress: street || undefined,
    postalCode: cleanText(addr?.postalCode) || undefined,
    city: cleanText(addr?.city) || undefined,
    sourceRegistry: `GLEIF LEI (${expectedCountry})`,
  });
}

function nameRelevant(legalName: string, query: string): boolean {
  const n = foldRegistryName(legalName);
  const distinctive = foldRegistryName(stripLegalForm(query) || query);
  if (!distinctive || distinctive.length < 2) return false;
  return n.includes(distinctive);
}

async function queryGleif(
  params: URLSearchParams,
  country: string,
  query: string,
): Promise<UnifiedEuropeanCompany[]> {
  const data = await fetchRegistryJson<GleifResponse>(
    `https://api.gleif.org/api/v1/lei-records?${params.toString()}`,
    { headers: { Accept: "application/vnd.api+json, application/json" } },
  );
  return (data?.data ?? [])
    .map((row) => mapGleif(row, country))
    .filter((row): row is UnifiedEuropeanCompany => Boolean(row))
    .filter((row) => nameRelevant(row.legalName, query));
}

/**
 * GLEIF legal-entity search (no API key). Covers companies that hold an LEI.
 * Prefers legal-name prefix match so fulltext noise is not treated as a hit.
 */
export async function searchGleif(
  query: string,
  countryCode: string,
): Promise<UnifiedEuropeanCompany[]> {
  const q = query.trim();
  const country = countryCode.toUpperCase();
  if (!q || q.length < 2) return [];

  const term = stripLegalForm(q) || q;
  const prefix = new URLSearchParams({
    "filter[entity.legalName]": `${term}*`,
    "filter[entity.legalAddress.country]": country,
    "filter[entity.status]": "ACTIVE",
    "page[size]": "8",
  });
  const prefixed = await queryGleif(prefix, country, q);
  if (prefixed.length > 0) return prefixed;

  const fulltext = new URLSearchParams({
    "filter[fulltext]": term,
    "filter[entity.legalAddress.country]": country,
    "filter[entity.status]": "ACTIVE",
    "page[size]": "8",
  });
  return queryGleif(fulltext, country, q);
}
