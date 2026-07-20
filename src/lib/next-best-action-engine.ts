import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type {
  PipelineRow,
  PipelineStatus,
} from "@/types/pipeline";
import { getLifecycleStage } from "@/types/pipeline";
import {
  getActivitiesForCompany,
  isFollowUpOpen,
  isFollowUpOverdue,
} from "@/lib/activity-utils";
import { daysBetween } from "@/lib/relative-time";

/** V1 deterministic output — future AI providers return source: "ai". */
export type NextBestActionSource = "rule" | "ai";

export type NextBestActionPriority = "High" | "Medium" | "Low";

export type DealMomentum = "Accelerating" | "Stable" | "Stalled" | "Cold";

export type NextBestAction = {
  id: string;
  /** Primary recommendation label shown in UI. */
  action: string;
  reason: string;
  priority: NextBestActionPriority;
  /** 0–100 — how strongly the engine supports this recommendation. */
  confidenceScore: number;
  ruleId: string;
  source: NextBestActionSource;
};

/** @deprecated Use NextBestAction.action */
export type RecommendedAction = NextBestAction & { title?: string };

export type NextBestActionDealInput = {
  dealId: string;
  dealName: string;
  stage: PipelineStatus;
  lifecycleStage: ReturnType<typeof getLifecycleStage>;
  daysSinceLastActivity: number;
  momentum: DealMomentum;
  activityCount30d: number;
  activityCountPrior30d: number;
};

/** Structured inputs the rule engine evaluates — built from CRM signals. */
export type NextBestActionInputs = {
  companyId: string;
  companyName: string;
  healthScore: number;
  healthStatus: "Strategic" | "Strong" | "Healthy" | "Weak" | "At Risk";
  trend: "Improving" | "Stable" | "Declining";
  lastContactDays: number | null;
  activityFrequency30d: number;
  activityFrequency90d: number;
  openCommitments: number;
  overdueActions: number;
  riskSignalCount: number;
  contactCount: number;
  deals: NextBestActionDealInput[];
  isNewRelationship: boolean;
};

export type RelationshipHealthSnapshot = {
  score: number;
  status: "Strategic" | "Strong" | "Healthy" | "Weak" | "At Risk";
  trend: "Improving" | "Stable" | "Declining";
  components: Array<{ id: string; score: number; detail: string }>;
  summary: string;
  isNewRelationship: boolean;
};

export type NextBestActionContext = {
  company: Company;
  report: RelationshipHealthSnapshot;
  activities: Activity[];
  pipelines: PipelineRow[];
};

export type NextBestActionRule = {
  id: string;
  evaluate: (
    inputs: NextBestActionInputs,
    ctx: NextBestActionContext,
  ) => NextBestAction | null;
};

export type NextBestActionProvider = {
  id: string;
  /** Future AI slot — return null in V1. Rule engine runs when this returns null. */
  resolve: (ctx: NextBestActionContext, inputs: NextBestActionInputs) => NextBestAction | null;
};

const STALLED_DAYS = 21;
const COLD_CONTACT_DAYS = 45;
const PRIORITY_RANK: Record<NextBestActionPriority, number> = {
  High: 0,
  Medium: 1,
  Low: 2,
};

function parseActivityDate(value: string): Date {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(normalized);
}

function companyActivities(ctx: NextBestActionContext): Activity[] {
  return getActivitiesForCompany(ctx.activities, ctx.company);
}

function activitiesInWindow(activities: Activity[], startDays: number, endDays: number): Activity[] {
  return activities.filter((a) => {
    const days = daysBetween(a.ActivityDate);
    return days >= startDays && days < endDays;
  });
}

function computeDealMomentum(
  dealActivities: Activity[],
): DealMomentum {
  const sorted = [...dealActivities].sort(
    (a, b) =>
      parseActivityDate(b.ActivityDate).getTime() -
      parseActivityDate(a.ActivityDate).getTime(),
  );
  const last = sorted[0];
  const daysSince = last ? daysBetween(last.ActivityDate) : 999;

  if (daysSince >= COLD_CONTACT_DAYS) return "Cold";
  if (daysSince >= STALLED_DAYS) return "Stalled";

  const recent30 = activitiesInWindow(dealActivities, 0, 30).length;
  const prior30 = activitiesInWindow(dealActivities, 30, 60).length;

  if (prior30 === 0 && recent30 > 0) return "Accelerating";
  if (recent30 > prior30 * 1.25) return "Accelerating";
  if (recent30 < prior30 * 0.75 && prior30 > 0) return "Stalled";
  return "Stable";
}

