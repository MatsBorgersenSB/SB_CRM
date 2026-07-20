import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow, PipelineStatus } from "@/types/pipeline";
import { getLifecycleStage } from "@/types/pipeline";
import {
  getActivitiesForCompany,
  isFollowUpOpen,
  isFollowUpOverdue,
} from "@/lib/activity-utils";
import {
  computeRelationshipHealth,
  type RelationshipHealthStatus,
  type RelationshipTrend,
} from "@/lib/relationship-health-engine";
import type { RecommendedAction } from "@/lib/next-best-action-engine";
import { daysBetween } from "@/lib/relative-time";
import { company360Href } from "@/types/company-360";
import { buildSmartDocsIntelligence, type SmartDocsIntelligenceSnapshot } from "@/lib/smartdocs-intelligence-data";
import {
  buildRelationshipGraphIntelligence,
  type RelationshipGraphIntelligenceSnapshot,
} from "@/lib/relationship-graph-intelligence-data";

export type IntelligenceCenterItem = {
  id: string;
  companyId: string;
  companyName: string;
  healthScore: number;
  healthStatus: RelationshipHealthStatus;
  trend: RelationshipTrend;
  nextBestAction: string;
  reason: string;
  action: RecommendedAction;
  href: string;
  subtitle: string;
};

export type IntelligenceCenterStalledDeal = IntelligenceCenterItem & {
  dealId: string;
  dealName: string;
  dealStage: PipelineStatus;
  daysStalled: number;
};

export type IntelligenceCenterCommitment = IntelligenceCenterItem & {
  commitmentLabel: string;
  dueLabel: string;
  isOverdue: boolean;
};

export type IntelligenceCenterOverview = {
  totalCompanies: number;
  atRiskCount: number;
  strategicCount: number;
  improvingCount: number;
  decliningCount: number;
  openCommitments: number;
  stalledDeals: number;
  averageHealthScore: number;
};

export type IntelligenceCenterHealthTrends = {
  statusDistribution: Array<{ status: RelationshipHealthStatus; count: number }>;
  trendDistribution: Array<{ trend: RelationshipTrend; count: number }>;
  improving: IntelligenceCenterItem[];
  declining: IntelligenceCenterItem[];
  narrative: string;
};

export type IntelligenceCenterSnapshot = {
  generatedAt: string;
  overview: IntelligenceCenterOverview;
  relationshipsAtRisk: IntelligenceCenterItem[];
  stalledOpportunities: IntelligenceCenterStalledDeal[];
  fastestGrowing: IntelligenceCenterItem[];
  strategicAccounts: IntelligenceCenterItem[];
  openCommitments: IntelligenceCenterCommitment[];
  healthTrends: IntelligenceCenterHealthTrends;
  smartDocs: SmartDocsIntelligenceSnapshot;
  relationshipGraph: RelationshipGraphIntelligenceSnapshot;
};

const STALLED_DAYS = 21;
const HEALTH_STATUSES: RelationshipHealthStatus[] = [
  "Strategic",
  "Strong",
  "Healthy",
  "Weak",
  "At Risk",
];
const TRENDS: RelationshipTrend[] = ["Improving", "Stable", "Declining"];

function parseActivityDate(value: string): Date {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(normalized);
}

function activitiesInWindow(activities: Activity[], start: number, end: number): number {
  return activities.filter((a) => {
    const days = daysBetween(a.ActivityDate);
    return days >= start && days < end;
  }).length;
}

function activityGrowth(company: Company, activities: Activity[]): number {
  const companyActs = getActivitiesForCompany(activities, company);
  const recent = activitiesInWindow(companyActs, 0, 30);
  const prior = activitiesInWindow(companyActs, 30, 60);
  return recent - prior;
}

function buildBaseItem(
  company: Company,
  healthReport: ReturnType<typeof computeRelationshipHealth>,
  subtitle: string,
): IntelligenceCenterItem {
  const action = healthReport.recommendedAction;
  return {
    id: company.CompanyID,
    companyId: company.CompanyID,
    companyName: company.Title,
    healthScore: healthReport.score,
    healthStatus: healthReport.status,
    trend: healthReport.trend,
    nextBestAction: action.action,
    reason: action.reason,
    action,
    href: company360Href(company.CompanyID, "attention"),
    subtitle,
  };
}

