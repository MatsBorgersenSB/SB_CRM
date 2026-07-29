import { getActivitiesForCompany, isFollowUpOpen, isFollowUpOverdue } from "@/lib/activity-utils";
import { buildCompanyAttentionItems } from "@/lib/smart-attention-engine";
import { buildCompanySummariesForCompanies } from "@/lib/relationship-intelligence";
import { daysBetween } from "@/lib/relative-time";
import type { Activity } from "@/types/activity";
import type { AuthUser } from "@/types/auth";
import type { AttentionItem, AttentionSeverity } from "@/types/attention-item";
import { SEVERITY_RANK } from "@/types/attention-item";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import { formatCompanyLocation } from "@/types/company";
import type { CompanyType, CompanyTypeFilter } from "@/types/company-type";
import { COMPANY_TYPE_META, COMPANY_TYPE_QUICK_FILTERS } from "@/types/company-type";
import {
  buildCompanyClassificationReport,
  formatCompanyTypesLabel,
  normalizeCompanyTypes,
  type CompanyClassificationCount,
} from "@/lib/company-classification";
import { company360Href } from "@/types/company-360";
import type { PipelineRow } from "@/types/pipeline";
import { formatDealValue } from "@/types/pipeline";
import type { RelationshipHealthStatus } from "@/lib/relationship-health-engine";

const COLD_CONTACT_DAYS = 45;
const HEALTHY_STATUSES = new Set<RelationshipHealthStatus>(["Strategic", "Strong", "Healthy"]);

export const COMPANY_TYPE_FILTERS: Array<{
  id: CompanyTypeFilter;
  label: string;
}> = [
  { id: "all", label: "All Types" },
  ...COMPANY_TYPE_QUICK_FILTERS.map((type) => ({
    id: type as CompanyTypeFilter,
    label: COMPANY_TYPE_META[type].plural,
  })),
];

export type CompanyOperationsFilter =
  | "all"
  | "my_companies"
  | "needs_attention"
  | "healthy"
  | "weak"
  | "strategic_accounts"
  | "active_opportunities"
  | "no_opportunities"
  | "no_recent_activity";

export type CompanyAttentionFilter =
  | "all"
  | "no_contact"
  | "weak_health"
  | "missing_stakeholders"
  | "no_opportunities"
  | "overdue_commitments";

export const COMPANY_OPERATIONS_FILTERS: Array<{
  id: CompanyOperationsFilter;
  label: string;
}> = [
  { id: "all", label: "All Companies" },
  { id: "my_companies", label: "My Companies" },
  { id: "needs_attention", label: "Needs Attention" },
  { id: "healthy", label: "Healthy" },
  { id: "weak", label: "Weak" },
  { id: "strategic_accounts", label: "Strategic Accounts" },
  { id: "active_opportunities", label: "Active Opportunities" },
  { id: "no_opportunities", label: "No Opportunities" },
  { id: "no_recent_activity", label: "No Recent Activity" },
];

export const COMPANY_ATTENTION_FILTERS: Array<{
  id: CompanyAttentionFilter;
  label: string;
}> = [
  { id: "all", label: "All attention" },
  { id: "no_contact", label: "No Contact" },
  { id: "weak_health", label: "Weak Health" },
  { id: "missing_stakeholders", label: "Missing Stakeholders" },
  { id: "no_opportunities", label: "No Opportunities" },
  { id: "overdue_commitments", label: "Overdue Commitments" },
];

export type CompanyOperationsRow = {
  companyId: string;
  companyName: string;
  companyTypes: CompanyType[];
  companyTypesLabel: string;
  ownerLabel: string | null;
  locationLabel: string;
  healthScore: number;
  healthStatus: RelationshipHealthStatus;
  openOpportunities: number;
  pipelineValue: number;
  pipelineValueLabel: string;
  lastContactLabel: string;
  attentionSeverity: AttentionSeverity;
  attentionLabel: string;
  attentionRuleId: string | null;
  companyHref: string;
  opportunitiesHref: string;
  ownerQueueHref: string | null;
  needsAttention: boolean;
  isHealthy: boolean;
  isWeak: boolean;
  isStrategic: boolean;
  hasActiveOpportunities: boolean;
  hasNoOpportunities: boolean;
  isColdContact: boolean;
  isOwnedByUser: boolean;
  hasMissingStakeholders: boolean;
  hasOverdueCommitments: boolean;
  matchesNoContactAttention: boolean;
  matchesWeakHealthAttention: boolean;
};

export type CompanyOperationsSummary = {
  totalCompanies: number;
  needsAttentionCount: number;
  noRecentActivityCount: number;
  totalOpenOpportunities: number;
  classification: CompanyClassificationCount[];
};

export type CompanyOperationsWorkspace = {
  rows: CompanyOperationsRow[];
  summary: CompanyOperationsSummary;
};