function countRiskSignals(
  company: Company,
  companyActivities: Activity[],
  pipelines: PipelineRow[],
  overdueCount: number,
): number {
  let count = overdueCount;

  for (const activity of companyActivities) {
    count += activity.Risks?.length ?? 0;
  }

  for (const dealId of company.pipelineIds) {
    const deal = pipelines.find((p) => p.id === dealId);
    if (!deal || ["Live Production", "Scheduled Maintenance"].includes(deal.status)) {
      continue;
    }
    const last = companyActivities
      .filter((a) => a.Deal?.Title === dealId)
      .sort(
        (a, b) =>
          parseActivityDate(b.ActivityDate).getTime() -
          parseActivityDate(a.ActivityDate).getTime(),
      )[0];
    if (!last || daysBetween(last.ActivityDate) >= STALLED_DAYS) {
      count += 1;
    }
  }

  return count;
}

export function buildNextBestActionInputs(ctx: NextBestActionContext): NextBestActionInputs {
  const acts = companyActivities(ctx);
  const sorted = [...acts].sort(
    (a, b) =>
      parseActivityDate(b.ActivityDate).getTime() -
      parseActivityDate(a.ActivityDate).getTime(),
  );
  const lastActivity = sorted[0];
  const openActions = acts.filter(isFollowUpOpen);
  const overdueActions = openActions.filter(isFollowUpOverdue);

  const deals: NextBestActionDealInput[] = [];

  for (const dealId of ctx.company.pipelineIds) {
    const deal = ctx.pipelines.find((p) => p.id === dealId);
    if (!deal || deal.status === "Scheduled Maintenance") continue;

    const dealActs = acts.filter((a) => a.Deal?.Title === dealId);
    const lastDealAct = [...dealActs].sort(
      (a, b) =>
        parseActivityDate(b.ActivityDate).getTime() -
        parseActivityDate(a.ActivityDate).getTime(),
    )[0];

    deals.push({
      dealId,
      dealName: deal.assetName,
      stage: deal.status,
      lifecycleStage: getLifecycleStage(deal.status),
      daysSinceLastActivity: lastDealAct ? daysBetween(lastDealAct.ActivityDate) : 999,
      momentum: computeDealMomentum(dealActs),
      activityCount30d: activitiesInWindow(dealActs, 0, 30).length,
      activityCountPrior30d: activitiesInWindow(dealActs, 30, 60).length,
    });
  }

  return {
    companyId: ctx.company.CompanyID,
    companyName: ctx.company.Title,
    healthScore: ctx.report.score,
    healthStatus: ctx.report.status,
    trend: ctx.report.trend,
    lastContactDays: lastActivity ? daysBetween(lastActivity.ActivityDate) : null,
    activityFrequency30d: activitiesInWindow(acts, 0, 30).length,
    activityFrequency90d: activitiesInWindow(acts, 0, 90).length,
    openCommitments: openActions.length,
    overdueActions: overdueActions.length,
    riskSignalCount: countRiskSignals(
      ctx.company,
      acts,
      ctx.pipelines,
      overdueActions.length,
    ),
    contactCount: ctx.company.contacts.length,
    deals,
    isNewRelationship: ctx.report.isNewRelationship,
  };
}

function withTitle(action: NextBestAction): RecommendedAction {
  return { ...action, title: action.action };
}

function pickBestCandidate(candidates: NextBestAction[]): NextBestAction {
  return candidates.sort((a, b) => {
    const priorityDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.confidenceScore - a.confidenceScore;
  })[0]!;
}

const DEFAULT_ACTION: NextBestAction = {
  id: "maintain-momentum",
  action: "Record Today's Interaction",
  reason: "Keep the relationship timeline current to preserve health signals.",
  priority: "Low",
  confidenceScore: 60,
  ruleId: "maintain_momentum",
  source: "rule",
};

/**
 * Rule registry — all rules evaluated; highest-priority + confidence wins.
 * Register additional rules via `registerNextBestActionRule`.
 */
