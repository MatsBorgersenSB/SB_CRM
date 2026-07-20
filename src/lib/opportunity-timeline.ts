import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import type { PipelineRow } from "@/types/pipeline";
import { opportunityStageLabel } from "@/lib/opportunity-overview";
import { formatExpectedCloseDate } from "@/lib/opportunity-overview";
import type { OpportunityUnderstanding } from "@/lib/opportunity-workspace-intelligence";

export type TimelineMilestone = {
  id: string;
  title: string;
  dateLabel?: string;
  detail?: string;
};

export type RecommendedTimelineMilestone = TimelineMilestone & {
  reason: string;
  expectedImpact: string;
  suggestedTiming: string;
};

export type OpportunityTimeline = {
  roadmapSummary: string;
  completed: TimelineMilestone[];
  outstanding: TimelineMilestone[];
  recommended: RecommendedTimelineMilestone[];
};

const COMPLETED_STATUSES = new Set(["Completed"]);
const OUTSTANDING_STATUSES = new Set(["Open", "In Progress", "Planned", "Waiting"]);

const PACKAGE_MILESTONE_LABELS: Record<string, string> = {
  price_indication: "Price indication shared",
  budget_quotation: "Budget quotation delivered",
  formal_quotation: "Formal quotation accepted",
  contract: "Contract executed",
};

export function buildOpportunityTimeline(
  pipeline: PipelineRow,
  activities: Activity[],
  commercialPackages: CommercialPackage[],
  understanding: OpportunityUnderstanding,
  referenceDate: Date = new Date(),
): OpportunityTimeline {
  const dealPackages = commercialPackages.filter((pkg) => pkg.DealId === pipeline.id);
  const completed = buildCompletedMilestones(pipeline, activities, dealPackages);
  const outstanding = buildOutstandingMilestones(pipeline, activities, understanding);
  const recommended = buildRecommendedMilestones(
    pipeline,
    understanding,
    outstanding,
    referenceDate,
  );
  const roadmapSummary = buildRoadmapSummary(
    pipeline,
    dealPackages,
    understanding,
    outstanding,
    recommended,
  );

  return { roadmapSummary, completed, outstanding, recommended };
}

function buildCompletedMilestones(
  pipeline: PipelineRow,
  activities: Activity[],
  packages: CommercialPackage[],
): TimelineMilestone[] {
  const milestones: TimelineMilestone[] = [];

  for (const pkg of packages) {
    if (pkg.status !== "accepted" && pkg.status !== "superseded") continue;
    const label = PACKAGE_MILESTONE_LABELS[pkg.kind] ?? pkg.title;
    milestones.push({
      id: `pkg-${pkg.id}`,
      title: label,
      dateLabel: formatActivityDate(pkg.CreatedAt),
      detail: pkg.summary || pkg.title,
    });
  }

  for (const activity of activities) {
    if (!COMPLETED_STATUSES.has(activity.ActionStatus)) continue;
    milestones.push({
      id: `act-${activity.ActivityID}`,
      title: activity.Subject?.trim() || activity.ActivityType,
      dateLabel: formatActivityDate(activity.ActivityDate),
      detail: activity.Summary?.trim() || summarizeActivity(activity),
    });
  }

  if (pipeline.currentMilestone?.trim()) {
    milestones.push({
      id: "project-milestone",
      title: pipeline.currentMilestone,
      dateLabel: "Current project state",
      detail: `Project status: ${pipeline.status}`,
    });
  }

  return dedupeMilestones(milestones)
    .sort((a, b) => dateSortKey(b.dateLabel) - dateSortKey(a.dateLabel))
    .slice(0, 8);
}

function buildOutstandingMilestones(
  pipeline: PipelineRow,
  activities: Activity[],
  understanding: OpportunityUnderstanding,
): TimelineMilestone[] {
  const milestones: TimelineMilestone[] = [];

  for (const activity of activities) {
    if (!OUTSTANDING_STATUSES.has(activity.ActionStatus)) continue;
    const nextAction = activity.NextAction?.trim();
    milestones.push({
      id: `open-${activity.ActivityID}`,
      title: nextAction || activity.Subject?.trim() || "Follow up required",
      dateLabel: activity.NextActionDate
        ? formatExpectedCloseDate(activity.NextActionDate)
        : undefined,
      detail: activity.Summary?.trim() || activity.Subject?.trim(),
    });
  }

  for (const gap of understanding.knowledgeModel.criticalGaps.slice(0, 4)) {
    milestones.push({
      id: `gap-${gap.id}`,
      title: gap.missingInformation,
      dateLabel: gap.priority === "high" ? "Blocking progress" : "Needs resolution",
      detail: gap.recommendedAction,
    });
  }

  if (pipeline.expectedCloseDate) {
    milestones.push({
      id: "close-date",
      title: "Commercial close",
      dateLabel: formatExpectedCloseDate(pipeline.expectedCloseDate),
      detail: `Target close for ${pipeline.assetName}`,
    });
  }

  return dedupeMilestones(milestones).slice(0, 6);
}

