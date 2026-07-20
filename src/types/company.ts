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

export type CompanyIndustry =
  | "Polymer Processing"
  | "Textile Recovery"
  | "Chemical Manufacturing"
  | "Waste Management"
  | "Energy & Infrastructure";

export type CompanyStatus =
  | "Active"
  | "Prospecting"
  | "Contracted"
  | "On Hold"
  | "Inactive";

export const COMPANY_INDUSTRIES: CompanyIndustry[] = [
  "Polymer Processing",
  "Textile Recovery",
  "Chemical Manufacturing",
  "Waste Management",
  "Energy & Infrastructure",
];

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
  /** Tracking identifier, e.g. CO-1001 */
  CompanyID: string;
  ParentCompany: SharePointLookup | null;
  Domain: string;
  Industry: CompanyIndustry;
  /** Ecosystem roles — multiple classifications supported (Phase 6H) */
  CompanyTypes?: CompanyType[];
  Status: CompanyStatus;
  AccountOwner: SharePointPerson | null;
  Phone: string;
  Email: string;
  AddressLine1: string;
  AddressLine2: string;
  PostalCode: string;
  City: string;
  Country: SharePointLookup | null;
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
