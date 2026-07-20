import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import {
  getActivitiesForCompany,
  isFollowUpOpen,
  isFollowUpOverdue,
} from "@/lib/activity-utils";
import { daysBetween } from "@/lib/relative-time";
import {
  resolveNextBestAction,
  type RecommendedAction,
} from "@/lib/next-best-action-engine";
import {
  buildConnectedTouchpointSummary,
  effectiveRecencyDetail,
  findEvidenceForCompany,
} from "@/lib/outlook-reconciliation-engine";
import type { OutlookEvidenceRecord } from "@/types/outlook-reconciliation";

export type RelationshipHealthStatus =
  | "Strategic"
  | "Strong"
  | "Healthy"
  | "Weak"
  | "At Risk";

export type RelationshipTrend = "Improving" | "Stable" | "Declining";

/** @deprecated Use RelationshipHealthStatus */
export type RelationshipHealthLabel =
  | "Strong Relationship"
  | "Needs Attention"
  | "At Risk"
  | "New";

export type HealthScoreComponentId =
  | "contact_recency"
  | "activity_frequency"
  | "open_commitments"
  | "active_opportunities"
  | "risk_signals"
  | "contact_diversity";

export type HealthScoreComponent = {
  id: HealthScoreComponentId;
  label: string;
  score: number;
  weight: number;
  weightedContribution: number;
  detail: string;
};

export type RelationshipHealthReport = {
  score: number;
  status: RelationshipHealthStatus;
  trend: RelationshipTrend;
  components: HealthScoreComponent[];
  summary: string;
  isNewRelationship: boolean;
  /** Rule-based next step — extension point for future intelligence modules. */
  recommendedAction: RecommendedAction;
};

const COMPONENT_WEIGHTS: Record<HealthScoreComponentId, number> = {
  contact_recency: 0.25,
  activity_frequency: 0.2,
  open_commitments: 0.15,
  active_opportunities: 0.15,
  risk_signals: 0.15,
  contact_diversity: 0.1,
};

export type RelationshipHealthOptions = {
  outlookEvidence?: OutlookEvidenceRecord[];
  connected?: boolean;
};

const STALLED_DAYS = 21;

function parseActivityDate(value: string): Date {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(normalized);
}

function getCompanyActivities(company: Company, activities: Activity[]): Activity[] {
  return getActivitiesForCompany(activities, company);
}

function activitiesInWindow(
  companyActivities: Activity[],
  startDaysAgo: number,
  endDaysAgo: number,
): Activity[] {
  return companyActivities.filter((a) => {
    const days = daysBetween(a.ActivityDate);
    return days >= startDaysAgo && days < endDaysAgo;
  });
}

function scoreContactRecency(lastContactDays: number, hasContact: boolean): {
  score: number;
  detail: string;
} {
  if (!hasContact) {
    return { score: 15, detail: "No recorded contact yet" };
  }
  if (lastContactDays <= 7) {
    return {
      score: 100,
      detail: `Last contact ${lastContactDays} day${lastContactDays === 1 ? "" : "s"} ago`,
    };
  }
  if (lastContactDays <= 14) {
    return { score: 90, detail: `Last contact ${lastContactDays} days ago` };
  }
  if (lastContactDays <= 30) {
    return { score: 75, detail: `Last contact ${lastContactDays} days ago` };
  }
  if (lastContactDays <= 45) {
    return { score: 55, detail: `Last contact ${lastContactDays} days ago — cooling` };
  }
  if (lastContactDays <= 60) {
    return { score: 35, detail: `Last contact ${lastContactDays} days ago — at risk` };
  }
  if (lastContactDays <= 90) {
    return { score: 20, detail: `Last contact ${lastContactDays} days ago — cold` };
  }
  return { score: 5, detail: `Last contact ${lastContactDays}+ days ago — critical` };
}

