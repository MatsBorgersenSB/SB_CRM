import { euViesAdapter, parseEuVatNumber } from "@/lib/integrations/company-registers/adapters/eu-vies";
import { searchGleif } from "@/lib/integrations/company-registers/adapters/gleif";
import type {
  RegistryAdapter,
  UnifiedEuropeanCompany,
} from "@/lib/integrations/company-registers/types";

function compactDigits(query: string): string {
  return query.replace(/[\s.\-]/g, "");
}

/**
 * Belgian CBE/KBO. Enterprise number / BE VAT via VIES; names via GLEIF.
 * The KBO public HTML search is a form POST without a documented JSON API.
 */
export const belgiumAdapter: RegistryAdapter = {
  id: "BE",
  countryCode: "BE",
  sourceRegistry: "EU VIES / GLEIF (BE)",
  async search(query: string): Promise<UnifiedEuropeanCompany[]> {
    const q = query.trim();
    if (!q) return [];

    const vat = parseEuVatNumber(q);
    if (vat?.countryCode === "BE") {
      const vies = await euViesAdapter.search(q);
      if (vies.length > 0) return vies;
    }

    const digits = compactDigits(q);
    if (/^\d{10}$/.test(digits)) {
      const vies = await euViesAdapter.search(`BE${digits}`);
      if (vies.length > 0) return vies;
    }

    return searchGleif(q, "BE");
  },
};
