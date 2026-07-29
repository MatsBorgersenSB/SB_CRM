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

  if (canonical.length > 0) return canonical;
  if (company.Status === "Prospecting") return ["Prospect"];
  return ["Customer"];
}

/** Persistable labels for Prisma `types` String[]. */
export function toStoredCompanyTypes(types: CompanyType[] | undefined): string[] {
  const normalized = (types ?? [])
    .map((type) => canonicalizeCompanyType(type))
    .filter((type): type is CompanyType => Boolean(type));
  const unique = [...new Set(normalized)];
  return unique.length > 0 ? unique : ["Prospect"];
}

export function companyHasType(company: Company, type: CompanyType): boolean {
  const target = canonicalizeCompanyType(type) ?? type;
  return normalizeCompanyTypes(company).some(
    (entry) => entry === target || canonicalizeCompanyType(entry) === target,
  );
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

  for (const company of companies) {
    for (const type of normalizeCompanyTypes(company)) {
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
  }

  return COMPANY_TYPE_SELECT_OPTIONS.map((type) => ({
    type,
    count: counts.get(type) ?? 0,
    emoji: COMPANY_TYPE_META[type].emoji,
    label: COMPANY_TYPE_META[type].plural,
  })).filter((entry) => entry.count > 0);
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
