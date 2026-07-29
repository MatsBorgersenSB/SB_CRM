/**
 * Company classification — ecosystem role (Phase 6H + Growth Intelligence).
 * Companies may carry multiple types. Single Company entity for all roles.
 */

/** Primary selectable company type presets (multi-select). */
export type CompanyType =
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

/** Options shown in create/edit multi-select. */
export const COMPANY_TYPE_SELECT_OPTIONS: CompanyType[] = [
  "Prospect",
  "Customer",
  "Partner",
  "Competitor",
  "Supplier / Vendor",
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
  ...COMPANY_TYPE_SELECT_OPTIONS,
  "Supplier",
  "Association",
  "Research Organization",
  "Offtaker",
  "Government Agency",
  "Service Provider",
  "Consultant",
  "Distributor",
  "Authority",
  "Internal Company",
];

export const COMPANY_TYPE_META: Record<
  CompanyType,
  { emoji: string; label: string; plural: string }
> = {
  Prospect: { emoji: "🎯", label: "Prospect", plural: "Prospects" },
  Customer: { emoji: "👑", label: "Customer", plural: "Customers" },
  Partner: { emoji: "🤝", label: "Partner", plural: "Partners" },
  Competitor: { emoji: "⚔️", label: "Competitor", plural: "Competitors" },
  "Supplier / Vendor": { emoji: "🏭", label: "Supplier / Vendor", plural: "Suppliers / Vendors" },
  "Public / Government": {
    emoji: "🏛",
    label: "Public / Government",
    plural: "Public / Government",
  },
  "University / Research": {
    emoji: "🔬",
    label: "University / Research",
    plural: "Universities / Research",
  },
  Investor: { emoji: "🏦", label: "Investor", plural: "Investors" },
  "NGO / Non-Profit": { emoji: "🌿", label: "NGO / Non-Profit", plural: "NGOs / Non-Profits" },
  "Granting Authority": {
    emoji: "📜",
    label: "Granting Authority",
    plural: "Granting Authorities",
  },
  Supplier: { emoji: "🏭", label: "Supplier", plural: "Suppliers" },
  Association: { emoji: "🏛", label: "Association", plural: "Associations" },
  "Research Organization": {
    emoji: "🔬",
    label: "Research Organization",
    plural: "Research Organizations",
  },
  Offtaker: { emoji: "📦", label: "Offtaker", plural: "Offtakers" },
  "Government Agency": {
    emoji: "🏛",
    label: "Government Agency",
    plural: "Government Agencies",
  },
  "Service Provider": { emoji: "🛠", label: "Service Provider", plural: "Service Providers" },
  Consultant: { emoji: "💼", label: "Consultant", plural: "Consultants" },
  Distributor: { emoji: "🚚", label: "Distributor", plural: "Distributors" },
  Authority: { emoji: "🏛", label: "Authority", plural: "Authorities" },
  "Internal Company": { emoji: "🏢", label: "Internal Company", plural: "Internal Companies" },
};

/** Map legacy / slug / enum labels onto current presets. */
export const COMPANY_TYPE_ALIASES: Record<string, CompanyType> = {
  prospect: "Prospect",
  customer: "Customer",
  partner: "Partner",
  competitor: "Competitor",
  supplier: "Supplier / Vendor",
  "supplier / vendor": "Supplier / Vendor",
  vendor: "Supplier / Vendor",
  investor: "Investor",
  internal: "Internal Company",
  "internal company": "Internal Company",
  other: "Prospect",
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
  emoji: string;
  label: string;
  plural: string;
} {
  const canonical = canonicalizeCompanyType(type);
  if (canonical) return COMPANY_TYPE_META[canonical];
  return { emoji: "🏷️", label: type, plural: type };
}