function isOpenOpportunity(deal: PipelineRow | undefined): boolean {
  return Boolean(
    deal && deal.status !== "Live Production" && deal.status !== "Scheduled Maintenance",
  );
}

function pickTopAttentionItem(items: AttentionItem[]): AttentionItem | null {
  if (items.length === 0) return null;
  return [...items].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  )[0]!;
}

function attentionFromCompany(
  topItem: AttentionItem | null,
  healthStatus: RelationshipHealthStatus,
  healthScore: number,
): {
  severity: AttentionSeverity;
  label: string;
  needsAttention: boolean;
  ruleId: string | null;
} {
  if (topItem && SEVERITY_RANK[topItem.severity] <= SEVERITY_RANK.needs_attention) {
    return {
      severity: topItem.severity,
      label: topItem.suggestedAiAction,
      needsAttention: true,
      ruleId: topItem.ruleId ?? null,
    };
  }

  if (healthStatus === "At Risk" || healthScore < 50) {
    return {
      severity: healthScore < 30 ? "urgent" : "needs_attention",
      label: topItem?.suggestedAiAction ?? "Strengthen relationship health",
      needsAttention: true,
      ruleId: topItem?.ruleId ?? "risk_threshold_exceeded",
    };
  }

  if (healthStatus === "Weak") {
    return {
      severity: "needs_attention",
      label: topItem?.suggestedAiAction ?? "Relationship needs attention",
      needsAttention: true,
      ruleId: topItem?.ruleId ?? "weak_health",
    };
  }

  if (topItem) {
    return {
      severity: topItem.severity,
      label: topItem.suggestedAiAction,
      needsAttention: topItem.severity === "urgent" || topItem.severity === "needs_attention",
      ruleId: topItem.ruleId ?? null,
    };
  }

  return {
    severity: "healthy",
    label: "On track",
    needsAttention: false,
    ruleId: null,
  };
}

export function buildCompanyOperationsWorkspace(
  companies: Company[],
  pipelines: PipelineRow[],
  activities: Activity[],
  commercialPackages: CommercialPackage[],
  user: AuthUser,
): CompanyOperationsWorkspace {
  const summaries = buildCompanySummariesForCompanies(companies, activities, pipelines);

  const rows = summaries.map((summary) => {
    const { company, healthScore, healthStatus, lastContactLabel } = summary;
    const ownerLabel = company.AccountOwner?.Title ?? null;

    const openDeals = company.pipelineIds
      .map((id) => pipelines.find((deal) => deal.id === id))
      .filter(isOpenOpportunity);

    const pipelineValue = openDeals.reduce((sum, deal) => sum + (deal?.salesValue ?? 0), 0);
    const dominantCurrency = openDeals.find((deal) => deal?.currency)?.currency ?? "EUR";

    const companyActivities = getActivitiesForCompany(activities, company);
    const lastActivity = companyActivities.sort(
      (a, b) => new Date(b.ActivityDate).getTime() - new Date(a.ActivityDate).getTime(),
    )[0];
    const daysSinceContact = lastActivity ? daysBetween(lastActivity.ActivityDate) : Infinity;
    const isColdContact = daysSinceContact >= COLD_CONTACT_DAYS;

    const hasOverdueCommitments = companyActivities.some(
      (activity) => isFollowUpOpen(activity) && isFollowUpOverdue(activity),
    );
    const hasMissingStakeholders = company.contacts.length === 0;

    const attentionItems = buildCompanyAttentionItems(
      company,
      pipelines,
      activities,
      commercialPackages,
      companies,
    );
    const topAttention = pickTopAttentionItem(attentionItems);
    const attention = attentionFromCompany(topAttention, healthStatus, healthScore);

    const openOpportunities = openDeals.length;
    const isOwnedByUser =
      ownerLabel !== null && ownerLabel.toLowerCase() === user.displayName.toLowerCase();

    const matchesNoContactAttention =
      attention.ruleId === "no_recent_contact" ||
      attention.ruleId === "no_activity" ||
      isColdContact;

    const matchesWeakHealthAttention =
      healthStatus === "Weak" ||
      healthStatus === "At Risk" ||
      attention.ruleId === "risk_threshold_exceeded";

    return {
      companyId: company.CompanyID,
      companyName: company.Title,
      companyTypes: normalizeCompanyTypes(company),
      companyTypesLabel: formatCompanyTypesLabel(normalizeCompanyTypes(company)),
      ownerLabel,
      locationLabel: formatCompanyLocation(company),
      healthScore,
      healthStatus,
      openOpportunities,
      pipelineValue,
      pipelineValueLabel:
        openOpportunities > 0 ? formatDealValue(dominantCurrency, pipelineValue) : "—",
      lastContactLabel,
      attentionSeverity: attention.severity,
      attentionLabel: attention.label,
      attentionRuleId: attention.ruleId,
      companyHref: company360Href(company),
      opportunitiesHref: company360Href(company, "opportunities"),
      ownerQueueHref: ownerLabel ? `/?owner=${encodeURIComponent(ownerLabel)}` : null,
      needsAttention: attention.needsAttention,
      isHealthy: HEALTHY_STATUSES.has(healthStatus) && !attention.needsAttention,
      isWeak: healthStatus === "Weak" || healthStatus === "At Risk",
      isStrategic: healthStatus === "Strategic",
      hasActiveOpportunities: openOpportunities > 0,
      hasNoOpportunities: openOpportunities === 0,
      isColdContact,
      isOwnedByUser,
      hasMissingStakeholders,
      hasOverdueCommitments,
      matchesNoContactAttention,
      matchesWeakHealthAttention,
    };
  });

  const summary: CompanyOperationsSummary = {
    totalCompanies: rows.length,
    needsAttentionCount: rows.filter((row) => row.needsAttention).length,
    noRecentActivityCount: rows.filter((row) => row.isColdContact).length,
    totalOpenOpportunities: rows.reduce((sum, row) => sum + row.openOpportunities, 0),
    classification: buildCompanyClassificationReport(companies),
  };

  return { rows, summary };
}

