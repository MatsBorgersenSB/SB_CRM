import { euViesAdapter, parseEuVatNumber } from "@/lib/integrations/company-registers/adapters/eu-vies";
import { searchGleif } from "@/lib/integrations/company-registers/adapters/gleif";
import type {
  RegistryAdapter,
  UnifiedEuropeanCompany,
} from "@/lib/integrations/company-registers/types";

/**
 * Italian Registro Imprese has no public name-search REST API.
 * Partita IVA via VIES; names via GLEIF.
 */
export const italyAdapter: RegistryAdapter = {
  id: "IT",
  countryCode: "IT",
  sourceRegistry: "EU VIES / GLEIF (IT)",
  async search(query: string): Promise<UnifiedEuropeanCompany[]> {
    const q = query.trim();
    if (!q) return [];

    const vat = parseEuVatNumber(q);
    if (vat?.countryCode === "IT") {
      const vies = await euViesAdapter.search(q);
      if (vies.length > 0) return vies;
    }

    const digits = q.replace(/[\s.\-]/g, "");
    if (/^\d{11}$/.test(digits)) {
      const vies = await euViesAdapter.search(`IT${digits}`);
      if (vies.length > 0) return vies;
    }

    return searchGleif(q, "IT");
  },
};
