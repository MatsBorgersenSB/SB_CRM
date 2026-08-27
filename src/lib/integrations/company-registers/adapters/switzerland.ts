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

type ZefixFirm = {
  name?: string;
  uid?: string;
  uidFormatted?: string;
  legalSeat?: string;
  legalSeatFormatted?: string;
  status?: string;
  address?: { city?: string; swissZipCode?: string; street?: string };
};

type ZefixSearchResponse = {
  list?: ZefixFirm[];
};

function formatSwissUid(digits: string): string {
  const compact = digits.replace(/\D/g, "");
  if (compact.length !== 9) return digits;
  return `CHE-${compact.slice(0, 3)}.${compact.slice(3, 6)}.${compact.slice(6)}`;
}

/** Swiss UID: CHE-123.456.789 (optional MWST/TVA/IVA). */
export function parseSwissUid(query: string): string | null {
  const compact = query.replace(/[\s.]/g, "").toUpperCase();
  const match = compact.match(/^CHE(\d{9})(?:MWST|TVA|IVA)?$/);
  if (!match?.[1]) return null;
  return formatSwissUid(match[1]);
}

function mapZefix(row: ZefixFirm): UnifiedEuropeanCompany | null {
  const legalName = cleanText(row.name);
  const registrationNumber = firstString(row.uidFormatted, row.uid);
  if (!legalName || !registrationNumber) return null;
  if (row.status && !/active|aktiv/i.test(row.status)) return null;

  return emptyCompany({
    legalName,
    registrationNumber,
    country: "Switzerland",
    countryCode: "CH",
    streetAddress: cleanText(row.address?.street) || undefined,
    postalCode: cleanText(row.address?.swissZipCode) || undefined,
    city: firstString(row.legalSeatFormatted, row.legalSeat, row.address?.city) || undefined,
    sourceRegistry: "Zefix (CH)",
  });
}

async function searchZefix(query: string): Promise<UnifiedEuropeanCompany[]> {
  const uid = parseSwissUid(query);
  const name = uid ?? (query.includes("*") ? query : `*${query}*`);
  const data = await fetchRegistryJson<ZefixSearchResponse | ZefixFirm[]>(
    "https://www.zefix.admin.ch/ZefixREST/api/v1/firm/search.json",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        activeOnly: true,
        maxEntries: 8,
        offset: 0,
        languageKey: "en",
      }),
    },
  );
  if (!data) return [];
  const rows = Array.isArray(data) ? data : (data.list ?? []);
  return rows
    .map(mapZefix)
    .filter((row): row is UnifiedEuropeanCompany => Boolean(row));
}

/**
 * Swiss Central Business Name Index (Zefix). The REST search is public but
 * some cloud IPs are blocked; GLEIF is the fallback when Zefix is empty.
 */
export const switzerlandAdapter: RegistryAdapter = {
  id: "CH",
  countryCode: "CH",
  sourceRegistry: "Zefix (CH)",
  async search(query: string): Promise<UnifiedEuropeanCompany[]> {
    const q = query.trim();
    if (!q) return [];
    const zefix = await searchZefix(q);
    if (zefix.length > 0) return zefix;
    return searchGleif(parseSwissUid(q) ?? q, "CH");
  },
};