export function filterCompanyOperationsByTypes(
  rows: CompanyOperationsRow[],
  types: string[],
): CompanyOperationsRow[] {
  if (types.length === 0) return rows;
  return rows.filter((row) =>
    types.some((type) => row.companyTypes.includes(type as CompanyType)),
  );
}

export function filterCompanyOperationsByOwner(
  rows: CompanyOperationsRow[],
  owner: string,
): CompanyOperationsRow[] {
  if (!owner || owner === "all") return rows;
  const needle = owner.toLowerCase();
  return rows.filter((row) => row.ownerLabel?.toLowerCase() === needle);
}

export function searchCompanyOperationsRows(
  rows: CompanyOperationsRow[],
  query: string,
): CompanyOperationsRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (row) =>
      row.companyName.toLowerCase().includes(q) ||
      row.locationLabel.toLowerCase().includes(q) ||
      row.companyTypesLabel.toLowerCase().includes(q) ||
      (row.ownerLabel?.toLowerCase().includes(q) ?? false),
  );
}

export function filterCompanyOperationsByHealth(
  rows: CompanyOperationsRow[],
  health: string,
): CompanyOperationsRow[] {
  if (!health || health === "all") return rows;
  switch (health) {
    case "healthy":
      return rows.filter((row) => row.isHealthy);
    case "weak":
      return rows.filter((row) => row.isWeak);
    case "strategic":
      return rows.filter((row) => row.isStrategic);
    default:
      return rows;
  }
}

export function filterCompanyOperationsByType(
  rows: CompanyOperationsRow[],
  typeFilter: CompanyTypeFilter,
): CompanyOperationsRow[] {
  if (typeFilter === "all") return rows;
  return rows.filter((row) => row.companyTypes.includes(typeFilter));
}

export function filterCompanyOperationsRows(
  rows: CompanyOperationsRow[],
  filter: CompanyOperationsFilter,
): CompanyOperationsRow[] {
  switch (filter) {
    case "my_companies":
      return rows.filter((row) => row.isOwnedByUser);
    case "needs_attention":
      return rows.filter((row) => row.needsAttention);
    case "healthy":
      return rows.filter((row) => row.isHealthy);
    case "weak":
      return rows.filter((row) => row.isWeak);
    case "strategic_accounts":
      return rows.filter((row) => row.isStrategic);
    case "active_opportunities":
      return rows.filter((row) => row.hasActiveOpportunities);
    case "no_opportunities":
      return rows.filter((row) => row.hasNoOpportunities);
    case "no_recent_activity":
      return rows.filter((row) => row.isColdContact);
    case "all":
    default:
      return rows;
  }
}

export function filterCompanyOperationsByAttention(
  rows: CompanyOperationsRow[],
  attentionFilter: CompanyAttentionFilter,
): CompanyOperationsRow[] {
  switch (attentionFilter) {
    case "no_contact":
      return rows.filter((row) => row.matchesNoContactAttention);
    case "weak_health":
      return rows.filter((row) => row.matchesWeakHealthAttention);
    case "missing_stakeholders":
      return rows.filter((row) => row.hasMissingStakeholders);
    case "no_opportunities":
      return rows.filter((row) => row.hasNoOpportunities);
    case "overdue_commitments":
      return rows.filter((row) => row.hasOverdueCommitments);
    case "all":
    default:
      return rows;
  }
}

export function sortCompanyOperationsRows(rows: CompanyOperationsRow[]): CompanyOperationsRow[] {
  return [...rows].sort((a, b) => {
    const attentionDiff = SEVERITY_RANK[a.attentionSeverity] - SEVERITY_RANK[b.attentionSeverity];
    if (attentionDiff !== 0) return attentionDiff;
    if (a.healthScore !== b.healthScore) return a.healthScore - b.healthScore;
    return a.companyName.localeCompare(b.companyName);
  });
}
