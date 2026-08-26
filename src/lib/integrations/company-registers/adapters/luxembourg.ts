import { euViesAdapter, parseEuVatNumber } from "@/lib/integrations/company-registers/adapters/eu-vies";
import { searchGleif } from "@/lib/integrations/company-registers/adapters/gleif";
import type {
  RegistryAdapter,
  UnifiedEuropeanCompany,
} from "@/lib/integrations/company-registers/types";

/**
 * Luxembourg RCSL has no public name-search REST API.
 * LU VAT via VIES; names via GLEIF.
 */
export const luxembourgAdapter: RegistryAdapter = {
  id: "LU",
  countryCode: "LU",
  sourceRegistry: "EU VIES / GLEIF (LU)",
  async search(query: string): Promise<UnifiedEuropeanCompany[]> {
    const q = query.trim();
    if (!q) return [];

    const vat = parseEuVatNumber(q);
    if (vat?.countryCode === "LU") {
      const vies = await euViesAdapter.search(q);
      if (vies.length > 0) return vies;
    }

    return searchGleif(q, "LU");
  },
};
