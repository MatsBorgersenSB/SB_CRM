import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow, PipelineStatus } from "@/types/pipeline";
import { formatDealValue, getLifecycleStage } from "@/types/pipeline";
import {
  getActivitiesForDeal,
  isFollowUpOpen,
  isFollowUpOverdue,
} from "@/lib/activity-utils";
import {
  computeRelationshipHealth,
  healthStatusFromScore,
  type RelationshipHealthStatus,
} from "@/lib/relationship-health-engine";
import { daysBetween } from "@/lib/relative-time";

export type OpportunityHealthStatus = RelationshipHealthStatus;

export type OpportunityMomentum =
  | "Accelerating"
  | "Stable"
  | "Slowing"
  | "Stalled";

export type DealRiskType =
  | "single_stakeholder"
  | "silence_risk"
  | "proposal_risk"
  | "commitment_risk"
  | "relationship_risk";

export type DealRiskSignal = {
  id: string;
  type: DealRiskType;
  label: string;
  detail: string;
  severity: "critical" | "warning" | "info";
};

export type OpportunityHealthComponentId =
  | "relationship_health"
  | "activity_recency"
  | "activity_frequency"
  | "stakeholder_coverage"
  | "risk_signals"
  | "open_commitments";

export type OpportunityHealthComponent = {
  id: OpportunityHealthComponentId;
  label: string;
  score: number;
  weight: number;
  weightedContribution: number;
  detail: string;
};

export type OpportunityNextBestAction = {
  id: string;
  action: string;
  reason: string;
  priority: "High" | "Medium" | "Low";
  confidenceScore: number;
  ruleId: string;
  source: "rule" | "ai";
};

export type OpportunityIntelligence = {
  dealId: string;
  dealName: string;
  companyId: string | null;
  companyName: string | null;
  stage: PipelineStatus;
  lifecycleStage: ReturnType<typeof getLifecycleStage>;
  salesValue: number;
  currency: PipelineRow["currency"];
  healthScore: number;
  healthStatus: OpportunityHealthStatus;
  momentum: OpportunityMomentum;
  components: OpportunityHealthComponent[];
  healthSummary: string;
  risks: DealRiskSignal[];
  winProbability: number;
  weightedForecast: number;
  weightedForecastLabel: string;
  isAtRiskRevenue: boolean;
  nextBestAction: OpportunityNextBestAction;
  daysSinceLastActivity: number;
  stakeholderCount: number;
  openCommitments: number;
  overdueCommitments: number;
};

export type RevenueForecast = {
  pipelineValue: number;
  pipelineValueLabel: string;
  weightedForecast: number;
  weightedForecastLabel: string;
  atRiskRevenue: number;
  atRiskRevenueLabel: string;
  dealCount: number;
  atRiskDealCount: number;
  currency: PipelineRow["currency"];
};

const COMPONENT_WEIGHTS: Record<OpportunityHealthComponentId, number> = {
  relationship_health: 0.25,
  activity_recency: 0.2,
  activity_frequency: 0.15,
  stakeholder_coverage: 0.15,
  risk_signals: 0.15,
  open_commitments: 0.1,
};

const STALLED_DAYS = 21;
const SILENCE_DAYS = 14;

const STAGE_BASE_PROBABILITY: Record<PipelineStatus, number> = {
  Prospecting: 12,
  "Feedstock Analysis": 22,
  "Contract Negotiation": 42,
  Won: 100,
  "Reactor Manufacturing": 72,
  "Site Installation": 82,
  "Commissioning Phase": 90,
  "Live Production": 95,
  "Scheduled Maintenance": 98,
};

function parseActivityDate(value: string): Date {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(normalized);
}

export function findCompanyForDeal(
  dealId: string,
  companies: Company[],
): Company | undefined {
  return companies.find((c) => c.pipelineIds.includes(dealId));
}

function activitiesInWindow(activities: Activity[], start: number, end: number): Activity[] {
  return activities.filter((a) => {
    const days = daysBetween(a.ActivityDate);
    return days >= start && days < end;
  });
}

function getDealActivities(activities: Activity[], dealId: string): Activity[] {
  return getActivitiesForDeal(activities, dealId);
}