export const NEXT_BEST_ACTION_RULES: NextBestActionRule[] = [
  {
    id: "complete_overdue_commitment",
    evaluate(inputs, ctx) {
      if (inputs.overdueActions === 0) return null;
      const overdue = companyActivities(ctx).filter(isFollowUpOverdue);
      const first = overdue[0];
      const label = first?.NextAction || first?.Subject || "open commitment";
      return {
        id: `nba-overdue-${ctx.company.CompanyID}`,
        action: "Complete Overdue Commitment",
        reason: `${inputs.overdueActions} overdue action${inputs.overdueActions === 1 ? "" : "s"} — "${label}" is damaging trust and health score (${inputs.healthScore}/100).`,
        priority: "High",
        confidenceScore: inputs.overdueActions >= 2 ? 96 : 92,
        ruleId: "complete_overdue_commitment",
        source: "rule",
      };
    },
  },
  {
    id: "schedule_follow_up_call",
    evaluate(inputs) {
      if (inputs.lastContactDays === null) return null;
      if (inputs.lastContactDays < COLD_CONTACT_DAYS && inputs.healthScore >= 50) return null;
      if (
        inputs.lastContactDays < 30 &&
        inputs.healthScore >= 50 &&
        inputs.trend !== "Declining"
      ) {
        return null;
      }

      const cold = inputs.lastContactDays >= COLD_CONTACT_DAYS;
      const atRisk = inputs.healthScore < 50;

      return {
        id: `nba-followup-${inputs.companyId}`,
        action: "Schedule Follow-Up Call",
        reason: cold
          ? `Last contact ${inputs.lastContactDays} days ago — relationship is cooling. Re-establish cadence before score drops further.`
          : atRisk
            ? `Health score ${inputs.healthScore}/100 with ${inputs.lastContactDays} days since last touch — proactive outreach needed.`
            : `Activity frequency declining — schedule a check-in within the week.`,
        priority: inputs.lastContactDays >= 60 || inputs.healthScore < 25 ? "High" : "Medium",
        confidenceScore: cold ? 90 : atRisk ? 86 : 78,
        ruleId: "schedule_follow_up_call",
        source: "rule",
      };
    },
  },
  {
    id: "follow_up_proposal",
    evaluate(inputs) {
      const deal = inputs.deals.find(
        (d) =>
          d.stage === "Contract Negotiation" &&
          (d.momentum === "Stalled" || d.momentum === "Cold"),
      );
      if (!deal) return null;
      return {
        id: `nba-proposal-${deal.dealId}`,
        action: "Follow Up Proposal",
        reason: `${deal.dealName} is in Contract Negotiation with ${deal.momentum.toLowerCase()} momentum — ${deal.daysSinceLastActivity} days since last activity.`,
        priority: "High",
        confidenceScore: deal.momentum === "Cold" ? 91 : 87,
        ruleId: "follow_up_proposal",
        source: "rule",
      };
    },
  },
  {
    id: "request_specification",
    evaluate(inputs) {
      const deal = inputs.deals.find(
        (d) =>
          d.stage === "Feedstock Analysis" &&
          d.daysSinceLastActivity >= 14,
      );
      if (!deal) return null;
      return {
        id: `nba-spec-${deal.dealId}`,
        action: "Request Specification",
        reason: `${deal.dealName} needs feedstock specification to advance from Feedstock Analysis — no activity in ${deal.daysSinceLastActivity} days.`,
        priority: "Medium",
        confidenceScore: 84,
        ruleId: "request_specification",
        source: "rule",
      };
    },
  },
  {
    id: "schedule_review_meeting",
    evaluate(inputs) {
      const deal = inputs.deals.find(
        (d) =>
          d.lifecycleStage === "delivery" &&
          (d.momentum === "Stalled" || d.momentum === "Cold"),
      );
      if (!deal) return null;
      return {
        id: `nba-review-${deal.dealId}`,
        action: "Schedule Review Meeting",
        reason: `${deal.dealName} at ${deal.stage} — align stakeholders on project progress (${deal.daysSinceLastActivity} days since last touch).`,
        priority: "Medium",
        confidenceScore: 82,
        ruleId: "schedule_review_meeting",
        source: "rule",
      };
    },
  },
  {
    id: "reengage_stalled_opportunity",
    evaluate(inputs) {
      const deal = inputs.deals.find(
        (d) =>
          d.lifecycleStage === "sales" &&
          (d.momentum === "Stalled" || d.momentum === "Cold"),
      );
      if (!deal) return null;
      return {
        id: `nba-stalled-${deal.dealId}`,
        action: "Re-engage Stalled Opportunity",
        reason: `${deal.dealName} (${deal.stage}) has ${deal.momentum.toLowerCase()} momentum — ${deal.daysSinceLastActivity} days without deal activity.`,
        priority: deal.momentum === "Cold" ? "High" : "Medium",
        confidenceScore: deal.momentum === "Cold" ? 88 : 80,
        ruleId: "reengage_stalled_opportunity",
        source: "rule",
      };
    },
  },
  {
    id: "create_new_opportunity",
    evaluate(inputs) {
      const salesDeals = inputs.deals.filter((d) => d.lifecycleStage === "sales");
      if (salesDeals.length > 0 || inputs.isNewRelationship) return null;
      if (inputs.contactCount === 0) return null;

      return {
        id: `nba-pipeline-${inputs.companyId}`,
        action: "Create New Opportunity",
        reason: `No active sales opportunities despite ${inputs.contactCount} contact${inputs.contactCount === 1 ? "" : "s"} — growth potential is untapped (health ${inputs.healthScore}/100).`,
        priority: inputs.healthScore >= 75 ? "Medium" : "Low",
        confidenceScore: inputs.healthScore >= 75 ? 76 : 68,
        ruleId: "create_new_opportunity",
        source: "rule",
      };
    },
  },
  {
    id: "address_risk_signals",
    evaluate(inputs) {
      if (inputs.riskSignalCount === 0 || inputs.overdueActions > 0) return null;
      return {
        id: `nba-risk-${inputs.companyId}`,
        action: "Schedule Follow-Up Call",
        reason: `${inputs.riskSignalCount} risk signal${inputs.riskSignalCount === 1 ? "" : "s"} detected — clarify blockers and reset commitments before health score erodes.`,
        priority: inputs.healthScore < 50 ? "High" : "Medium",
        confidenceScore: Math.min(90, 70 + inputs.riskSignalCount * 5),
        ruleId: "address_risk_signals",
        source: "rule",
      };
    },
  },
  {
    id: "close_open_commitments",
    evaluate(inputs, ctx) {
      if (inputs.openCommitments === 0 || inputs.overdueActions > 0) return null;
      const open = companyActivities(ctx).filter(isFollowUpOpen);
      const first = open[0];
      if (!first) return null;
      return {
        id: `nba-commitment-${first.ActivityID}`,
        action: "Complete Open Commitment",
        reason: `${inputs.openCommitments} open commitment${inputs.openCommitments === 1 ? "" : "s"} — close "${first.NextAction || first.Subject}" to strengthen reliability signals.`,
        priority: "Medium",
        confidenceScore: 74,
        ruleId: "close_open_commitments",
        source: "rule",
      };
    },
  },
  {
    id: "strategic_review",
    evaluate(inputs) {
      if (inputs.healthStatus !== "Strategic" && inputs.healthScore < 90) return null;
      if (inputs.activityFrequency30d >= 2) return null;
      return {
        id: `nba-strategic-${inputs.companyId}`,
        action: "Schedule Review Meeting",
        reason: `Strategic account (${inputs.healthScore}/100) — maintain executive cadence with a structured review.`,
        priority: "Medium",
        confidenceScore: 72,
        ruleId: "strategic_review",
        source: "rule",
      };
    },
  },
  {
    id: "new_relationship",
    evaluate(inputs) {
      if (!inputs.isNewRelationship) return null;
      return {
        id: `nba-new-${inputs.companyId}`,
        action: "Log First Interaction",
        reason: "New relationship — establish baseline activity, contacts, and health signals.",
        priority: "Medium",
        confidenceScore: 85,
        ruleId: "new_relationship",
        source: "rule",
      };
    },
  },
  {
    id: "add_contacts",
    evaluate(inputs) {
      if (inputs.contactCount > 0 || inputs.isNewRelationship) return null;
      return {
        id: `nba-contacts-${inputs.companyId}`,
        action: "Add Primary Contact",
        reason: "No contacts on file — relationship intelligence cannot measure contact diversity.",
        priority: "Medium",
        confidenceScore: 70,
        ruleId: "add_contacts",
        source: "rule",
      };
    },
  },
];

