/** Pan-European business registry — unified types. */

export type UnifiedEuropeanCompany = {
  legalName: string;
  /** Country-specific registration id (orgnr, SIREN, CVR, Y-tunnus, HRB, …). */
  registrationNumber: string;
  vatNumber?: string;
  country: string;
  /** ISO 3166-1 alpha-2 */
  countryCode: string;
  continent: string;
  streetAddress?: string;
  postalCode?: string;
  city?: string;
  industryCode?: string;
  industryDescription?: string;
  executives?: string[];
  /** Human-readable registry provenance. */
  sourceRegistry: string;
};

export type RegistryAdapterId =
  | "NO"
  | "DK"
  | "FI"
  | "FR"
  | "GB"
  | "DE"
  | "EE"
  | "VIES";

export type RegistryAdapter = {
  id: RegistryAdapterId;
  countryCode: string;
  sourceRegistry: string;
  /** Search by free-text name or registration/VAT number. */
  search: (query: string) => Promise<UnifiedEuropeanCompany[]>;
};

export type EuropeanRegistrySearchOptions = {
  /** Prefer this country adapter first (ISO alpha-2). */
  countryCodeHint?: string;
  /** Optional domain used to infer country from TLD (.no → NO). */
  domainHint?: string;
  /** Max results after dedupe. */
  limit?: number;
};
