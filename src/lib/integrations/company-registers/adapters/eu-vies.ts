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

/**
 * EU Commission VIES VAT validation.
 * REST JSON endpoint (unofficial but widely used):
 * https://ec.europa.eu/taxation_customs/vies/rest-api/ms/{country}/vat/{number}
 */

const EU_VAT_PATTERN =
  /^(AT|BE|BG|CY|CZ|DE|DK|EE|EL|ES|FI|FR|HR|HU|IE|IT|LT|LU|LV|MT|NL|PL|PT|RO|SE|SI|SK|XI)[A-Z0-9]{2,12}$/i;

const COUNTRY_NAMES: Record<string, string> = {
  AT: "Austria",
  BE: "Belgium",
  BG: "Bulgaria",
  CY: "Cyprus",
  CZ: "Czechia",
  DE: "Germany",
  DK: "Denmark",
  EE: "Estonia",
  EL: "Greece",
  ES: "Spain",
  FI: "Finland",
  FR: "France",
  HR: "Croatia",
  HU: "Hungary",
  IE: "Ireland",
  IT: "Italy",
  LT: "Lithuania",
  LU: "Luxembourg",
  LV: "Latvia",
  MT: "Malta",
  NL: "Netherlands",
  PL: "Poland",
  PT: "Portugal",
  RO: "Romania",
  SE: "Sweden",
  SI: "Slovenia",
  SK: "Slovakia",
  XI: "United Kingdom (NI)",
};

type ViesResponse = {
  isValid?: boolean;
  requestDate?: string;
  userError?: string;
  name?: string;
  address?: string;
  vatNumber?: string;
  countryCode?: string;
};

export function parseEuVatNumber(query: string): { countryCode: string; vatNumber: string } | null {
  const compact = query.replace(/[\s.\-]/g, "").toUpperCase();
  if (!EU_VAT_PATTERN.test(compact)) return null;
  const countryCode = compact.slice(0, 2);
  const vatNumber = compact.slice(2);
  if (!vatNumber) return null;
  return { countryCode, vatNumber };
}

function parseAddress(address: string | undefined): {
  streetAddress?: string;
  postalCode?: string;
  city?: string;
} {
  const text = cleanText(address);
  if (!text) return {};

  // Common VIES format: "STREET\nPOSTAL CITY" or "STREET, POSTAL CITY"
  const lines = text.split(/\n+/).map(cleanText).filter(Boolean);
  if (lines.length >= 2) {
    const last = lines[lines.length - 1] ?? "";
    const match = last.match(/^(\d{4,5})\s+(.+)$/);
    if (match) {
      return {
        streetAddress: lines.slice(0, -1).join(", "),
        postalCode: match[1],
        city: match[2],
      };
    }
    return { streetAddress: lines[0], city: last };
  }

  const match = text.match(/^(.+?)[,\s]+(\d{4,5})\s+(.+)$/);
  if (match) {
    return {
      streetAddress: match[1],
      postalCode: match[2],
      city: match[3],
    };
  }

  return { streetAddress: text };
}

export const euViesAdapter: RegistryAdapter = {
  id: "VIES",
  countryCode: "EU",
  sourceRegistry: "EU VIES VAT (EC)",
  async search(query: string): Promise<UnifiedEuropeanCompany[]> {
    const parsed = parseEuVatNumber(query);
    if (!parsed) return [];

    // EL is Greece in VIES; map display country accordingly.
    const viesCountry = parsed.countryCode;
    const displayCode = viesCountry === "EL" ? "GR" : viesCountry === "XI" ? "GB" : viesCountry;

    const url = `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${viesCountry}/vat/${parsed.vatNumber}`;
    const data = await fetchRegistryJson<ViesResponse>(url);
    if (!data?.isValid) return [];

    const legalName = firstString(data.name);
    if (!legalName || legalName === "---") return [];

    const addressParts = parseAddress(data.address);
    const fullVat = `${viesCountry}${parsed.vatNumber}`;

    return [
      emptyCompany({
        legalName,
        registrationNumber: parsed.vatNumber,
        vatNumber: fullVat,
        country: COUNTRY_NAMES[viesCountry] ?? displayCode,
        countryCode: displayCode,
        streetAddress: addressParts.streetAddress,
        postalCode: addressParts.postalCode,
        city: addressParts.city,
        sourceRegistry: "EU VIES VAT (EC)",
      }),
    ];
  },
};
