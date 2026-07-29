/**
 * Continent mapping for ISO 3166-1 alpha-2 country codes.
 *
 * Phase 1: keep the mapping intentionally small, with a safe fallback to "Other".
 */
export function getContinentByCountryCode(countryCode: string): string {
  const code = countryCode.trim().toUpperCase();
  if (!code) return "Other";

  const byCode: Record<string, string> = {
    // Europe
    AT: "Europe",
    BE: "Europe",
    CH: "Europe",
    DE: "Europe",
    DK: "Europe",
    ES: "Europe",
    FI: "Europe",
    FR: "Europe",
    GB: "Europe",
    IS: "Europe",
    IE: "Europe",
    IT: "Europe",
    NL: "Europe",
    NO: "Europe",
    PL: "Europe",
    PT: "Europe",
    SE: "Europe",
    // North America
    CA: "North America",
    US: "North America",
    // South America
    BR: "South America",
    // Asia
    IN: "Asia",
    JP: "Asia",
    SG: "Asia",
    CN: "Asia",
    // Oceania
    AU: "Oceania",
    NZ: "Oceania",
    // Africa
    ZA: "Africa",
  };

  return byCode[code] ?? "Other";
}