function scoreActivityFrequency(recent30: number, recent90: number): {
  score: number;
  detail: string;
} {
  if (recent30 >= 4) {
    return { score: 100, detail: `${recent30} interactions in the last 30 days` };
  }
  if (recent30 >= 2) {
    return { score: 85, detail: `${recent30} interactions in the last 30 days` };
  }
  if (recent30 >= 1) {
    return { score: 70, detail: "1 interaction in the last 30 days" };
  }
  if (recent90 >= 8) {
    return { score: 60, detail: `${recent90} activities over 90 days — pace slowing` };
  }
  if (recent90 >= 4) {
    return { score: 45, detail: `${recent90} activities over 90 days` };
  }
  if (recent90 >= 1) {
    return { score: 30, detail: `${recent90} activity in 90 days — low frequency` };
  }
  return { score: 10, detail: "No recent activity frequency" };
}

function scoreOpenCommitments(openCount: number): { score: number; detail: string } {
  if (openCount === 0) return { score: 100, detail: "No open commitments" };
  if (openCount === 1) return { score: 75, detail: "1 open commitment" };
  if (openCount === 2) return { score: 55, detail: "2 open commitments" };
  return { score: 30, detail: `${openCount} open commitments — high load` };
}

function scoreActiveOpportunities(
  activeDeals: number,
  stalledDeals: number,
): { score: number; detail: string } {
  if (activeDeals === 0) return { score: 45, detail: "No active opportunities" };
  if (stalledDeals === 0 && activeDeals >= 2) {
    return { score: 100, detail: `${activeDeals} active opportunities moving` };
  }
  if (stalledDeals === 0) {
    return { score: 85, detail: "1 active opportunity" };
  }
  return {
    score: Math.max(20, 85 - stalledDeals * 25),
    detail: `${activeDeals} opportunities · ${stalledDeals} stalled`,
  };
}

function collectRiskSignals(
  company: Company,
  companyActivities: Activity[],
  pipelines: PipelineRow[],
  overdueCount: number,
): { count: number; detail: string } {
  let count = overdueCount;
  const labels: string[] = [];

  if (overdueCount > 0) {
    labels.push(
      `${overdueCount} overdue action${overdueCount === 1 ? "" : "s"}`,
    );
  }

  for (const activity of companyActivities) {
    const riskCount = activity.Risks?.length ?? 0;
    count += riskCount;
    if (riskCount > 0) {
      labels.push(`${riskCount} risk signal${riskCount === 1 ? "" : "s"} in activity`);
    }
  }

  const stalled = company.pipelineIds.filter((dealId) => {
    const deal = pipelines.find((p) => p.id === dealId);
    if (!deal || ["Live Production", "Scheduled Maintenance"].includes(deal.status)) {
      return false;
    }
    const last = companyActivities
      .filter((a) => a.Deal?.Title === dealId)
      .sort(
        (a, b) =>
          parseActivityDate(b.ActivityDate).getTime() -
          parseActivityDate(a.ActivityDate).getTime(),
      )[0];
    return !last || daysBetween(last.ActivityDate) >= STALLED_DAYS;
  });

  count += stalled.length;
  if (stalled.length > 0) {
    labels.push(`${stalled.length} stalled deal${stalled.length === 1 ? "" : "s"}`);
  }

  if (count === 0) return { count: 0, detail: "No risk signals detected" };
  return {
    count,
    detail: labels.join(" · ") || `${count} risk signal${count === 1 ? "" : "s"}`,
  };
}

function scoreRiskSignals(riskCount: number, detail: string): {
  score: number;
  detail: string;
} {
  if (riskCount === 0) return { score: 100, detail };
  if (riskCount === 1) return { score: 60, detail };
  if (riskCount === 2) return { score: 35, detail };
  return { score: 10, detail };
}

function scoreContactDiversity(
  company: Company,
  companyActivities: Activity[],
): { score: number; detail: string } {
  const totalContacts = company.contacts.length;
  const recent90 = activitiesInWindow(companyActivities, 0, 90);
  const engagedNames = new Set<string>();

  for (const activity of recent90) {
    if (activity.Contact?.Title) {
      engagedNames.add(activity.Contact.Title);
    }
  }

  if (totalContacts === 0) {
    return { score: 40, detail: "No contacts on file — add stakeholders" };
  }

  const engagedCount = engagedNames.size;
  const coverage = engagedCount / totalContacts;

  if (engagedCount >= 3 && coverage >= 0.75) {
    return {
      score: 100,
      detail: `${engagedCount} contacts engaged in 90 days — broad coverage`,
    };
  }
  if (engagedCount >= 2) {
    return {
      score: 80,
      detail: `${engagedCount} of ${totalContacts} contacts engaged recently`,
    };
  }
  if (engagedCount === 1 && totalContacts === 1) {
    return { score: 85, detail: "Single key contact engaged" };
  }
  if (engagedCount === 1) {
    return {
      score: 40,
      detail: `Only 1 of ${totalContacts} contacts engaged — broaden reach`,
    };
  }
  return {
    score: 15,
    detail: "No recent contact diversity — relationship is single-threaded or cold",
  };
}

