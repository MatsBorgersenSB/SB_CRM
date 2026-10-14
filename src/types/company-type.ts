/**
 * Company classification — ecosystem role (Phase 6H + Growth Intelligence).
 * Companies may carry multiple types. Single Company entity for all roles.
 */

/**
 * Company classification — ecosystem role.
 * A company is an ecosystem node, not automatically a client.
 * Unknown → Unclassified (Reality First). Opportunities only for sell-to roles.
 */
export type CompanyType =
  | "Unclassified"
  | "Prospect"
  | "Customer"
  | "Partner"
  | "Competitor"
  | "Supplier / Vendor"
  | "Public / Government"
  | "University / Research"
  | "Investor"
  | "NGO / Non-Profit"
  | "Granting Authority"
  /** Legacy values retained for stored records / filters (canonicalized on write). */
  | "Supplier"
  | "Association"
  | "Research Organization"
  | "Offtaker"
  | "Government Agency"
  | "Service Provider"
  | "Consultant"
  | "Distributor"
  | "Authority"
  | "Internal Company";

/** Options shown in create/edit multi-select (intentional roles — not Unclassified). */
export const COMPANY_TYPE_SELECT_OPTIONS: CompanyType[] = [
  "Prospect",
  "Customer",
  "Partner",
  "Competitor",
  "Supplier / Vendor",
  "Consultant",
  "Public / Government",
  "University / Research",
  "Investor",
  "NGO / Non-Profit",
  "Granting Authority",
];

/** Primary growth-intelligence ecosystem types */
export const GROWTH_ECOSYSTEM_TYPES: CompanyType[] = [
  "Customer",
  "Prospect",
  "Competitor",
  "Partner",
  "Supplier / Vendor",
  "Investor",
  "Association",
  "University / Research",
  "Offtaker",
  "Public / Government",
];

export const DEFAULT_COMPANY_TYPES: CompanyType[] = [
  "Unclassified",
  ...COMPANY_TYPE_SELECT_OPTIONS,
  "Supplier",
  "Association",
  "Research Organization",
  "Offtaker",
  "Government Agency",
  "Service Provider",
  "Distributor",
  "Authority",
  "Internal Company",
];

/** Semantic icon keys — resolved to line icons by `CompanyTypeIcon`. */
export type CompanyTypeIconName =
  | "unclassified"
  | "prospect"
  | "customer"
  | "partner"
  | "competitor"
  | "supplier"
  | "authority"
  | "research"
  | "investor"
  | "ngo"
  | "grant"
  | "association"
  | "offtaker"
  | "service"
  | "consultant"
  | "distributor"
  | "internal"
  | "other";

export const COMPANY_TYPE_META: Record<
  CompanyType,
  { icon: CompanyTypeIconName; label: string; plural: string }
> = {
  Unclassified: { icon: "unclassified", label: "Unclassified", plural: "Unclassified" },
  Prospect: { icon: "prospect", label: "Prospect", plural: "Prospects" },
  Customer: { icon: "customer", label: "Customer", plural: "Customers" },
  Partner: { icon: "partner", label: "Partner", plural: "Partners" },
  Competitor: { icon: "competitor", label: "Competitor", plural: "Competitors" },
  "Supplier / Vendor": { icon: "supplier", label: "Supplier / Vendor", plural: "Suppliers / Vendors" },
  "Public / Government": {
    icon: "authority",
    label: "Public / Government",
    plural: "Public / Government",
  },
  "University / Research": {
    icon: "research",
    label: "University / Research",
    plural: "Universities / Research",
  },
  Investor: { icon: "investor", label: "Investor", plural: "Investors" },
  "NGO / Non-Profit": { icon: "ngo", label: "NGO / Non-Profit", plural: "NGOs / Non-Profits" },
  "Granting Authority": {
    icon: "grant",
    label: "Granting Authority",
    plural: "Granting Authorities",
  },
  Supplier: { icon: "supplier", label: "Supplier", plural: "Suppliers" },
  Association: { icon: "association", label: "Association", plural: "Associations" },
  "Research Organization": {
    icon: "research",
    label: "Research Organization",
    plural: "Research Organizations",
  },
  Offtaker: { icon: "offtaker", label: "Offtaker", plural: "Offtakers" },
  "Government Agency": {
    icon: "authority",
    label: "Government Agency",
    plural: "Government Agencies",
  },
  "Service Provider": { icon: "service", label: "Service Provider", plural: "Service Providers" },
  Consultant: { icon: "consultant", label: "Consultant", plural: "Consultants" },
  Distributor: { icon: "distributor", label: "Distributor", plural: "Distributors" },
  Authority: { icon: "authority", label: "Authority", plural: "Authorities" },
  "Internal Company": { icon: "internal", label: "Internal Company", plural: "Internal Companies" },
};

/** Map legacy / slug / enum labels onto current presets. */
export const COMPANY_TYPE_ALIASES: Record<string, CompanyType> = {
  unclassified: "Unclassified",
  unknown: "Unclassified",
  other: "Unclassified",
  prospect: "Prospect",
  customer: "Customer",
  partner: "Partner",
  competitor: "Competitor",
  supplier: "Supplier / Vendor",
  "supplier / vendor": "Supplier / Vendor",
  vendor: "Supplier / Vendor",
  consultant: "Consultant",
  "service provider": "Service Provider",
  distributor: "Distributor",
  investor: "Investor",
  internal: "Internal Company",
  "internal company": "Internal Company",
  "government agency": "Public / Government",
  "public / government": "Public / Government",
  government: "Public / Government",
  public: "Public / Government",
  authority: "Granting Authority",
  "granting authority": "Granting Authority",
  "research organization": "University / Research",
  "university / research": "University / Research",
  university: "University / Research",
  research: "University / Research",
  association: "NGO / Non-Profit",
  "ngo / non-profit": "NGO / Non-Profit",
  ngo: "NGO / Non-Profit",
  "non-profit": "NGO / Non-Profit",
  nonprofit: "NGO / Non-Profit",
};

/** Primary filters surfaced in the companies workspace */
export const COMPANY_TYPE_QUICK_FILTERS: CompanyType[] = [
  "Customer",
  "Prospect",
  "Partner",
  "Competitor",
];

export type CompanyTypeFilter = "all" | CompanyType;

export function isCompanyType(value: string): value is CompanyType {
  return (DEFAULT_COMPANY_TYPES as readonly string[]).includes(value);
}

/** Canonicalize a stored type string (label, slug, or legacy enum). */
export function canonicalizeCompanyType(value: string): CompanyType | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isCompanyType(trimmed)) {
    // Prefer preset labels over legacy duplicates
    if (trimmed === "Supplier") return "Supplier / Vendor";
    if (trimmed === "Government Agency") return "Public / Government";
    if (trimmed === "Research Organization") return "University / Research";
    if (trimmed === "Authority") return "Granting Authority";
    if (trimmed === "Association") return "NGO / Non-Profit";
    return trimmed;
  }
  const alias = COMPANY_TYPE_ALIASES[trimmed.toLowerCase()];
  return alias ?? null;
}

export function getCompanyTypeMeta(type: string): {
  icon: CompanyTypeIconName;
  label: string;
  plural: string;
} {
  const canonical = canonicalizeCompanyType(type);
  if (canonical) return COMPANY_TYPE_META[canonical];
  return { icon: "other", label: type, plural: type };
}

