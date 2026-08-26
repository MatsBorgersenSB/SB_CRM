import { euViesAdapter, parseEuVatNumber } from "@/lib/integrations/company-registers/adapters/eu-vies";
import { searchGleif } from "@/lib/integrations/company-registers/adapters/gleif";
import type {
  RegistryAdapter,
  UnifiedEuropeanCompany,
} from "@/lib/integrations/company-registers/types";

/**
 * Portugal IRN has no public name-search REST API.
 * NIF / PT VAT via VIES; names via GLEIF.
 */
export const portugalAdapter: RegistryAdapter = {
  id: "PT",
  countryCode: "PT",
  sourceRegistry: "EU VIES / GLEIF (PT)",
  async search(query: string): Promise<UnifiedEuropeanCompany[]> {
    const q = query.trim();
    if (!q) return [];

    const vat = parseEuVatNumber(q);
    if (vat?.countryCode === "PT") {
      const vies = await euViesAdapter.search(q);
      if (vies.length > 0) return vies;
    }

    const digits = q.replace(/[\s.\-]/g, "");
    if (/^\d{9}$/.test(digits)) {
      const vies = await euViesAdapter.search(`PT${digits}`);
      if (vies.length > 0) return vies;
    }

    return searchGleif(q, "PT");
  },
};
