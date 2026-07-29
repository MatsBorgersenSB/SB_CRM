import {
  cleanText,
  emptyCompany,
  fetchRegistryJson,
} from "@/lib/integrations/company-registers/http";
import type {
  RegistryAdapter,
  UnifiedEuropeanCompany,
} from "@/lib/integrations/company-registers/types";

/** cvrapi.dk open CVR search (no auth required for light lookups). */
type CvrApiResult = {
  vat?: number | string;
  name?: string;
  address?: string;
  zipcode?: number | string;
  city?: string;
  industrycode?: number | string;
  industrydesc?: string;
  owners?: Array<{ name?: string }>;
  error?: string;
};

function mapCvr(row: CvrApiResult): UnifiedEuropeanCompany | null {
  const legalName = cleanText(row.name);
  const registrationNumber = cleanText(String(row.vat ?? ""));
  if (!legalName || !registrationNumber) return null;

  return emptyCompany({
    legalName,
    registrationNumber,
    vatNumber: `DK${registrationNumber}`,
    country: "Denmark",
    countryCode: "DK",
    streetAddress: cleanText(row.address) || undefined,
    postalCode: cleanText(String(row.zipcode ?? "")) || undefined,
    city: cleanText(row.city) || undefined,
    industryCode: cleanText(String(row.industrycode ?? "")) || undefined,
    industryDescription: cleanText(row.industrydesc) || undefined,
    executives: (row.owners ?? [])
      .map((owner) => cleanText(owner.name))
      .filter(Boolean),
    sourceRegistry: "CVR / Erhvervsstyrelsen (DK)",
  });
}

export const denmarkAdapter: RegistryAdapter = {
  id: "DK",
  countryCode: "DK",
  sourceRegistry: "CVR / Erhvervsstyrelsen (DK)",
  async search(query: string): Promise<UnifiedEuropeanCompany[]> {
    const q = query.trim();
    if (!q) return [];

    const url = `https://cvrapi.dk/api?search=${encodeURIComponent(q)}&country=dk`;
    const data = await fetchRegistryJson<CvrApiResult | CvrApiResult[]>(url, {
      headers: {
        // cvrapi asks for an identifying User-Agent
        "User-Agent": "SmartCRM-StandardBio/1.0 (mats.borgersen@standard.bio)",
      },
    });
    if (!data || (typeof data === "object" && "error" in data && data.error)) {
      return [];
    }

    const rows = Array.isArray(data) ? data : [data];
    return rows
      .map(mapCvr)
      .filter((row): row is UnifiedEuropeanCompany => Boolean(row))
      .slice(0, 8);
  },
};
