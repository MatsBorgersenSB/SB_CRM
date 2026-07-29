import {
  cleanText,
  emptyCompany,
  fetchRegistryJson,
} from "@/lib/integrations/company-registers/http";
import type {
  RegistryAdapter,
  UnifiedEuropeanCompany,
} from "@/lib/integrations/company-registers/types";

type ChItem = {
  company_number?: string;
  title?: string;
  company_status?: string;
  address?: {
    address_line_1?: string;
    address_line_2?: string;
    locality?: string;
    postal_code?: string;
    country?: string;
  };
  date_of_creation?: string;
};

type ChSearchResponse = {
  items?: ChItem[];
};

function mapCh(item: ChItem): UnifiedEuropeanCompany | null {
  const legalName = cleanText(item.title);
  const registrationNumber = cleanText(item.company_number);
  if (!legalName || !registrationNumber) return null;

  const addr = item.address;
  const street = [addr?.address_line_1, addr?.address_line_2]
    .map(cleanText)
    .filter(Boolean)
    .join(", ");

  return emptyCompany({
    legalName,
    registrationNumber,
    country: cleanText(addr?.country) || "United Kingdom",
    countryCode: "GB",
    streetAddress: street || undefined,
    postalCode: cleanText(addr?.postal_code) || undefined,
    city: cleanText(addr?.locality) || undefined,
    sourceRegistry: "Companies House (UK)",
  });
}

/**
 * Companies House search API.
 * Requires COMPANIES_HOUSE_API_KEY (HTTP Basic with key as username).
 * Returns [] when key is missing or the API errors.
 */
export const ukAdapter: RegistryAdapter = {
  id: "GB",
  countryCode: "GB",
  sourceRegistry: "Companies House (UK)",
  async search(query: string): Promise<UnifiedEuropeanCompany[]> {
    const q = query.trim();
    if (!q) return [];

    const apiKey = process.env.COMPANIES_HOUSE_API_KEY?.trim();
    if (!apiKey) return [];

    const auth = Buffer.from(`${apiKey}:`).toString("base64");
    const url = `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(q)}&items_per_page=8`;
    const data = await fetchRegistryJson<ChSearchResponse>(url, {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    return (data?.items ?? [])
      .map(mapCh)
      .filter((row): row is UnifiedEuropeanCompany => Boolean(row));
  },
};
