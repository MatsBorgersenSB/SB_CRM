import {
  cleanText,
  decodeHtml,
  emptyCompany,
  fetchRegistryJson,
  fetchRegistryText,
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

const COMPANY_LINK_RE = /href="\/company\/([^"]+)"[\s\S]{0,400}?>([\s\S]*?)<\/a>/gi;
const SKIP_LINK_NAME_RE = /^(view company|search result)/i;

function parseCompaniesHouseHtml(html: string): UnifiedEuropeanCompany[] {
  const hits: UnifiedEuropeanCompany[] = [];
  const byNumber = new Map<string, UnifiedEuropeanCompany>();
  COMPANY_LINK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = COMPANY_LINK_RE.exec(html))) {
    const registrationNumber = cleanText(match[1] ?? "").toUpperCase();
    const legalName = decodeHtml(match[2] ?? "");
    if (!legalName || !registrationNumber || SKIP_LINK_NAME_RE.test(legalName)) continue;
    const existing = byNumber.get(registrationNumber);
    if (existing) {
      if (legalName.length > existing.legalName.length) existing.legalName = legalName;
      continue;
    }
    const row = emptyCompany({
      legalName,
      registrationNumber,
      country: "United Kingdom",
      countryCode: "GB",
      sourceRegistry: "Companies House (UK)",
    });
    byNumber.set(registrationNumber, row);
    hits.push(row);
    if (hits.length >= 8) break;
  }
  return hits;
}

async function searchCompaniesHouseApi(query: string): Promise<UnifiedEuropeanCompany[]> {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY?.trim();
  if (!apiKey) return [];

  const auth = Buffer.from(`${apiKey}:`).toString("base64");
  const url = `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(query)}&items_per_page=8`;
  const data = await fetchRegistryJson<ChSearchResponse>(url, {
    headers: { Authorization: `Basic ${auth}` },
  });

  return (data?.items ?? [])
    .map(mapCh)
    .filter((row): row is UnifiedEuropeanCompany => Boolean(row));
}

async function searchCompaniesHouseHtml(query: string): Promise<UnifiedEuropeanCompany[]> {
  const html = await fetchRegistryText(
    `https://find-and-update.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(query)}`,
  );
  if (!html) return [];
  return parseCompaniesHouseHtml(html);
}

/**
 * Companies House search API when COMPANIES_HOUSE_API_KEY is set.
 * Keyless fallback parses the public find-and-update search page.
 */
export const ukAdapter: RegistryAdapter = {
  id: "GB",
  countryCode: "GB",
  sourceRegistry: "Companies House (UK)",
  async search(query: string): Promise<UnifiedEuropeanCompany[]> {
    const q = query.trim();
    if (!q) return [];

    const apiHits = await searchCompaniesHouseApi(q);
    if (apiHits.length > 0) return apiHits;

    return searchCompaniesHouseHtml(q);
  },
};
