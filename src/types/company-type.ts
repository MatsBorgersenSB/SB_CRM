/**
 * Company classification — ecosystem role (Phase 6H + Growth Intelligence).
 * Companies may carry multiple types. Single Company entity for all roles.
 */

export type CompanyType =
  | "Customer"
  | "Prospect"
  | "Competitor"
  | "Partner"
  | "Supplier"
  | "Investor"
  | "Association"
  | "Research Organization"
  | "Offtaker"
  | "Government Agency"
  | "Service Provider"
  | "Consultant"
  | "Distributor"
  | "Authority"
  | "Internal Company";

/** Primary growth-intelligence ecosystem types */
export const GROWTH_ECOSYSTEM_TYPES: CompanyType[] = [
  "Customer",
  "Prospect",
  "Competitor",
  "Partner",
  "Supplier",
  "Investor",
  "Association",
  "Research Organization",
  "Offtaker",
  "Government Agency",
];

export const DEFAULT_COMPANY_TYPES: CompanyType[] = [
  ...GROWTH_ECOSYSTEM_TYPES,
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
  Customer: { emoji: "👑", label: "Customer", plural: "Customers" },
  Prospect: { emoji: "🎯", label: "Prospect", plural: "Prospects" },
  Competitor: { emoji: "⚔️", label: "Competitor", plural: "Competitors" },
  Partner: { emoji: "🤝", label: "Partner", plural: "Partners" },
  Supplier: { emoji: "🏭", label: "Supplier", plural: "Suppliers" },
  Investor: { emoji: "🏦", label: "Investor", plural: "Investors" },
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