const extensionRules: NextBestActionRule[] = [];
const aiProviders: NextBestActionProvider[] = [];

/** Register additional deterministic rules (runs before core registry). */
export function registerNextBestActionRule(rule: NextBestActionRule): void {
  extensionRules.unshift(rule);
}

/** Future AI extension point — providers run first; null falls through to rules. */
export function registerNextBestActionProvider(provider: NextBestActionProvider): void {
  aiProviders.unshift(provider);
}

function evaluateAllRules(
  inputs: NextBestActionInputs,
  ctx: NextBestActionContext,
): NextBestAction[] {
  const rules = [...extensionRules, ...NEXT_BEST_ACTION_RULES];
  const candidates: NextBestAction[] = [];

  for (const rule of rules) {
    const result = rule.evaluate(inputs, ctx);
    if (result) candidates.push(result);
  }

  return candidates;
}

export function resolveNextBestAction(ctx: NextBestActionContext): RecommendedAction {
  const inputs = buildNextBestActionInputs(ctx);

  for (const provider of aiProviders) {
    const aiResult = provider.resolve(ctx, inputs);
    if (aiResult) return withTitle(aiResult);
  }

  const candidates = evaluateAllRules(inputs, ctx);
  if (candidates.length === 0) {
    return withTitle({
      ...DEFAULT_ACTION,
      id: `nba-default-${ctx.company.CompanyID}`,
    });
  }

  return withTitle(pickBestCandidate(candidates));
}

