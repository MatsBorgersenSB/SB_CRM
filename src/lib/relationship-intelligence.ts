import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { formatDealValue } from "@/types/pipeline";
import { computeExecutivePipelineKpis } from "@/lib/pipeline-kpis";
import {
  computeActivityIntelligence,
  isFollowUpOpen,
  isFollowUpOverdue,
} from "@/lib/activity-utils";
import { daysBetween, formatDaysAgo } from "@/lib/relative-time";
import type { NextBestActionWithCompany } from "@/lib/next-best-action-engine";
import {
  computeRelationshipHealth,
  legacyHealthLabelFromReport,
  type RelationshipHealthReport,
  type RelationshipHealthStatus,
  type RelationshipTrend,
} from "@/lib/relationship-health-engine";

export type {
  RelationshipHealthStatus,
  RelationshipTrend,
  RelationshipHealthReport,
} from "@/lib/relationship-health-engine";

/** @deprecated Use RelationshipHealthStatus */
export type RelationshipHealthLabel =
  | "Strong Relationship"
  | "Needs Attention"
  | "At Risk"
  | "New";

export type FocusPriority = "critical" | "high" | "normal";

export type FocusItem =
  | {
      kind: "overdue_followup";
      id: string;
      priority: "critical";
      title: string;
      subtitle: string;
      href: string;
      companyName?: string;
      daysOverdue: number;
    }
  | {
      kind: "due_today";
      id: string;
      priority: "high";
      title: string;
      subtitle: string;
      href: string;
      companyName?: string;
    }
  | {
      kind: "high_value_deal";
      id: string;
      priority: "high";
      title: string;
      subtitle: string;
      href: string;
      companyName?: string;
      valueLabel: string;
    }
  | {
      kind: "stalled_deal";
      id: string;
      priority: "high";
      title: string;
      subtitle: string;
      href: string;
      companyName?: string;
      daysStalled: number;
    }
  | {
      kind: "contact_today";
      id: string;
      priority: "normal";
      title: string;
      subtitle: string;
      href: string;
      companyName?: string;
    };

export type RelationshipAttention = {
  companyId: string;
  companyName: string;
  reason: "no_recent_contact" | "overdue_followup" | "stalled_opportunity";
  detail: string;
  priority: FocusPriority;
  href: string;
  healthScore: number;
  healthStatus: RelationshipHealthStatus;
  trend: RelationshipTrend;
  recommendedAction: RelationshipHealthReport["recommendedAction"];
};

export type CompanyRelationshipSummary = {
  company: Company;
  /** @deprecated Use healthStatus */
  healthLabel: RelationshipHealthLabel;
  healthScore: number;
  healthStatus: RelationshipHealthStatus;
  trend: RelationshipTrend;
  healthReport: RelationshipHealthReport;
  lastContactAt: string | null;
  lastContactLabel: string;
  openActions: number;
  activeDeals: number;
};

export type DashboardKpis = {
  pipelineValue: string;
  openFollowUps: number;
  overdueFollowUps: number;
  activeDeals: number;
  totalCompanies: number;
  totalContacts: number;
};

export type RelationshipCommandCenter = {
  kpis: DashboardKpis;
  focusItems: FocusItem[];
  recentActivities: Activity[];
  relationshipsNeedingAttention: RelationshipAttention[];
  companySummaries: CompanyRelationshipSummary[];
  nextBestActions: NextBestActionWithCompany[];
};

const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 } as const;

function buildNextBestActionFeed(
  summaries: CompanyRelationshipSummary[],
  limit = 6,
): NextBestActionWithCompany[] {
  return summaries
    .map((summary) => ({
      ...summary.healthReport.recommendedAction,
      companyId: summary.company.CompanyID,
      companyName: summary.company.Title,
      healthScore: summary.healthScore,
      healthStatus: summary.healthStatus,
    }))
    .sort((a, b) => {
      const priorityDiff =
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.confidenceScore - a.confidenceScore;
    })
    .slice(0, limit);
}

const HIGH_VALUE_THRESHOLD = 500_000;
const STALLED_DAYS = 21;
const COLD_CONTACT_DAYS = 45;

