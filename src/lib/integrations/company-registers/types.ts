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
  /** Website as declared to the register, when the register carries one. */
  website?: string;
  /** Human-readable registry provenance. */
  sourceRegistry: string;
};

/** A named officer from a public register (board, CEO, contact person). */
export type RegistryOfficer = {
  name: string;
  /** Role as the register describes it, e.g. "Daglig leder", "Styrets leder". */
  role: string;
};

export type RegistryAdapterId =
  | "NO"
  | "DK"
  | "SE"
  | "FI"
  | "FR"
  | "GB"
  | "DE"
  | "AT"
  | "CH"
  | "BE"
  | "NL"
  | "LU"
  | "ES"
  | "PT"
  | "IT"
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
