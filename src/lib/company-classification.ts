import type { Company } from "@/types/company";
import type { CompanyType, CompanyTypeFilter } from "@/types/company-type";
import {
  COMPANY_TYPE_META,
  DEFAULT_COMPANY_TYPES,
} from "@/types/company-type";
import type { RelationshipHealthStatus } from "@/lib/relationship-health-engine";

export type CompanyClassificationCount = {
  type: CompanyType;
  count: number;
  emoji: string;
  label: string;
};

export function normalizeCompanyTypes(
  company: Pick<Company, "CompanyTypes" | "Status">,
): CompanyType[] {
  if (company.CompanyTypes && company.CompanyTypes.length > 0) {
    return company.CompanyTypes;
  }
  if (company.Status === "Prospecting") return ["Prospect"];
  return ["Customer"];
}

export function companyHasType(company: Company, type: CompanyType): boolean {
  return normalizeCompanyTypes(company).includes(type);
}

export function formatCompanyTypesLabel(
  types: CompanyType[],
  options?: { max?: number },
): string {
  const max = options?.max ?? 3;
  const visible = types.slice(0, max);
  const labels = visible.map((type) => COMPANY_TYPE_META[type].label);
  const suffix = types.length > max ? ` +${types.length - max}` : "";
  return labels.join(" · ") + suffix;
}

export function formatCompanyTypesWithEmoji(types: CompanyType[]): string {
  return types
    .map((type) => `${COMPANY_TYPE_META[type].emoji} ${COMPANY_TYPE_META[type].label}`)
    .join(" · ");
}

export function companyTypeSearchKeywords(types: CompanyType[]): string[] {
  return types.flatMap((type) => {
    const meta = COMPANY_TYPE_META[type];
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
  for (const type of DEFAULT_COMPANY_TYPES) {
    counts.set(type, 0);
  }

  for (const company of companies) {
    for (const type of normalizeCompanyTypes(company)) {
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
  }

  return DEFAULT_COMPANY_TYPES.map((type) => ({
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
  if (/\bassociations?\b/.test(q)) return "Association";
  if (/\bofftakers?\b/.test(q)) return "Offtaker";
  if (/\bresearch organizations?\b/.test(q)) return "Research Organization";
  if (/\bgovernment agenc(y|ies)\b/.test(q)) return "Government Agency";
  if (/\bsuppliers?\b/.test(q)) return "Supplier";
  if (/\bcustomers?\b/.test(q)) return "Customer";
  if (/\bpartners?\b/.test(q)) return "Partner";
  if (/\bprospects?\b/.test(q)) return "Prospect";
  if (/\bdistributors?\b/.test(q)) return "Distributor";
  if (/\binvestors?\b/.test(q)) return "Investor";
  if (/\bconsultants?\b/.test(q)) return "Consultant";
  if (/\bauthorit(y|ies)\b/.test(q)) return "Authority";
  if (/\binternal companies?\b/.test(q)) return "Internal Company";
  if (/\bservice providers?\b/.test(q)) return "Service Provider";
  return null;
}

export function isStrategicCustomersQuery(query: string): boolean {
  return /\bstrategic customers?\b/.test(query.toLowerCase());
}