function buildRecommendedMilestones(
  pipeline: PipelineRow,
  understanding: OpportunityUnderstanding,
  outstanding: TimelineMilestone[],
  referenceDate: Date,
): RecommendedTimelineMilestone[] {
  const recommendations: RecommendedTimelineMilestone[] = [];
  const nba = understanding.nextBestAction;

  recommendations.push({
    id: "nba-primary",
    title: nba.action,
    reason: nba.why,
    expectedImpact: nba.expectedImpact,
    suggestedTiming: suggestTiming("high", referenceDate),
  });

  for (const gap of understanding.knowledgeModel.criticalGaps.slice(0, 3)) {
    recommendations.push({
      id: `rec-gap-${gap.id}`,
      title: gap.recommendedAction.replace(/\.$/, ""),
      reason: gap.whyItMatters,
      expectedImpact: `Removes blocker: ${gap.missingInformation.toLowerCase()}`,
      suggestedTiming: suggestTiming(gap.priority, referenceDate),
    });
  }

  for (const conversation of understanding.recommendedConversations.slice(0, 2)) {
    recommendations.push({
      id: `rec-conv-${slug(conversation)}`,
      title: conversation,
      reason: "Relationship and commercial understanding advance through direct dialogue.",
      expectedImpact: "Keeps momentum while closing knowledge gaps.",
      suggestedTiming: suggestTiming("medium", referenceDate),
    });
  }

  if (pipeline.status === "Site Installation") {
    recommendations.push({
      id: "rec-commissioning",
      title: "Confirm commissioning readiness and acceptance criteria",
      reason: "Equipment is on site — commissioning gates revenue recognition and customer confidence.",
      expectedImpact: "Aligns both teams on go-live criteria and avoids last-minute scope disputes.",
      suggestedTiming: suggestTiming("high", referenceDate),
    });
  }

  const outstandingTitles = new Set(outstanding.map((item) => item.title.toLowerCase()));
  return dedupeRecommendations(recommendations)
    .filter((item) => !outstandingTitles.has(item.title.toLowerCase()))
    .slice(0, 5);
}

function buildRoadmapSummary(
  pipeline: PipelineRow,
  packages: CommercialPackage[],
  understanding: OpportunityUnderstanding,
  outstanding: TimelineMilestone[],
  recommended: RecommendedTimelineMilestone[],
): string {
  const acceptedQuote = packages.some(
    (pkg) => pkg.kind === "formal_quotation" && pkg.status === "accepted",
  );
  const topOutstanding = outstanding[0]?.title;
  const topRecommended = recommended[0]?.title;
  const stage = pipeline.status;

  const parts = [
    acceptedQuote ? "Commercial terms agreed" : null,
    pipeline.currentMilestone ? `${pipeline.currentMilestone} reached` : null,
    stage ? `now in ${stage}` : null,
    topOutstanding ? `Outstanding: ${topOutstanding.toLowerCase()}` : null,
    topRecommended ? `Next: ${topRecommended.charAt(0).toLowerCase()}${topRecommended.slice(1)}` : null,
  ].filter(Boolean);

  if (parts.length === 0) {
    return understanding.clientObjective.statement || "Build momentum with structured customer engagement.";
  }

  return parts.join(" · ");
}

function suggestTiming(
  priority: "high" | "medium" | "low" | string,
  referenceDate: Date,
): string {
  if (priority === "high") {
    return formatWeekLabel(addDays(referenceDate, 3));
  }
  if (priority === "medium") {
    return formatWeekLabel(addDays(referenceDate, 10));
  }
  return formatWeekLabel(addDays(referenceDate, 21));
}

function formatWeekLabel(date: Date): string {
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const diffDays = Math.floor((target.getTime() - today.getTime()) / 86_400_000);

  if (diffDays <= 0) return "This week";
  if (diffDays <= 7) return "This week";
  if (diffDays <= 14) return "Next week";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatActivityDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function summarizeActivity(activity: Activity): string {
  const decisions = activity.KeyDecisions?.[0];
  if (decisions) return decisions;
  return activity.ActivityType;
}

function dedupeMilestones(items: TimelineMilestone[]): TimelineMilestone[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeRecommendations(
  items: RecommendedTimelineMilestone[],
): RecommendedTimelineMilestone[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dateSortKey(label: string | undefined): number {
  if (!label) return 0;
  const parsed = Date.parse(label);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32);
}

export function topRecommendedMilestone(
  timeline: OpportunityTimeline,
): RecommendedTimelineMilestone | null {
  return timeline.recommended[0] ?? null;
}

export function opportunityTimelineStageLabel(
  pipeline: PipelineRow,
  commercialPackages: CommercialPackage[],
): string {
  return opportunityStageLabel(pipeline, commercialPackages);
}
