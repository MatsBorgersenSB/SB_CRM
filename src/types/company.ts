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

/**
 * Industries typical for Standard Bio customers and ecosystem partners —
 * buyers and influencers around complete turnkey process plants
 * (pyrolysis systems, feedstock processing, energy recovery, circular materials).
 */
export type CompanyIndustry =
  // Polymers, chemicals & materials
  | "Polymer Processing"
  | "Plastics Recycling"
  | "Rubber & Tire Processing"
  | "Textile Recovery"
  | "Chemical Manufacturing"
  | "Petrochemicals"
  | "Specialty Chemicals"
  // Waste, recycling & circular
  | "Waste Management"
  | "Municipal Solid Waste"
  | "Hazardous Waste Treatment"
  | "Construction & Demolition Waste"
  | "Sewage Sludge Treatment"
  | "E-Waste & Electronics Recycling"
  | "Recycling & Circular Economy"
  // Energy & carbon
  | "Biomass & Bioenergy"
  | "Biochar & Carbon Removal"
  | "Renewable Energy"
  | "Energy & Infrastructure"
  | "District Heating & Utilities"
  | "Oil & Gas"
  | "Hydrogen & Synthetic Fuels"
  // Agri, forest & food
  | "Agriculture & Agri-Processing"
  | "Forestry & Wood Processing"
  | "Pulp & Paper"
  | "Food & Beverage Processing"
  | "Animal By-products & Rendering"
  | "Aquaculture"
  | "Fertilizer & Soil Amendments"
  // Heavy industry & manufacturing
  | "Cement & Construction Materials"
  | "Mining & Minerals Processing"
  | "Metals & Steel"
  | "Water & Wastewater Treatment"
  | "Industrial Manufacturing"
  | "Industrial Technology"
  | "Electronics & Electrical Equipment"
  | "Automotive & Mobility"
  | "Packaging"
  // Ecosystem & delivery partners
  | "EPC & Engineering Contractors"
  | "Project Development"
  | "Cleantech & Climate Tech"
  | "Environmental Services"
  | "Research & Academia"
  | "Government & Municipalities"
  | "Maritime & Ports"
  | "Logistics & Transport"
  | "Other / Diversified";

export type CompanyIndustryGroup = {
  label: string;
  industries: readonly CompanyIndustry[];
};

export const COMPANY_INDUSTRY_GROUPS: readonly CompanyIndustryGroup[] = [
  {
    label: "Polymers, chemicals & materials",
    industries: [
      "Polymer Processing",
      "Plastics Recycling",
      "Rubber & Tire Processing",
      "Textile Recovery",
      "Chemical Manufacturing",
      "Petrochemicals",
      "Specialty Chemicals",
    ],
  },
  {
    label: "Waste, recycling & circular",
    industries: [
      "Waste Management",
      "Municipal Solid Waste",
      "Hazardous Waste Treatment",
      "Construction & Demolition Waste",
      "Sewage Sludge Treatment",
      "E-Waste & Electronics Recycling",
      "Recycling & Circular Economy",
    ],
  },
  {
    label: "Energy & carbon",
    industries: [
      "Biomass & Bioenergy",
      "Biochar & Carbon Removal",
      "Renewable Energy",
      "Energy & Infrastructure",
      "District Heating & Utilities",
      "Oil & Gas",
      "Hydrogen & Synthetic Fuels",
    ],
  },
  {
    label: "Agri, forest & food",
    industries: [
      "Agriculture & Agri-Processing",
      "Forestry & Wood Processing",
      "Pulp & Paper",
      "Food & Beverage Processing",
      "Animal By-products & Rendering",
      "Aquaculture",
      "Fertilizer & Soil Amendments",
    ],
  },
  {
    label: "Heavy industry & manufacturing",
    industries: [
      "Cement & Construction Materials",
      "Mining & Minerals Processing",
      "Metals & Steel",
      "Water & Wastewater Treatment",
      "Industrial Manufacturing",
      "Industrial Technology",
      "Electronics & Electrical Equipment",
      "Automotive & Mobility",
      "Packaging",
    ],
  },
  {
    label: "Ecosystem & delivery partners",
    industries: [
      "EPC & Engineering Contractors",
      "Project Development",
      "Cleantech & Climate Tech",
      "Environmental Services",
      "Research & Academia",
      "Government & Municipalities",
      "Maritime & Ports",
      "Logistics & Transport",
      "Other / Diversified",
    ],
  },
] as const;

export const COMPANY_INDUSTRIES: CompanyIndustry[] = COMPANY_INDUSTRY_GROUPS.flatMap(
  (group) => [...group.industries],
);

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