function parseActivityDate(value: string): Date {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(normalized);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isDueToday(activity: Activity): boolean {
  if (!activity.NextActionDate) return false;
  return (
    startOfDay(new Date(activity.NextActionDate)).getTime() ===
    startOfDay(new Date()).getTime()
  );
}

function getLastActivityForCompany(
  companyTitle: string,
  activities: Activity[],
): Activity | undefined {
  return activities
    .filter((a) => a.Company?.Title === companyTitle)
    .sort(
      (a, b) =>
        parseActivityDate(b.ActivityDate).getTime() -
        parseActivityDate(a.ActivityDate).getTime(),
    )[0];
}

function getLastActivityForDeal(dealId: string, activities: Activity[]): Activity | undefined {
  return activities
    .filter((a) => a.Deal?.Title === dealId)
    .sort(
      (a, b) =>
        parseActivityDate(b.ActivityDate).getTime() -
        parseActivityDate(a.ActivityDate).getTime(),
    )[0];
}

function findCompanyForDeal(
  dealId: string,
  companies: Company[],
): Company | undefined {
  return companies.find((c) => c.pipelineIds.includes(dealId));
}

function buildFocusItems(
  activities: Activity[],
  pipelines: PipelineRow[],
  companies: Company[],
): FocusItem[] {
  const items: FocusItem[] = [];

  for (const activity of activities) {
    if (!isFollowUpOpen(activity)) continue;

    if (isFollowUpOverdue(activity)) {
      const daysOverdue = activity.NextActionDate
        ? Math.max(1, daysBetween(activity.NextActionDate))
        : 1;
      items.push({
        kind: "overdue_followup",
        id: `focus-overdue-${activity.ActivityID}`,
        priority: "critical",
        title: activity.NextAction || activity.Subject,
        subtitle: `Open action overdue ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}`,
        href: `/activities/${activity.ActivityID}`,
        companyName: activity.Company?.Title,
        daysOverdue,
      });
    } else if (isDueToday(activity)) {
      const isContact = Boolean(activity.Contact?.Title);
      if (isContact) {
        items.push({
          kind: "contact_today",
          id: `focus-today-${activity.ActivityID}`,
          priority: "normal",
          title: `Contact ${activity.Contact?.Title}`,
          subtitle: "Due today",
          href: `/activities/${activity.ActivityID}`,
          companyName: activity.Company?.Title,
        });
      } else {
        items.push({
          kind: "due_today",
          id: `focus-today-${activity.ActivityID}`,
          priority: "high",
          title: activity.NextAction || activity.Subject,
          subtitle: activity.NextAction || "Due today",
          href: `/activities/${activity.ActivityID}`,
          companyName: activity.Company?.Title,
        });
      }
    }
  }

  for (const deal of pipelines) {
    const weighted = deal.salesValue * (deal.probability / 100);
    if (weighted >= HIGH_VALUE_THRESHOLD) {
      const company = findCompanyForDeal(deal.id, companies);
      items.push({
        kind: "high_value_deal",
        id: `focus-deal-${deal.id}`,
        priority: "high",
        title: `Review ${deal.assetName}`,
        subtitle: company?.Title ?? deal.id,
        href: "/deals",
        companyName: company?.Title,
        valueLabel: formatDealValue(deal.currency, deal.salesValue),
      });
    }

    const lastDealActivity = getLastActivityForDeal(deal.id, activities);
    const lastTouch = lastDealActivity?.ActivityDate;
    const daysSince = lastTouch ? daysBetween(lastTouch) : STALLED_DAYS + 1;

    if (
      daysSince >= STALLED_DAYS &&
      !["Live Production", "Scheduled Maintenance"].includes(deal.status)
    ) {
      const company = findCompanyForDeal(deal.id, companies);
      items.push({
        kind: "stalled_deal",
        id: `focus-stalled-${deal.id}`,
        priority: "high",
        title: `${deal.assetName} stalled`,
        subtitle: `No activity for ${daysSince} days · ${deal.status}`,
        href: "/deals",
        companyName: company?.Title,
        daysStalled: daysSince,
      });
    }
  }

  const priorityOrder: Record<FocusPriority, number> = {
    critical: 0,
    high: 1,
    normal: 2,
  };

  return items
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, 8);
}

export function buildCompanyRelationshipSummary(
  company: Company,
  activities: Activity[],
  pipelines: PipelineRow[],
): CompanyRelationshipSummary {
  return buildCompanySummaries([company], activities, pipelines)[0]!;
}

export function buildCompanySummariesForCompanies(
  companies: Company[],
  activities: Activity[],
  pipelines: PipelineRow[],
): CompanyRelationshipSummary[] {
  return buildCompanySummaries(companies, activities, pipelines).sort(
    (a, b) => a.healthScore - b.healthScore,
  );
}