export function healthStatusFromScore(score: number): RelationshipHealthStatus {
  if (score >= 90) return "Strategic";
  if (score >= 75) return "Strong";
  if (score >= 50) return "Healthy";
  if (score >= 25) return "Weak";
  return "At Risk";
}

export function computeRelationshipTrend(
  companyActivities: Activity[],
): RelationshipTrend {
  const recent = activitiesInWindow(companyActivities, 0, 30).length;
  const prior = activitiesInWindow(companyActivities, 30, 60).length;

  if (recent === 0 && prior === 0) return "Stable";
  if (prior === 0 && recent > 0) return "Improving";
  if (recent > prior * 1.25) return "Improving";
  if (recent < prior * 0.75) return "Declining";
  return "Stable";
}

function buildComponent(
  id: HealthScoreComponentId,
  label: string,
  score: number,
  detail: string,
): HealthScoreComponent {
  const weight = COMPONENT_WEIGHTS[id];
  return {
    id,
    label,
    score: Math.round(Math.max(0, Math.min(100, score))),
    weight,
    weightedContribution: Math.round(score * weight),
    detail,
  };
}

export function computeRelationshipHealth(
  company: Company,
  activities: Activity[],
  pipelines: PipelineRow[],
  options: RelationshipHealthOptions = {},
): RelationshipHealthReport {
  const companyActivities = getCompanyActivities(company, activities);
  const sorted = [...companyActivities].sort(
    (a, b) =>
      parseActivityDate(b.ActivityDate).getTime() -
      parseActivityDate(a.ActivityDate).getTime(),
  );
  const lastActivity = sorted[0];

  const connected = options.connected ?? (options.outlookEvidence?.length ?? 0) > 0;
  const companyEvidence = findEvidenceForCompany(
    options.outlookEvidence ?? [],
    company.CompanyID,
  );
  const touchpoints = buildConnectedTouchpointSummary(
    companyActivities,
    companyEvidence,
    connected,
  );

  const effectiveLastDate = touchpoints.effectiveLastDate ?? lastActivity?.ActivityDate ?? null;
  const lastContactDays = effectiveLastDate ? daysBetween(effectiveLastDate) : 999;
  const hasEffectiveContact = Boolean(effectiveLastDate);

  const recent30 =
    activitiesInWindow(companyActivities, 0, 30).length +
    (touchpoints.includesOutlook ? touchpoints.outlookEmailCount : 0);
  const recent90 =
    activitiesInWindow(companyActivities, 0, 90).length +
    (touchpoints.includesOutlook
      ? touchpoints.outlookEmailCount +
        touchpoints.outlookTeamsCount +
        touchpoints.outlookCalendarCount
      : 0);

  const openActions = companyActivities.filter(isFollowUpOpen);
  const overdueActions = openActions.filter(isFollowUpOverdue);

  const activeDeals = company.pipelineIds.filter((id) => {
    const deal = pipelines.find((p) => p.id === id);
    return deal && deal.status !== "Scheduled Maintenance";
  }).length;

  const stalledDeals = company.pipelineIds.filter((dealId) => {
    const deal = pipelines.find((p) => p.id === dealId);
    if (!deal || ["Live Production", "Scheduled Maintenance"].includes(deal.status)) {
      return false;
    }
    const last = companyActivities.find((a) => a.Deal?.Title === dealId);
    return !last || daysBetween(last.ActivityDate) >= STALLED_DAYS;
  }).length;

  const riskInfo = collectRiskSignals(
    company,
    companyActivities,
    pipelines,
    overdueActions.length,
  );

  const isNewRelationship =
    !hasEffectiveContact && company.contacts.length === 0 && company.pipelineIds.length === 0;

  const recency = scoreContactRecency(lastContactDays, hasEffectiveContact);
  if (touchpoints.includesOutlook) {
    recency.detail = effectiveRecencyDetail(touchpoints);
  }
  const frequency = scoreActivityFrequency(recent30, recent90);
  const commitments = scoreOpenCommitments(openActions.length);
  const opportunities = scoreActiveOpportunities(activeDeals, stalledDeals);
  const risks = scoreRiskSignals(riskInfo.count, riskInfo.detail);
  const diversity = scoreContactDiversity(company, companyActivities);

  const components: HealthScoreComponent[] = [
    buildComponent("contact_recency", "Contact Recency", recency.score, recency.detail),
    buildComponent(
      "activity_frequency",
      "Activity Frequency",
      frequency.score,
      frequency.detail,
    ),
    buildComponent(
      "open_commitments",
      "Open Commitments",
      commitments.score,
      commitments.detail,
    ),
    buildComponent(
      "active_opportunities",
      "Active Opportunities",
      opportunities.score,
      opportunities.detail,
    ),
    buildComponent("risk_signals", "Risk Signals", risks.score, risks.detail),
    buildComponent(
      "contact_diversity",
      "Contact Diversity",
      diversity.score,
      diversity.detail,
    ),
  ];

  let score = components.reduce((sum, c) => sum + c.weightedContribution, 0);
  score = Math.round(Math.max(0, Math.min(100, score)));

  if (isNewRelationship) {
    score = Math.min(score, 50);
  }

  const status = healthStatusFromScore(score);
  const trend = computeRelationshipTrend(companyActivities);

  const weakest = components
    .slice()
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
    .map((c) => c.label.toLowerCase());

  const summary = isNewRelationship
    ? "New relationship — establish contact and record first interaction."
    : `${status} relationship · ${trend.toLowerCase()} trend · score driven by ${weakest.join(" and ")}.`;

  const draft: Omit<RelationshipHealthReport, "recommendedAction"> = {
    score,
    status,
    trend,
    components,
    summary,
    isNewRelationship,
  };

  const recommendedAction = resolveNextBestAction({
    company,
    report: draft,
    activities,
    pipelines,
  });

  return { ...draft, recommendedAction };
}