function countStakeholders(dealActivities: Activity[], company: Company | undefined): {
  engaged: number;
  total: number;
  score: number;
  detail: string;
} {
  const engagedNames = new Set<string>();
  for (const activity of dealActivities) {
    if (activity.Contact?.Title) engagedNames.add(activity.Contact.Title);
  }

  const teamSize = company?.contacts.length ?? 0;
  const engaged = engagedNames.size;

  if (engaged === 0) {
    return {
      engaged: 0,
      total: teamSize,
      score: 20,
      detail: "No stakeholders engaged on this opportunity",
    };
  }
  if (engaged === 1 && teamSize > 1) {
    return {
      engaged,
      total: teamSize,
      score: 40,
      detail: `Single-threaded — 1 of ${teamSize} contacts engaged`,
    };
  }
  if (teamSize > 0 && engaged / teamSize >= 0.5) {
    return {
      engaged,
      total: teamSize,
      score: 100,
      detail: `${engaged} stakeholders engaged across ${teamSize} contacts`,
    };
  }
  if (engaged >= 2) {
    return {
      engaged,
      total: teamSize,
      score: 80,
      detail: `${engaged} stakeholders engaged on deal activities`,
    };
  }
  return {
    engaged,
    total: teamSize,
    score: 65,
    detail: `${engaged} stakeholder engaged`,
  };
}

function scoreActivityRecency(daysSince: number, hasActivity: boolean): {
  score: number;
  detail: string;
} {
  if (!hasActivity) return { score: 10, detail: "No deal activity recorded" };
  if (daysSince <= 7) return { score: 100, detail: `Last activity ${daysSince}d ago` };
  if (daysSince <= 14) return { score: 85, detail: `Last activity ${daysSince}d ago` };
  if (daysSince <= 21) return { score: 65, detail: `Last activity ${daysSince}d ago — slowing` };
  if (daysSince <= 35) return { score: 40, detail: `Last activity ${daysSince}d ago — stalled` };
  return { score: 15, detail: `Last activity ${daysSince}d ago — critical silence` };
}

function scoreActivityFrequency(recent30: number, recent90: number): {
  score: number;
  detail: string;
} {
  if (recent30 >= 3) return { score: 100, detail: `${recent30} activities in 30 days` };
  if (recent30 >= 1) return { score: 75, detail: `${recent30} activity in 30 days` };
  if (recent90 >= 4) return { score: 50, detail: `${recent90} activities over 90 days — pace slowing` };
  if (recent90 >= 1) return { score: 35, detail: "Low activity frequency" };
  return { score: 10, detail: "No recent deal activity" };
}

function scoreOpenCommitments(open: number, overdue: number): {
  score: number;
  detail: string;
} {
  if (overdue > 0) {
    return {
      score: Math.max(10, 40 - overdue * 15),
      detail: `${overdue} overdue commitment${overdue === 1 ? "" : "s"} on this deal`,
    };
  }
  if (open === 0) return { score: 100, detail: "No open commitments" };
  if (open === 1) return { score: 75, detail: "1 open commitment" };
  return { score: 50, detail: `${open} open commitments` };
}

function scoreRiskSignals(riskCount: number, detail: string): {
  score: number;
  detail: string;
} {
  if (riskCount === 0) return { score: 100, detail: "No deal risk signals" };
  if (riskCount === 1) return { score: 65, detail };
  if (riskCount === 2) return { score: 40, detail };
  return { score: 15, detail };
}

