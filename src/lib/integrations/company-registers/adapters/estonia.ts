import {
  cleanText,
  emptyCompany,
  fetchRegistryJson,
} from "@/lib/integrations/company-registers/http";
import type {
  RegistryAdapter,
  UnifiedEuropeanCompany,
} from "@/lib/integrations/company-registers/types";

/**
 * Estonian e-Business Register — free autocomplete endpoint.
 * Full detail often requires a commercial contract; we map autocomplete hits.
 * https://avaandmed.ariregister.rik.ee/
 */

type EeAutocompleteHit = {
  name?: string;
  reg_code?: string;
  regCode?: string;
  legal_form?: string;
  status?: string;
};

type EeAutocompleteResponse =
  | EeAutocompleteHit[]
  | { data?: EeAutocompleteHit[]; results?: EeAutocompleteHit[] };

function mapEe(row: EeAutocompleteHit): UnifiedEuropeanCompany | null {
  const legalName = cleanText(row.name);
  const registrationNumber = cleanText(row.reg_code ?? row.regCode);
  if (!legalName || !registrationNumber) return null;

  return emptyCompany({
    legalName,
    registrationNumber,
    vatNumber: undefined,
    country: "Estonia",
    countryCode: "EE",
    sourceRegistry: "e-Business Register (EE)",
  });
}

export const estoniaAdapter: RegistryAdapter = {
  id: "EE",
  countryCode: "EE",
  sourceRegistry: "e-Business Register (EE)",
  async search(query: string): Promise<UnifiedEuropeanCompany[]> {
    const q = query.trim();
    if (!q) return [];

    const endpoints = [
      `https://ariregister.rik.ee/est/api/autocomplete?q=${encodeURIComponent(q)}`,
      `https://avaandmed.ariregister.rik.ee/api/autocomplete?q=${encodeURIComponent(q)}`,
    ];

    for (const url of endpoints) {
      const data = await fetchRegistryJson<EeAutocompleteResponse>(url);
      if (!data) continue;

      const rows = Array.isArray(data)
        ? data
        : (data.results ?? data.data ?? []);
      const mapped = rows
        .map(mapEe)
        .filter((row): row is UnifiedEuropeanCompany => Boolean(row))
        .slice(0, 8);
      if (mapped.length > 0) return mapped;
    }

    return [];
  },
};
