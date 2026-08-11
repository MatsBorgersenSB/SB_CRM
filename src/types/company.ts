/**
 * SharePoint List field shapes — exact internal names and lookup structures.
 */
import type { Contact } from "@/types/contact";
import type { CompanyType } from "@/types/company-type";

export type SharePointLookup = {
  Id: number;
  Title: string;
};

export type SharePointPerson = {
  Id: number;
  Title: string;
};

export type CompanyIndustry = string;

/** Suggested sectors — users may add others. */
export const COMPANY_INDUSTRIES: CompanyIndustry[] = [
  "Polymer Processing",
  "Textile Recovery",
  "Chemical Manufacturing",
  "Waste Management",
  "Energy & Infrastructure",
  "IT Services & Managed Services",
  "Software & Technology",
  "Consulting & Professional Services",
  "Engineering & EPC",
  "Industrial Equipment & Machinery",
  "Pulp & Paper",
  "Agriculture & Agribusiness",
  "Food & Beverage",
  "Cement & Building Materials",
  "Metals & Mining",
  "Oil & Gas",
  "Utilities",
  "Logistics & Transportation",
  "Construction",
  "Public Sector / Government",
  "University / Research",
  "Finance & Investment",
  "Environmental Services",
  "Biochar & Carbon Markets",
  "Other",
];

export function normalizeCompanyIndustry(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

/** Prefer exact preset match (case-insensitive); otherwise keep free text. */
export function resolveCompanyIndustry(
  value: string | null | undefined,
): CompanyIndustry {
  const trimmed = normalizeCompanyIndustry(value);
  if (!trimmed) return "";
  const preset = COMPANY_INDUSTRIES.find(
    (item) => item.toLowerCase() === trimmed.toLowerCase(),
  );
  return preset ?? trimmed;
}

export type CompanyStatus =
  | "Active"
  | "Prospecting"
  | "Contracted"
  | "On Hold"
  | "Inactive";

export const COMPANY_STATUSES: CompanyStatus[] = [
  "Active",
  "Prospecting",
  "Contracted",
  "On Hold",
  "Inactive",
];

export type Company = {
  /** SharePoint native list item ID */
  id: number;
  /** Company display name (SharePoint Title) */
  Title: string;
  /** Tracking identifier, e.g. CO-1001 (mirrors Prisma `code` when persisted). */
  CompanyID: string;
  /** Explicit registry code when stored in Prisma (`code` column). */
  code?: string | null;
  ParentCompany: SharePointLookup | null;
  Domain: string;
  Industry: CompanyIndustry;
  /** Ecosystem roles — multiple classifications supported (Phase 6H) */
  CompanyTypes?: CompanyType[];
  /** @deprecated Prefer CompanyTypes[]. Kept for backward compatibility on read. */
  companyType?: CompanyType | string;
  Status: CompanyStatus;
  AccountOwner: SharePointPerson | null;
  Phone: string;
  Email: string;
  AddressLine1: string;
  AddressLine2: string;
  PostalCode: string;
  City: string;
  Country: SharePointLookup | null;
  /** National registration number (orgnr, SIREN, CVR, …) */
  organizationNumber?: string | null;
  /** VAT / MVA number when known */
  vatNumber?: string | null;
  /** Structured geo fields (Phase 1: OSM enrichment) */
  stateRegion?: string | null;
  countryCode?: string | null;
  continent?: string | null;
  /** App-level relations — not SharePoint list columns */
  pipelineIds: string[];
  contacts: Contact[];
  /** Internal account notes */
  Notes?: string;
  /** Comma-friendly classification tags */
  Tags?: string[];
};

export type {
  Contact,
  ContactListRole,
  ContactStatus,
  RelationshipLevel,
  CreateContactInput,
  UpdateContactInput,
  EditableContactField,
} from "@/types/contact";

export {
  CONTACT_LIST_ROLES,
  CONTACT_STATUSES,
  RELATIONSHIP_LEVELS,
  getContactDisplayName,
  buildContactTitle,
} from "@/types/contact";

export type { CompanyType } from "@/types/company-type";
export {
  COMPANY_TYPE_META,
  COMPANY_TYPE_SELECT_OPTIONS,
  DEFAULT_COMPANY_TYPES,
  COMPANY_TYPE_QUICK_FILTERS,
} from "@/types/company-type";

export function formatCompanyLocation(
  company: Pick<Company, "City" | "Country">,
): string {
  const city = company.City.trim();
  const country = company.Country?.Title.trim() ?? "";

  if (city && country) return `${city}, ${country}`;
  return city || country || "—";
}