function buildRelationshipAttention(
  companies: Company[],
  activities: Activity[],
  pipelines: PipelineRow[],
): RelationshipAttention[] {
  const items: RelationshipAttention[] = [];

  for (const company of companies) {
    const lastActivity = getLastActivityForCompany(company.Title, activities);
    const daysSinceContact = lastActivity
      ? daysBetween(lastActivity.ActivityDate)
      : Infinity;

    const openFollowUps = activities.filter(
      (a) =>
        a.Company?.Title === company.Title &&
        isFollowUpOpen(a),
    );

    const overdue = openFollowUps.filter(isFollowUpOverdue);
    if (overdue.length > 0) {
      const health = computeRelationshipHealth(company, activities, pipelines);
      items.push({
        companyId: company.CompanyID,
        companyName: company.Title,
        reason: "overdue_followup",
        detail: `${overdue.length} open follow-up${overdue.length === 1 ? "" : "s"} overdue · Score ${health.score}`,
        priority: "critical",
        href: `/companies/${company.CompanyID}`,
        healthScore: health.score,
        healthStatus: health.status,
        trend: health.trend,
        recommendedAction: health.recommendedAction,
      });
      continue;
    }

    const stalledDeals = company.pipelineIds.filter((dealId) => {
      const deal = pipelines.find((p) => p.id === dealId);
      if (!deal || ["Live Production", "Scheduled Maintenance"].includes(deal.status)) {
        return false;
      }
      const last = getLastActivityForDeal(dealId, activities);
      return !last || daysBetween(last.ActivityDate) >= STALLED_DAYS;
    });

    if (stalledDeals.length > 0) {
      const health = computeRelationshipHealth(company, activities, pipelines);
      items.push({
        companyId: company.CompanyID,
        companyName: company.Title,
        reason: "stalled_opportunity",
        detail: `Opportunity stalled · Score ${health.score}`,
        priority: "high",
        href: `/companies/${company.CompanyID}`,
        healthScore: health.score,
        healthStatus: health.status,
        trend: health.trend,
        recommendedAction: health.recommendedAction,
      });
      continue;
    }

    if (daysSinceContact >= COLD_CONTACT_DAYS) {
      const health = computeRelationshipHealth(company, activities, pipelines);
      items.push({
        companyId: company.CompanyID,
        companyName: company.Title,
        reason: "no_recent_contact",
        detail: `Last contact: ${formatDaysAgo(lastActivity?.ActivityDate ?? null)} · Score ${health.score}`,
        priority: daysSinceContact >= 60 ? "critical" : "high",
        href: `/companies/${company.CompanyID}`,
        healthScore: health.score,
        healthStatus: health.status,
        trend: health.trend,
        recommendedAction: health.recommendedAction,
      });
    }
  }

  return items
    .sort((a, b) => {
      const order: Record<FocusPriority, number> = { critical: 0, high: 1, normal: 2 };
      const priorityDiff = order[a.priority] - order[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.healthScore - b.healthScore;
    })
    .slice(0, 5);
}

function buildCompanySummaries(
  companies: Company[],
  activities: Activity[],
  pipelines: PipelineRow[],
): CompanyRelationshipSummary[] {
  return companies.map((company) => {
    const healthReport = computeRelationshipHealth(company, activities, pipelines);
    const lastActivity = getLastActivityForCompany(company.Title, activities);

    const openActions = activities.filter(
      (a) => a.Company?.Title === company.Title && isFollowUpOpen(a),
    ).length;

    const activeDeals = company.pipelineIds.filter((id) => {
      const deal = pipelines.find((p) => p.id === id);
      return deal && deal.status !== "Scheduled Maintenance";
    }).length;

    return {
      company,
      healthLabel: legacyHealthLabelFromReport(healthReport),
      healthScore: healthReport.score,
      healthStatus: healthReport.status,
      trend: healthReport.trend,
      healthReport,
      lastContactAt: lastActivity?.ActivityDate ?? null,
      lastContactLabel: formatDaysAgo(lastActivity?.ActivityDate ?? null),
      openActions,
      activeDeals,
    };
  });
}

export function buildRelationshipCommandCenter(
  companies: Company[],
  pipelines: PipelineRow[],
  activities: Activity[],
): RelationshipCommandCenter {
  const executive = computeExecutivePipelineKpis(pipelines);
  const intelligence = computeActivityIntelligence(activities, pipelines);

  const contactCount = companies.reduce(
    (sum, company) => sum + company.contacts.length,
    0,
  );

  const allSummaries = buildCompanySummaries(companies, activities, pipelines);

  const summaries = allSummaries
    .sort((a, b) => {
      if (a.healthScore !== b.healthScore) return a.healthScore - b.healthScore;
      return b.openActions - a.openActions;
    })
    .slice(0, 6);

  const nextBestActions = buildNextBestActionFeed(allSummaries, 6);

  return {
    kpis: {
      pipelineValue: executive.totalWeightedPipelineValueLabel,
      openFollowUps: intelligence.openFollowUps,
      overdueFollowUps: intelligence.overdueFollowUps,
      activeDeals: pipelines.length,
      totalCompanies: companies.length,
      totalContacts: contactCount,
    },
    focusItems: buildFocusItems(activities, pipelines, companies),
    recentActivities: [...activities]
      .sort(
        (a, b) =>
          parseActivityDate(b.ActivityDate).getTime() -
          parseActivityDate(a.ActivityDate).getTime(),
      )
      .slice(0, 6),
    relationshipsNeedingAttention: buildRelationshipAttention(
      companies,
      activities,
      pipelines,
    ),
    companySummaries: summaries,
    nextBestActions,
  };
}

export function getWelcomeGreeting(displayName: string): string {
  const hour = new Date().getHours();
  const firstName = displayName.split(" ")[0] ?? displayName;

  if (hour < 12) return `Good morning, ${firstName}`;
  if (hour < 17) return `Good afternoon, ${firstName}`;
  if (hour >= 17 && hour < 21) return `Good evening, ${firstName}`;
  return `Welcome back, ${firstName}`;
}

export function formatDashboardDate(): string {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** @deprecated Use buildRelationshipCommandCenter */
export const buildDashboardData = buildRelationshipCommandCenter;
