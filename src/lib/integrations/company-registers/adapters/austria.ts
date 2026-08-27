import { euViesAdapter, parseEuVatNumber } from "@/lib/integrations/company-registers/adapters/eu-vies";
import { searchGleif } from "@/lib/integrations/company-registers/adapters/gleif";
import type {
  RegistryAdapter,
  UnifiedEuropeanCompany,
} from "@/lib/integrations/company-registers/types";

/**
 * Austria has no public Firmenbuch name-search REST API.
 * UID (ATU…) is confirmed via EU VIES; names use GLEIF (LEI holders).
 */
export const austriaAdapter: RegistryAdapter = {
  id: "AT",
  countryCode: "AT",
  sourceRegistry: "EU VIES / GLEIF (AT)",
  async search(query: string): Promise<UnifiedEuropeanCompany[]> {
    const q = query.trim();
    if (!q) return [];

    const vat = parseEuVatNumber(q);
    if (vat?.countryCode === "AT") {
      const vies = await euViesAdapter.search(q);
      if (vies.length > 0) return vies;
    }

    const compact = q.replace(/[\s.\-]/g, "").toUpperCase();
    if (/^U\d{8}$/.test(compact)) {
      const vies = await euViesAdapter.search(`AT${compact}`);
      if (vies.length > 0) return vies;
    }

    return searchGleif(q, "AT");
  },
};
