import { euViesAdapter, parseEuVatNumber } from "@/lib/integrations/company-registers/adapters/eu-vies";
import { searchGleif } from "@/lib/integrations/company-registers/adapters/gleif";
import {
  cleanText,
  emptyCompany,
  fetchRegistryJson,
  firstString,
} from "@/lib/integrations/company-registers/http";
import type {
  RegistryAdapter,
  UnifiedEuropeanCompany,
} from "@/lib/integrations/company-registers/types";

type KvkAdres = {
  binnenlandsAdres?: {
    straatnaam?: string;
    huisnummer?: string | number;
    postcode?: string;
    plaats?: string;
  };
};

type KvkHit = {
  naam?: string;
  kvkNummer?: string;
  adres?: KvkAdres;
};

type KvkSearchResponse = {
  resultaten?: KvkHit[];
};

function mapKvk(row: KvkHit): UnifiedEuropeanCompany | null {
  const legalName = cleanText(row.naam);
  const registrationNumber = cleanText(row.kvkNummer);
  if (!legalName || !registrationNumber) return null;
  const addr = row.adres?.binnenlandsAdres;
  const street = [addr?.straatnaam, addr?.huisnummer].map(cleanText).filter(Boolean).join(" ");

  return emptyCompany({
    legalName,
    registrationNumber,
    country: "Netherlands",
    countryCode: "NL",
    streetAddress: street || undefined,
    postalCode: cleanText(addr?.postcode) || undefined,
    city: firstString(addr?.plaats) || undefined,
    sourceRegistry: "KVK Handelsregister (NL)",
  });
}

async function searchKvk(query: string): Promise<UnifiedEuropeanCompany[]> {
  const apiKey = process.env.KVK_API_KEY?.trim();
  if (!apiKey) return [];

  const digits = query.replace(/\s/g, "");
  const params = new URLSearchParams({ resultatenPerPagina: "8" });
  if (/^\d{8}$/.test(digits)) params.set("kvkNummer", digits);
  else params.set("naam", query);

  const data = await fetchRegistryJson<KvkSearchResponse>(
    `https://api.kvk.nl/api/v2/zoeken?${params.toString()}`,
    { headers: { apikey: apiKey } },
  );
  return (data?.resultaten ?? [])
    .map(mapKvk)
    .filter((row): row is UnifiedEuropeanCompany => Boolean(row));
}

/**
 * Dutch KVK Zoeken API when KVK_API_KEY is set; otherwise GLEIF + VIES for NL VAT.
 */
export const netherlandsAdapter: RegistryAdapter = {
  id: "NL",
  countryCode: "NL",
  sourceRegistry: "KVK / GLEIF (NL)",
  async search(query: string): Promise<UnifiedEuropeanCompany[]> {
    const q = query.trim();
    if (!q) return [];

    const vat = parseEuVatNumber(q);
    if (vat?.countryCode === "NL") {
      const vies = await euViesAdapter.search(q);
      if (vies.length > 0) return vies;
    }

    const kvk = await searchKvk(q);
    if (kvk.length > 0) return kvk;

    return searchGleif(q, "NL");
  },
};
