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

/**
 * OpenRegister / OffeneRegister company search.
 * Docs: https://docs.openregister.de/
 * Requires OPENREGISTER_API_KEY when the public demo is unavailable.
 */

type OpenRegisterCompany = {
  name?: string;
  registration_number?: string;
  register_number?: string;
  register?: string;
  court?: string;
  city?: string;
  address?: {
    street?: string;
    postal_code?: string;
    city?: string;
    country?: string;
  };
  industry?: string;
  nace?: string;
};

type OpenRegisterResponse = {
  results?: OpenRegisterCompany[];
  data?: OpenRegisterCompany[];
  companies?: OpenRegisterCompany[];
};

function mapDe(row: OpenRegisterCompany): UnifiedEuropeanCompany | null {
  const legalName = cleanText(row.name);
  const registrationNumber = firstString(
    row.registration_number,
    row.register_number,
    [row.court, row.register].filter(Boolean).join(" "),
  );
  if (!legalName || !registrationNumber) return null;

  const addr = row.address;
  return emptyCompany({
    legalName,
    registrationNumber,
    country: firstString(addr?.country, "Germany"),
    countryCode: "DE",
    streetAddress: cleanText(addr?.street) || undefined,
    postalCode: cleanText(addr?.postal_code) || undefined,
    city: firstString(addr?.city, row.city) || undefined,
    industryCode: cleanText(row.nace) || undefined,
    industryDescription: cleanText(row.industry) || undefined,
    sourceRegistry: "OffeneRegister (DE)",
  });
}

export const germanyAdapter: RegistryAdapter = {
  id: "DE",
  countryCode: "DE",
  sourceRegistry: "OffeneRegister (DE)",
  async search(query: string): Promise<UnifiedEuropeanCompany[]> {
    const q = query.trim();
    if (!q) return [];

    const apiKey = process.env.OPENREGISTER_API_KEY?.trim();
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
      headers["X-API-Key"] = apiKey;
    }

    const url = `https://api.openregister.de/v1/companies/search?q=${encodeURIComponent(q)}&limit=8`;
    const data = await fetchRegistryJson<OpenRegisterResponse>(url, { headers });
    if (!data) return [];

    const rows = data.results ?? data.data ?? data.companies ?? [];
    return rows
      .map(mapDe)
      .filter((row): row is UnifiedEuropeanCompany => Boolean(row));
  },
};
