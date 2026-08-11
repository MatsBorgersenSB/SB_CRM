import type { Company } from "@/types/company";
import type { CompanyType, CompanyTypeFilter } from "@/types/company-type";
import {
  COMPANY_TYPE_META,
  COMPANY_TYPE_SELECT_OPTIONS,
  canonicalizeCompanyType,
  DEFAULT_COMPANY_TYPES,
  getCompanyTypeMeta,
} from "@/types/company-type";
import type { RelationshipHealthStatus } from "@/lib/relationship-health-engine";

export type CompanyClassificationCount = {
  type: CompanyType;
  count: number;
  emoji: string;
  label: string;
};

/**
 * Relationship posture — drives SmartAssist behaviour.
 * Ask "what kind of relationship?" before "where is the opportunity?"
 */
export type CompanyRelationshipPosture =
  | "sell_to"
  | "buy_from"
  | "collaborate"
  | "watch"
  | "fund"
  | "internal"
  | "unclassified";

/** Commercial targets — opportunities may be recommended. */
export const SELL_TO_COMPANY_TYPES: CompanyType[] = [
  "Customer",
  "Prospect",
  "Offtaker",
];

/** Buy-from / inbound supply — never invent sales opportunities. */
export const BUY_FROM_COMPANY_TYPES: CompanyType[] = [
  "Supplier / Vendor",
  "Consultant",
  "Service Provider",
];

const COLLABORATE_TYPES: CompanyType[] = [
  "Partner",
  "University / Research",
  "Public / Government",
  "NGO / Non-Profit",
  "Granting Authority",
  "Association",
  "Distributor",
];

const WATCH_TYPES: CompanyType[] = ["Competitor"];
const FUND_TYPES: CompanyType[] = ["Investor"];
const INTERNAL_TYPES: CompanyType[] = ["Internal Company"];

export function normalizeCompanyTypes(
  company: Pick<Company, "CompanyTypes" | "companyType" | "Status">,
): CompanyType[] {
  const raw = [
    ...(company.CompanyTypes ?? []),
    ...(company.companyType ? [company.companyType] : []),
  ];

  const canonical: CompanyType[] = [];
  for (const value of raw) {
    const next = canonicalizeCompanyType(String(value));
    if (next && !canonical.includes(next)) canonical.push(next);
  }

  // Drop Unclassified when real roles are present.
  const concrete = canonical.filter((type) => type !== "Unclassified");
  if (concrete.length > 0) return concrete;

  if (canonical.includes("Unclassified")) return ["Unclassified"];
  // Reality First — Prospecting status is an explicit commercial signal.
  if (company.Status === "Prospecting") return ["Prospect"];
  // Never invent Customer. Unknown stays Unclassified.
  return ["Unclassified"];
}

/** Persistable labels for Prisma `types` String[]. */
export function toStoredCompanyTypes(types: CompanyType[] | undefined): string[] {
  const normalized = (types ?? [])
    .map((type) => canonicalizeCompanyType(type))
    .filter((type): type is CompanyType => Boolean(type))
    .filter((type) => type !== "Unclassified");
  const unique = [...new Set(normalized)];
  return unique.length > 0 ? unique : ["Unclassified"];
}

export function companyHasType(company: Company, type: CompanyType): boolean {
  const target = canonicalizeCompanyType(type) ?? type;
  return normalizeCompanyTypes(company).some(
    (entry) => entry === target || canonicalizeCompanyType(entry) === target,
  );
}

export function isCompanyUnclassified(
  company: Pick<Company, "CompanyTypes" | "companyType" | "Status">,
): boolean {
  const types = normalizeCompanyTypes(company);
  return types.length === 1 && types[0] === "Unclassified";
}

/**
 * Primary relationship posture for UI + SmartAssist.
 * Multi-type: sell-to wins, then buy-from, then collaborate / watch / fund.
 */
export function getCompanyRelationshipPosture(
  company: Pick<Company, "CompanyTypes" | "companyType" | "Status">,
): CompanyRelationshipPosture {
  const types = normalizeCompanyTypes(company);
  if (types.length === 0 || (types.length === 1 && types[0] === "Unclassified")) {
    return "unclassified";
  }
  if (types.some((type) => SELL_TO_COMPANY_TYPES.includes(type))) return "sell_to";
  if (types.some((type) => BUY_FROM_COMPANY_TYPES.includes(type))) return "buy_from";
  if (types.some((type) => COLLABORATE_TYPES.includes(type))) return "collaborate";
  if (types.some((type) => WATCH_TYPES.includes(type))) return "watch";
  if (types.some((type) => FUND_TYPES.includes(type))) return "fund";
  if (types.some((type) => INTERNAL_TYPES.includes(type))) return "internal";
  return "unclassified";
}