function buildComponent(
  id: OpportunityHealthComponentId,
  label: string,
  score: number,
  detail: string,
): OpportunityHealthComponent {
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

export function computeOpportunityMomentum(
  dealActivities: Activity[],
): OpportunityMomentum {
  const sorted = [...dealActivities].sort(
    (a, b) =>
      parseActivityDate(b.ActivityDate).getTime() -
      parseActivityDate(a.ActivityDate).getTime(),
  );
  const last = sorted[0];
  const daysSince = last ? daysBetween(last.ActivityDate) : 999;

  if (daysSince >= STALLED_DAYS || dealActivities.length === 0) return "Stalled";

  const recent30 = activitiesInWindow(dealActivities, 0, 30).length;
  const prior30 = activitiesInWindow(dealActivities, 30, 60).length;

  if (prior30 === 0 && recent30 > 0) return "Accelerating";
  if (recent30 > prior30 * 1.25) return "Accelerating";
  if (recent30 < prior30 * 0.75 && prior30 > 0) return "Slowing";
  return "Stable";
}

export function detectDealRisks(
  deal: PipelineRow,
  company: Company | undefined,
  dealActivities: Activity[],
  relationshipHealthScore: number,
  momentum: OpportunityMomentum,
): DealRiskSignal[] {
  const risks: DealRiskSignal[] = [];
  const stakeholders = countStakeholders(dealActivities, company);
  const last = dealActivities[0];
  const daysSince = last ? daysBetween(last.ActivityDate) : 999;
  const open = dealActivities.filter(isFollowUpOpen);
  const overdue = open.filter(isFollowUpOverdue);

  if (stakeholders.engaged <= 1 && (company?.contacts.length ?? 0) > 1) {
    risks.push({
      id: `${deal.id}-single-stakeholder`,
      type: "single_stakeholder",
      label: "Single stakeholder risk",
      detail: "Deal depends on one contact — broaden stakeholder coverage",
      severity: "warning",
    });
  }

  if (daysSince >= SILENCE_DAYS) {
    risks.push({
      id: `${deal.id}-silence`,
      type: "silence_risk",
      label: "Silence risk",
      detail: `No deal activity in ${daysSince} days`,
      severity: daysSince >= STALLED_DAYS ? "critical" : "warning",
    });
  }

  if (
    deal.status === "Contract Negotiation" &&
    (momentum === "Stalled" || momentum === "Slowing")
  ) {
    const hasProposal = dealActivities.some(
      (a) => a.ActivityType === "Proposal Sent" && daysBetween(a.ActivityDate) <= 45,
    );
    if (!hasProposal) {
      risks.push({
        id: `${deal.id}-proposal`,
        type: "proposal_risk",
        label: "Proposal risk",
        detail: "Contract negotiation without recent proposal activity",
        severity: "warning",
      });
    }
  }

  if (overdue.length > 0) {
    risks.push({
      id: `${deal.id}-commitment`,
      type: "commitment_risk",
      label: "Commitment risk",
      detail: `${overdue.length} overdue commitment${overdue.length === 1 ? "" : "s"} linked to deal`,
      severity: "critical",
    });
  } else if (open.length >= 2) {
    risks.push({
      id: `${deal.id}-commitment-open`,
      type: "commitment_risk",
      label: "Commitment risk",
      detail: `${open.length} open commitments awaiting closure`,
      severity: "info",
    });
  }

  if (relationshipHealthScore < 50) {
    risks.push({
      id: `${deal.id}-relationship`,
      type: "relationship_risk",
      label: "Relationship risk",
      detail: `Account relationship health ${relationshipHealthScore}/100 — deal at risk`,
      severity: relationshipHealthScore < 25 ? "critical" : "warning",
    });
  }

  return risks;
}

export function computeWinProbability(
  deal: PipelineRow,
  relationshipHealthScore: number,
  momentum: OpportunityMomentum,
  risks: DealRiskSignal[],
  stakeholderScore: number,
): number {
  let probability = STAGE_BASE_PROBABILITY[deal.status];

  probability += (relationshipHealthScore - 50) * 0.15;

  switch (momentum) {
    case "Accelerating":
      probability += 8;
      break;
    case "Slowing":
      probability -= 6;
      break;
    case "Stalled":
      probability -= 15;
      break;
    default:
      break;
  }

  probability += (stakeholderScore - 50) * 0.08;

  for (const risk of risks) {
    if (risk.severity === "critical") probability -= 10;
    else if (risk.severity === "warning") probability -= 5;
    else probability -= 2;
  }

  return Math.round(Math.max(5, Math.min(95, probability)));
}

function resolveOpportunityNextBestAction(
  deal: PipelineRow,
  company: Company | undefined,
  intelligence: Omit<OpportunityIntelligence, "nextBestAction">,
): OpportunityNextBestAction {
  const candidates: OpportunityNextBestAction[] = [];

  if (intelligence.overdueCommitments > 0) {
    candidates.push({
      id: `opp-nba-overdue-${deal.id}`,
      action: "Complete Overdue Commitment",
      reason: `${intelligence.overdueCommitments} overdue action${intelligence.overdueCommitments === 1 ? "" : "s"} blocking deal progress`,
      priority: "High",
      confidenceScore: 94,
      ruleId: "complete_overdue_commitment",
      source: "rule",
    });
  }

  if (intelligence.momentum === "Stalled") {
    candidates.push({
      id: `opp-nba-stalled-${deal.id}`,
      action: "Re-engage Stalled Opportunity",
      reason: `No meaningful activity in ${intelligence.daysSinceLastActivity}+ days — momentum is stalled`,
      priority: "High",
      confidenceScore: 91,
      ruleId: "reengage_stalled",
      source: "rule",
    });
  }

  if (
    deal.status === "Contract Negotiation" &&
    (intelligence.momentum === "Stalled" || intelligence.momentum === "Slowing")
  ) {
    candidates.push({
      id: `opp-nba-proposal-${deal.id}`,
      action: "Follow Up Proposal",
      reason: "Contract negotiation slowing — confirm proposal status and next steps",
      priority: "High",
      confidenceScore: 88,
      ruleId: "follow_up_proposal",
      source: "rule",
    });
  }

  if (deal.status === "Feedstock Analysis" && intelligence.daysSinceLastActivity >= 14) {
    candidates.push({
      id: `opp-nba-spec-${deal.id}`,
      action: "Request Specification",
      reason: "Feedstock analysis needs customer specification to advance stage",
      priority: "Medium",
      confidenceScore: 85,
      ruleId: "request_specification",
      source: "rule",
    });
  }

  const singleStakeholder = intelligence.risks.some((r) => r.type === "single_stakeholder");
  if (singleStakeholder) {
    candidates.push({
      id: `opp-nba-stakeholder-${deal.id}`,
      action: "Engage Additional Stakeholders",
      reason: "Single-threaded deal — involve executive or technical sponsors",
      priority: "Medium",
      confidenceScore: 82,
      ruleId: "engage_stakeholders",
      source: "rule",
    });
  }

  if (intelligence.momentum === "Slowing") {
    candidates.push({
      id: `opp-nba-slowing-${deal.id}`,
      action: "Schedule Follow-Up Call",
      reason: "Deal momentum slowing versus prior 30 days",
      priority: "Medium",
      confidenceScore: 78,
      ruleId: "schedule_follow_up",
      source: "rule",
    });
  }

  if (getLifecycleStage(deal.status) === "delivery" && intelligence.momentum !== "Accelerating") {
    candidates.push({
      id: `opp-nba-review-${deal.id}`,
      action: "Schedule Review Meeting",
      reason: `Align on ${deal.status} progress with customer stakeholders`,
      priority: "Medium",
      confidenceScore: 76,
      ruleId: "schedule_review",
      source: "rule",
    });
  }

  if (candidates.length > 0) {
    const priorityRank = { High: 0, Medium: 1, Low: 2 };
    candidates.sort(
      (a, b) =>
        priorityRank[a.priority] - priorityRank[b.priority] ||
        b.confidenceScore - a.confidenceScore,
    );
    return candidates[0]!;
  }

  return {
    id: `opp-nba-default-${deal.id}`,
    action: "Record Deal Activity",
    reason: "Keep opportunity timeline current to preserve intelligence signals",
    priority: "Low",
    confidenceScore: 60,
    ruleId: "maintain_momentum",
    source: "rule",
  };
}

export function computeOpportunityIntelligence(
  deal: PipelineRow,
  companies: Company[],
  activities: Activity[],
  pipelines: PipelineRow[],
): OpportunityIntelligence {
  const company = findCompanyForDeal(deal.id, companies);
  const dealActivities = getDealActivities(activities, deal.id);
  const sorted = [...dealActivities].sort(
    (a, b) =>
      parseActivityDate(b.ActivityDate).getTime() -
      parseActivityDate(a.ActivityDate).getTime(),
  );
  const lastActivity = sorted[0];
  const daysSince = lastActivity ? daysBetween(lastActivity.ActivityDate) : 999;

  const relationshipReport = company
    ? computeRelationshipHealth(company, activities, pipelines)
    : null;
  const relationshipScore = relationshipReport?.score ?? 50;

  const recent30 = activitiesInWindow(dealActivities, 0, 30).length;
  const recent90 = activitiesInWindow(dealActivities, 0, 90).length;
  const openActions = dealActivities.filter(isFollowUpOpen);
  const overdueActions = openActions.filter(isFollowUpOverdue);

  const stakeholders = countStakeholders(dealActivities, company);
  const momentum = computeOpportunityMomentum(dealActivities);
  const risks = detectDealRisks(
    deal,
    company,
    sorted,
    relationshipScore,
    momentum,
  );

  const recency = scoreActivityRecency(daysSince, Boolean(lastActivity));
  const frequency = scoreActivityFrequency(recent30, recent90);
  const commitments = scoreOpenCommitments(openActions.length, overdueActions.length);
  const riskScore = scoreRiskSignals(
    risks.length,
    risks.map((r) => r.label).join(" · ") || "No deal risk signals",
  );

  const components: OpportunityHealthComponent[] = [
    buildComponent(
      "relationship_health",
      "Relationship Health",
      relationshipScore,
      company
        ? `${company.Title} · ${relationshipReport!.status} (${relationshipScore}/100)`
        : "No linked company",
    ),
    buildComponent("activity_recency", "Activity Recency", recency.score, recency.detail),
    buildComponent(
      "activity_frequency",
      "Activity Frequency",
      frequency.score,
      frequency.detail,
    ),
    buildComponent(
      "stakeholder_coverage",
      "Stakeholder Coverage",
      stakeholders.score,
      stakeholders.detail,
    ),
    buildComponent("risk_signals", "Risk Signals", riskScore.score, riskScore.detail),
    buildComponent(
      "open_commitments",
      "Open Commitments",
      commitments.score,
      commitments.detail,
    ),
  ];

  let healthScore = components.reduce((sum, c) => sum + c.weightedContribution, 0);
  healthScore = Math.round(Math.max(0, Math.min(100, healthScore)));
  const healthStatus = healthStatusFromScore(healthScore);

  const winProbability = computeWinProbability(
    deal,
    relationshipScore,
    momentum,
    risks,
    stakeholders.score,
  );

  const weightedForecast = deal.salesValue * (winProbability / 100);
  const isAtRiskRevenue =
    healthStatus === "At Risk" ||
    healthStatus === "Weak" ||
    momentum === "Stalled" ||
    risks.some((r) => r.severity === "critical");

  const draft: Omit<OpportunityIntelligence, "nextBestAction"> = {
    dealId: deal.id,
    dealName: deal.assetName,
    companyId: company?.CompanyID ?? null,
    companyName: company?.Title ?? null,
    stage: deal.status,
    lifecycleStage: getLifecycleStage(deal.status),
    salesValue: deal.salesValue,
    currency: deal.currency,
    healthScore,
    healthStatus,
    momentum,
    components,
    healthSummary: `${healthStatus} opportunity · ${momentum.toLowerCase()} momentum · ${winProbability}% win probability`,
    risks,
    winProbability,
    weightedForecast,
    weightedForecastLabel: formatDealValue(deal.currency, Math.round(weightedForecast)),
    isAtRiskRevenue,
    daysSinceLastActivity: daysSince,
    stakeholderCount: stakeholders.engaged,
    openCommitments: openActions.length,
    overdueCommitments: overdueActions.length,
  };

  const nextBestAction = resolveOpportunityNextBestAction(deal, company, draft);

  return { ...draft, nextBestAction };
}

export function computePortfolioRevenueForecast(
  intelligences: OpportunityIntelligence[],
  currency: PipelineRow["currency"] = "EUR",
): RevenueForecast {
  const active = intelligences.filter((i) => i.lifecycleStage !== "production" || i.stage !== "Scheduled Maintenance");

  const pipelineValue = active.reduce((sum, i) => sum + i.salesValue, 0);
  const weightedForecast = active.reduce((sum, i) => sum + i.weightedForecast, 0);
  const atRiskRevenue = active
    .filter((i) => i.isAtRiskRevenue)
    .reduce((sum, i) => sum + i.salesValue, 0);

  return {
    pipelineValue,
    pipelineValueLabel: formatDealValue(currency, Math.round(pipelineValue)),
    weightedForecast,
    weightedForecastLabel: formatDealValue(currency, Math.round(weightedForecast)),
    atRiskRevenue,
    atRiskRevenueLabel: formatDealValue(currency, Math.round(atRiskRevenue)),
    dealCount: active.length,
    atRiskDealCount: active.filter((i) => i.isAtRiskRevenue).length,
    currency,
  };
}

export const OPPORTUNITY_HEALTH_STYLES: Record<OpportunityHealthStatus, string> = {
  Strategic: "border-violet-500/35 bg-violet-500/10 text-violet-700",
  Strong: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  Healthy: "border-sky-500/30 bg-sky-500/10 text-sky-700",
  Weak: "border-upcycle-orange/30 bg-upcycle-orange/10 text-upcycle-orange",
  "At Risk": "border-red-500/30 bg-red-500/10 text-red-700",
};

export const OPPORTUNITY_MOMENTUM_STYLES: Record<OpportunityMomentum, string> = {
  Accelerating: "text-emerald-600",
  Stable: "text-carbon-blue/50",
  Slowing: "text-upcycle-orange",
  Stalled: "text-red-600",
};

export function getOpportunityIntelligenceExplanation(): string {
  return (
    "Opportunity Health (0–100) combines Relationship Health (25%), Activity Recency (20%), " +
    "Activity Frequency (15%), Stakeholder Coverage (15%), Risk Signals (15%), and Open Commitments (10%). " +
    "Win probability adjusts stage baseline by relationship, momentum, risks, and coverage. " +
    "All intelligence is rule-based — no AI."
  );
}