function buildStalledDeals(
  companies: Company[],
  activities: Activity[],
  pipelines: PipelineRow[],
): IntelligenceCenterStalledDeal[] {
  const items: IntelligenceCenterStalledDeal[] = [];

  for (const company of companies) {
    const healthReport = computeRelationshipHealth(company, activities, pipelines);
    const companyActs = getActivitiesForCompany(activities, company);

    for (const dealId of company.pipelineIds) {
      const deal = pipelines.find((p) => p.id === dealId);
      if (!deal || ["Live Production", "Scheduled Maintenance"].includes(deal.status)) {
        continue;
      }

      const last = companyActs
        .filter((a) => a.Deal?.Title === dealId)
        .sort(
          (a, b) =>
            parseActivityDate(b.ActivityDate).getTime() -
            parseActivityDate(a.ActivityDate).getTime(),
        )[0];

      const daysStalled = last ? daysBetween(last.ActivityDate) : STALLED_DAYS + 1;
      if (daysStalled < STALLED_DAYS) continue;

      items.push({
        ...buildBaseItem(
          company,
          healthReport,
          `${deal.assetName} · ${deal.status} · ${daysStalled}d without activity`,
        ),
        id: `stalled-${dealId}-${company.CompanyID}`,
        dealId,
        dealName: deal.assetName,
        dealStage: deal.status,
        daysStalled,
        href: company360Href(company.CompanyID, "opportunities"),
      });
    }
  }

  const byDealId = new Map<string, IntelligenceCenterStalledDeal>();
  for (const item of items) {
    const existing = byDealId.get(item.dealId);
    if (!existing || item.daysStalled > existing.daysStalled) {
      byDealId.set(item.dealId, item);
    }
  }

  return Array.from(byDealId.values())
    .sort((a, b) => b.daysStalled - a.daysStalled)
    .slice(0, 8);
}

function buildOpenCommitments(
  companies: Company[],
  activities: Activity[],
  pipelines: PipelineRow[],
): IntelligenceCenterCommitment[] {
  const items: IntelligenceCenterCommitment[] = [];

  for (const company of companies) {
    const healthReport = computeRelationshipHealth(company, activities, pipelines);
    const open = getActivitiesForCompany(activities, company).filter(isFollowUpOpen);

    for (const activity of open) {
      const overdue = isFollowUpOverdue(activity);
      items.push({
        ...buildBaseItem(
          company,
          healthReport,
          activity.NextAction || activity.Subject,
        ),
        id: `commitment-${activity.ActivityID}`,
        commitmentLabel: activity.NextAction || activity.Subject,
        dueLabel: activity.NextActionDate
          ? overdue
            ? `Overdue ${daysBetween(activity.NextActionDate)}d`
            : `Due in ${daysBetween(activity.NextActionDate)}d`
          : "No due date",
        isOverdue: overdue,
        href: `/activities/${activity.ActivityID}`,
      });
    }
  }

  return items
    .sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      return a.healthScore - b.healthScore;
    })
    .slice(0, 8);
}

function buildHealthTrends(
  items: IntelligenceCenterItem[],
): IntelligenceCenterHealthTrends {
  const statusDistribution = HEALTH_STATUSES.map((status) => ({
    status,
    count: items.filter((i) => i.healthStatus === status).length,
  }));

  const trendDistribution = TRENDS.map((trend) => ({
    trend,
    count: items.filter((i) => i.trend === trend).length,
  }));

  const improving = items
    .filter((i) => i.trend === "Improving")
    .slice(0, 5);

  const declining = items
    .filter((i) => i.trend === "Declining")
    .sort((a, b) => a.healthScore - b.healthScore)
    .slice(0, 5);

  const improvingCount = trendDistribution.find((t) => t.trend === "Improving")?.count ?? 0;
  const decliningCount = trendDistribution.find((t) => t.trend === "Declining")?.count ?? 0;
  const atRisk = statusDistribution.find((s) => s.status === "At Risk")?.count ?? 0;

  const narrative =
    decliningCount > improvingCount
      ? `${decliningCount} relationships declining vs ${improvingCount} improving — prioritize at-risk accounts (${atRisk} at risk).`
      : improvingCount > 0
        ? `${improvingCount} relationships gaining momentum — protect strategic accounts while addressing ${atRisk} at-risk.`
        : `Portfolio stable — ${items.length} relationships tracked, ${atRisk} require intervention.`;

  return {
    statusDistribution,
    trendDistribution,
    improving,
    declining,
    narrative,
  };
}