/** Map new status to legacy dashboard label where needed. */
export function legacyHealthLabelFromReport(
  report: RelationshipHealthReport,
): RelationshipHealthLabel {
  if (report.isNewRelationship) return "New";
  switch (report.status) {
    case "Strategic":
    case "Strong":
      return "Strong Relationship";
    case "Healthy":
      return "Needs Attention";
    case "Weak":
    case "At Risk":
      return "At Risk";
  }
}

export function getHealthScoreExplanation(): string {
  return (
    "Relationship Health Score (0–100) is a weighted sum of six factors: " +
    "Contact Recency (25%), Activity Frequency (20%), Open Commitments (15%), " +
    "Active Opportunities (15%), Risk Signals (15%), and Contact Diversity (10%). " +
    "Status: Strategic 90+, Strong 75–89, Healthy 50–74, Weak 25–49, At Risk 0–24. " +
    "Trend compares activity in the last 30 days to the prior 30 days. " +
    "Next Best Actions are rule-based — no AI."
  );
}

export const HEALTH_STATUS_STYLES: Record<
  RelationshipHealthStatus,
  string
> = {
  Strategic: "border-violet-500/35 bg-violet-500/10 text-violet-700",
  Strong: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  Healthy: "border-sky-500/30 bg-sky-500/10 text-sky-700",
  Weak: "border-upcycle-orange/30 bg-upcycle-orange/10 text-upcycle-orange",
  "At Risk": "border-red-500/30 bg-red-500/10 text-red-700",
};

export const TREND_STYLES: Record<RelationshipTrend, string> = {
  Improving: "text-emerald-600",
  Stable: "text-carbon-blue/50",
  Declining: "text-red-600",
};

export type { RecommendedAction, RelationshipHealthSnapshot } from "@/lib/next-best-action-engine";
export type { NextBestAction } from "@/lib/next-best-action-engine";
