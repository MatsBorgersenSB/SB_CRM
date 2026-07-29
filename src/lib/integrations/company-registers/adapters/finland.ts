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

type PrhAddress = {
  street?: string;
  postCode?: string;
  city?: string;
  postOffice?: string;
};

type PrhCompany = {
  businessId?: string;
  name?: string;
  companyForm?: string;
  detailsUri?: string;
  addresses?: PrhAddress[];
  businessLines?: Array<{ code?: string; name?: string }>;
  registeredOffices?: Array<{ city?: string }>;
};

type PrhResponse = {
  results?: PrhCompany[];
};

function mapPrh(row: PrhCompany): UnifiedEuropeanCompany | null {
  const legalName = cleanText(row.name);
  const registrationNumber = cleanText(row.businessId);
  if (!legalName || !registrationNumber) return null;

  const address = row.addresses?.[0];
  const city =
    firstString(address?.city, address?.postOffice, row.registeredOffices?.[0]?.city) ||
    undefined;
  const line = row.businessLines?.[0];

  return emptyCompany({
    legalName,
    registrationNumber,
    vatNumber: `FI${registrationNumber.replace("-", "")}`,
    country: "Finland",
    countryCode: "FI",
    streetAddress: cleanText(address?.street) || undefined,
    postalCode: cleanText(address?.postCode) || undefined,
    city,
    industryCode: cleanText(line?.code) || undefined,
    industryDescription: cleanText(line?.name) || undefined,
    sourceRegistry: "PRH Open Data (FI)",
  });
}

export const finlandAdapter: RegistryAdapter = {
  id: "FI",
  countryCode: "FI",
  sourceRegistry: "PRH Open Data (FI)",
  async search(query: string): Promise<UnifiedEuropeanCompany[]> {
    const q = query.trim();
    if (!q) return [];

    const url =
      `https://avoindata.prh.fi/bis/v1?totalResults=true&maxResults=5&resultsFrom=0&companyName=${encodeURIComponent(q)}`;
    const data = await fetchRegistryJson<PrhResponse>(url);
    const results = data?.results ?? [];
    return results
      .map(mapPrh)
      .filter((row): row is UnifiedEuropeanCompany => Boolean(row));
  },
};