export function buildIntelligenceCenter(
  companies: Company[],
  pipelines: PipelineRow[],
  activities: Activity[],
): IntelligenceCenterSnapshot {
  const allItems: IntelligenceCenterItem[] = companies.map((company) => {
    const healthReport = computeRelationshipHealth(company, activities, pipelines);
    const companyActs = getActivitiesForCompany(activities, company);
    const openCount = companyActs.filter(isFollowUpOpen).length;
    const last = [...companyActs].sort(
      (a, b) =>
        parseActivityDate(b.ActivityDate).getTime() -
        parseActivityDate(a.ActivityDate).getTime(),
    )[0];
    const lastLabel = last ? `${daysBetween(last.ActivityDate)}d ago` : "No contact";

    return buildBaseItem(
      company,
      healthReport,
      `Last contact ${lastLabel} · ${openCount} open commitment${openCount === 1 ? "" : "s"}`,
    );
  });

  const relationshipsAtRisk = allItems
    .filter((i) => i.healthStatus === "At Risk" || i.healthStatus === "Weak" || i.healthScore < 50)
    .sort((a, b) => a.healthScore - b.healthScore)
    .slice(0, 8);

  const stalledOpportunities = buildStalledDeals(companies, activities, pipelines);

  const fastestGrowing = [...allItems]
    .map((item) => ({
      item,
      growth: activityGrowth(
        companies.find((c) => c.CompanyID === item.companyId)!,
        activities,
      ),
    }))
    .filter(({ item, growth }) => item.trend === "Improving" || growth > 0)
    .sort((a, b) => b.growth - a.growth || b.item.healthScore - a.item.healthScore)
    .map(({ item, growth }) => ({
      ...item,
      subtitle: `+${growth} activities vs prior 30 days · ${item.subtitle}`,
    }))
    .slice(0, 8);

  const strategicAccounts = allItems
    .filter((i) => i.healthStatus === "Strategic" || i.healthScore >= 90)
    .sort((a, b) => b.healthScore - a.healthScore)
    .slice(0, 8);

  const openCommitments = buildOpenCommitments(companies, activities, pipelines);

  const healthTrends = buildHealthTrends(allItems);
  const smartDocs = buildSmartDocsIntelligence(pipelines, companies, activities);
  const relationshipGraph = buildRelationshipGraphIntelligence(companies, pipelines, activities);

  const averageHealthScore =
    allItems.length === 0
      ? 0
      : Math.round(
          allItems.reduce((sum, i) => sum + i.healthScore, 0) / allItems.length,
        );

  return {
    generatedAt: new Date().toISOString(),
    overview: {
      totalCompanies: companies.length,
      atRiskCount: allItems.filter(
        (i) => i.healthStatus === "At Risk" || i.healthStatus === "Weak",
      ).length,
      strategicCount: strategicAccounts.length,
      improvingCount: allItems.filter((i) => i.trend === "Improving").length,
      decliningCount: allItems.filter((i) => i.trend === "Declining").length,
      openCommitments: openCommitments.length,
      stalledDeals: stalledOpportunities.length,
      averageHealthScore,
    },
    relationshipsAtRisk,
    stalledOpportunities,
    fastestGrowing,
    strategicAccounts,
    openCommitments,
    healthTrends,
    smartDocs,
    relationshipGraph,
  };
}

export function formatIntelligenceCenterTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function dealStageLabel(stage: PipelineStatus): string {
  const lifecycle = getLifecycleStage(stage);
  return `${stage} · ${lifecycle}`;
}