export function formatRelationshipPostureLabel(
  posture: CompanyRelationshipPosture,
): string {
  switch (posture) {
    case "sell_to":
      return "Commercial target";
    case "buy_from":
      return "Supplier / advisor";
    case "collaborate":
      return "Partner / collaborator";
    case "watch":
      return "Competitor";
    case "fund":
      return "Investor";
    case "internal":
      return "Internal";
    case "unclassified":
      return "Unclassified";
  }
}

/**
 * Reality First — only surface "create opportunity" for sell-to roles.
 * Partner / supplier / unclassified alone must never be nagged to open deals
 * unless also typed as Customer / Prospect / Offtaker.
 */
export function isOpportunityEligibleCompany(
  company: Pick<Company, "CompanyTypes" | "companyType" | "Status">,
): boolean {
  const types = normalizeCompanyTypes(company);
  return types.some((type) => SELL_TO_COMPANY_TYPES.includes(type));
}

export function formatCompanyTypesLabel(
  types: CompanyType[],
  options?: { max?: number },
): string {
  const max = options?.max ?? 3;
  const visible = types.slice(0, max);
  const labels = visible.map((type) => getCompanyTypeMeta(type).label);
  const suffix = types.length > max ? ` +${types.length - max}` : "";
  return labels.join(" · ") + suffix;
}

export function formatCompanyTypesWithEmoji(types: CompanyType[]): string {
  return types
    .map((type) => {
      const meta = getCompanyTypeMeta(type);
      return `${meta.emoji} ${meta.label}`;
    })
    .join(" · ");
}

export function companyTypeSearchKeywords(types: CompanyType[]): string[] {
  return types.flatMap((type) => {
    const meta = getCompanyTypeMeta(type);
    return [type, meta.label, meta.plural, meta.label.toLowerCase(), meta.plural.toLowerCase()];
  });
}

export function filterCompaniesByType(
  companies: Company[],
  filter: CompanyTypeFilter,
): Company[] {
  if (filter === "all") return companies;
  return companies.filter((company) => companyHasType(company, filter));
}

export function buildCompanyClassificationReport(
  companies: Company[],
): CompanyClassificationCount[] {
  const counts = new Map<CompanyType, number>();
  for (const type of COMPANY_TYPE_SELECT_OPTIONS) {
    counts.set(type, 0);
  }
  counts.set("Unclassified", 0);

  for (const company of companies) {
    for (const type of normalizeCompanyTypes(company)) {
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
  }

  const reportTypes: CompanyType[] = ["Unclassified", ...COMPANY_TYPE_SELECT_OPTIONS];
  return reportTypes
    .map((type) => ({
      type,
      count: counts.get(type) ?? 0,
      emoji: COMPANY_TYPE_META[type].emoji,
      label: COMPANY_TYPE_META[type].plural,
    }))
    .filter((entry) => entry.count > 0);
}

export function isStrategicCustomer(
  company: Company,
  healthStatus?: RelationshipHealthStatus,
  healthScore?: number,
): boolean {
  if (!companyHasType(company, "Customer")) return false;
  if (healthStatus === "Strategic") return true;
  if (typeof healthScore === "number" && healthScore >= 80) return true;
  return false;
}

export function matchCompanyTypeQuery(query: string): CompanyType | null {
  const q = query.toLowerCase();
  if (/\bunclassified\b|\bunknown (compan(y|ies)|roles?)\b/.test(q)) return "Unclassified";
  if (/\bcompetitors?\b/.test(q)) return "Competitor";
  if (/\b(ngos?|non[- ]?profits?|associations?)\b/.test(q)) return "NGO / Non-Profit";
  if (/\bofftakers?\b/.test(q)) return "Offtaker";
  if (/\b(universit(y|ies)|research organizations?)\b/.test(q)) return "University / Research";
  if (/\b(public|government agenc(y|ies)|government)\b/.test(q)) return "Public / Government";
  if (/\b(granting authorit(y|ies)|authorit(y|ies))\b/.test(q)) return "Granting Authority";
  if (/\b(suppliers?|vendors?)\b/.test(q)) return "Supplier / Vendor";
  if (/\bcustomers?\b/.test(q)) return "Customer";
  if (/\bpartners?\b/.test(q)) return "Partner";
  if (/\bprospects?\b/.test(q)) return "Prospect";
  if (/\bdistributors?\b/.test(q)) return "Distributor";
  if (/\binvestors?\b/.test(q)) return "Investor";
  if (/\bconsultants?\b/.test(q)) return "Consultant";
  if (/\binternal companies?\b/.test(q)) return "Internal Company";
  if (/\bservice providers?\b/.test(q)) return "Service Provider";
  return null;
}

export function isStrategicCustomersQuery(query: string): boolean {
  return /\bstrategic customers?\b/.test(query.toLowerCase());
}

export function listSelectableCompanyTypes(): CompanyType[] {
  return [...COMPANY_TYPE_SELECT_OPTIONS];
}

/** @deprecated Prefer COMPANY_TYPE_SELECT_OPTIONS */
export { DEFAULT_COMPANY_TYPES };