/** @deprecated Use resolveNextBestAction */
export const resolveRecommendedAction = resolveNextBestAction;

/** @deprecated Use registerNextBestActionRule */
export const registerRecommendedActionRule = registerNextBestActionRule;

/** @deprecated Use resolveNextBestAction */
export const resolveRecommendedActionWithExtensions = resolveNextBestAction;

/** @deprecated Use NEXT_BEST_ACTION_RULES */
export const RECOMMENDED_ACTION_RULES = NEXT_BEST_ACTION_RULES;

export type NextBestActionWithCompany = RecommendedAction & {
  companyId: string;
  companyName: string;
  healthScore: number;
  healthStatus: NextBestActionInputs["healthStatus"];
};

export function buildNextBestActionsForCompanies(
  companies: Company[],
  activities: Activity[],
  pipelines: PipelineRow[],
  computeHealth: (
    company: Company,
    activities: Activity[],
    pipelines: PipelineRow[],
  ) => RelationshipHealthSnapshot,
  limit = 6,
): NextBestActionWithCompany[] {
  const items: NextBestActionWithCompany[] = [];

  for (const company of companies) {
    const report = computeHealth(company, activities, pipelines);
    const action = resolveNextBestAction({
      company,
      report,
      activities,
      pipelines,
    });

    items.push({
      ...action,
      companyId: company.CompanyID,
      companyName: company.Title,
      healthScore: report.score,
      healthStatus: report.status,
    });
  }

  return items
    .sort((a, b) => {
      const priorityDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.confidenceScore - a.confidenceScore;
    })
    .slice(0, limit);
}

export const NEXT_BEST_ACTION_PRIORITY_STYLES: Record<
  NextBestActionPriority,
  string
> = {
  High: "border-red-500/30 bg-red-500/5 text-red-700",
  Medium: "border-upcycle-orange/30 bg-upcycle-orange/5 text-upcycle-orange",
  Low: "border-carbon-blue/15 bg-carbon-blue/[0.02] text-carbon-blue/70",
};

/** @deprecated Use NEXT_BEST_ACTION_PRIORITY_STYLES */
export const RECOMMENDED_ACTION_PRIORITY_STYLES = NEXT_BEST_ACTION_PRIORITY_STYLES;

export function getNextBestActionExplanation(): string {
  return (
    "Next Best Action Engine evaluates relationship health score, contact recency, " +
    "activity frequency, open commitments, overdue actions, deal stage, deal momentum, " +
    "and risk signals. All V1 recommendations are deterministic rules — no AI. " +
    "Priority: High, Medium, Low. Confidence reflects signal strength (0–100)."
  );
}

export type {
  NextBestActionRule as RecommendedActionRule,
  NextBestActionContext as RecommendedActionContext,
};
