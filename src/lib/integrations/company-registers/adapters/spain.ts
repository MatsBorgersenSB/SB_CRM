import { euViesAdapter, parseEuVatNumber } from "@/lib/integrations/company-registers/adapters/eu-vies";
import { searchGleif } from "@/lib/integrations/company-registers/adapters/gleif";
import {
  cleanText,
  emptyCompany,
  fetchRegistryJson,
} from "@/lib/integrations/company-registers/http";
import type {
  RegistryAdapter,
  UnifiedEuropeanCompany,
} from "@/lib/integrations/company-registers/types";

type OpenMercantilItem = {
  name?: string;
  cif?: string;
  province?: string;
  cnae_code?: string;
};

type OpenMercantilResponse = {
  items?: OpenMercantilItem[];
};

function mapEs(row: OpenMercantilItem): UnifiedEuropeanCompany | null {
  const legalName = cleanText(row.name);
  const cif = cleanText(row.cif).toUpperCase();
  if (!legalName || !cif) return null;

  return emptyCompany({
    legalName,
    registrationNumber: cif,
    vatNumber: cif.startsWith("ES") ? cif : `ES${cif}`,
    country: "Spain",
    countryCode: "ES",
    city: cleanText(row.province) || undefined,
    industryCode: cleanText(row.cnae_code) || undefined,
    sourceRegistry: "BORME / OpenMercantil (ES)",
  });
}

/**
 * Spanish BORME-derived name/CIF search (OpenMercantil, no key for light use).
 * CIF/VAT also goes through EU VIES. GLEIF is the fallback.
 */
export const spainAdapter: RegistryAdapter = {
  id: "ES",
  countryCode: "ES",
  sourceRegistry: "BORME / OpenMercantil (ES)",
  async search(query: string): Promise<UnifiedEuropeanCompany[]> {
    const q = query.trim();
    if (!q) return [];

    const vat = parseEuVatNumber(q);
    if (vat?.countryCode === "ES") {
      const vies = await euViesAdapter.search(q);
      if (vies.length > 0) return vies;
    }

    const data = await fetchRegistryJson<OpenMercantilResponse>(
      `https://openmercantil.es/api/v1/search?q=${encodeURIComponent(q)}`,
    );
    const mapped = (data?.items ?? [])
      .map(mapEs)
      .filter((row): row is UnifiedEuropeanCompany => Boolean(row))
      .slice(0, 8);
    if (mapped.length > 0) return mapped;

    const cif = q.replace(/[\s.\-]/g, "").toUpperCase();
    if (/^[A-Z]\d{8}$/.test(cif) || /^\d{8}[A-Z]$/.test(cif)) {
      const vies = await euViesAdapter.search(`ES${cif}`);
      if (vies.length > 0) return vies;
    }

    return searchGleif(q, "ES");
  },
};