/** Normalize free-text / legacy industry labels into the canonical list. */
export function resolveCompanyIndustry(
  industry: string | null | undefined,
): CompanyIndustry {
  const raw = (industry ?? "").trim();
  if (!raw) return "Other / Diversified";

  if ((COMPANY_INDUSTRIES as string[]).includes(raw)) {
    return raw as CompanyIndustry;
  }

  const lower = raw.toLowerCase();

  const patterns: Array<{ match: RegExp; industry: CompanyIndustry }> = [
    { match: /\be-?waste|electronics recycl|wEEE\b/i, industry: "E-Waste & Electronics Recycling" },
    { match: /\belectronic|electrical equipment|industri.*tech/i, industry: "Electronics & Electrical Equipment" },
    { match: /\btire|tyre|rubber\b/i, industry: "Rubber & Tire Processing" },
    { match: /\bplastic.*recycl|recycl.*plastic/i, industry: "Plastics Recycling" },
    { match: /\bpolymer|plastic\b/i, industry: "Polymer Processing" },
    { match: /\btextile|fiber|fibre\b/i, industry: "Textile Recovery" },
    { match: /\bpetrochem/i, industry: "Petrochemicals" },
    { match: /\bspecialt(y|ie) chem/i, industry: "Specialty Chemicals" },
    { match: /\bchem/i, industry: "Chemical Manufacturing" },
    { match: /\bhazardous waste/i, industry: "Hazardous Waste Treatment" },
    { match: /\bmsw|municipal.*waste|solid waste/i, industry: "Municipal Solid Waste" },
    { match: /\bconstruction.*demolition|\bc&d\b|cd waste/i, industry: "Construction & Demolition Waste" },
    { match: /\bsewage|sludge\b/i, industry: "Sewage Sludge Treatment" },
    { match: /\bcircular|recycl/i, industry: "Recycling & Circular Economy" },
    { match: /\bwaste\b/i, industry: "Waste Management" },
    { match: /\bbiochar|carbon removal|cdr\b/i, industry: "Biochar & Carbon Removal" },
    { match: /\bbiomass|bioenerg/i, industry: "Biomass & Bioenergy" },
    { match: /\bhydrogen|synfuel|synthetic fuel|e-fuel/i, industry: "Hydrogen & Synthetic Fuels" },
    { match: /\bdistrict heat|utility|utilities\b/i, industry: "District Heating & Utilities" },
    { match: /\brenewable|cleantech equipment|solar|wind\b/i, industry: "Renewable Energy" },
    { match: /\boil\b|\bgas\b|upstream|downstream/i, industry: "Oil & Gas" },
    { match: /\benergy|infra/i, industry: "Energy & Infrastructure" },
    { match: /\baquaculture|fish farm|seafood|salmon\b/i, industry: "Aquaculture" },
    { match: /\bfertiliz|soil amend/i, industry: "Fertilizer & Soil Amendments" },
    { match: /\brender|animal by|slaughter/i, industry: "Animal By-products & Rendering" },
    { match: /\bfood\b|beverage|dairy\b/i, industry: "Food & Beverage Processing" },
    { match: /\bpulp|paper\b/i, industry: "Pulp & Paper" },
    { match: /\bforest|timber|wood process|sawmill/i, industry: "Forestry & Wood Processing" },
    { match: /\bagri|farm|crop|feedstock farm/i, industry: "Agriculture & Agri-Processing" },
    { match: /\bcement|concrete|construct.*material/i, industry: "Cement & Construction Materials" },
    { match: /\bmining|mineral/i, industry: "Mining & Minerals Processing" },
    { match: /\bsteel|metal\b/i, industry: "Metals & Steel" },
    { match: /\bwastewater|water treatment|water util/i, industry: "Water & Wastewater Treatment" },
    { match: /\bautomotive|mobility|oem\b/i, industry: "Automotive & Mobility" },
    { match: /\bpackag/i, industry: "Packaging" },
    { match: /\bepc\b|engineering contractor|turnkey contractor/i, industry: "EPC & Engineering Contractors" },
    { match: /\bproject develop/i, industry: "Project Development" },
    { match: /\bcleantech|climate tech/i, industry: "Cleantech & Climate Tech" },
    { match: /\benvironmental service|environ.*consult/i, industry: "Environmental Services" },
    { match: /\bresearch|academia|university|institut/i, industry: "Research & Academia" },
    { match: /\bgovernment|municipalit|public sector/i, industry: "Government & Municipalities" },
    { match: /\bmaritime|port\b|shipping\b/i, industry: "Maritime & Ports" },
    { match: /\blogistics|transport\b|fleet\b/i, industry: "Logistics & Transport" },
    { match: /\bindustrial manufactur|manufactur/i, industry: "Industrial Manufacturing" },
    { match: /\bindustrial tech/i, industry: "Industrial Technology" },
  ];

  for (const entry of patterns) {
    if (entry.match.test(lower)) return entry.industry;
  }

  return "Other / Diversified";
}

export function formatCompanyLocation(
  company: Pick<Company, "City" | "Country">,
): string {
  const city = company.City.trim();
  const country = company.Country?.Title.trim() ?? "";

  if (city && country) return `${city}, ${country}`;
  return city || country || "—";
}
