import type { Activity } from "@/types/activity";
import type { PipelineRow } from "@/types/pipeline";
import {
  formatDueDate,
  isFollowUpOpen,
  isFollowUpOverdue,
} from "@/lib/activity-utils";
import {
  activityNeedsAttention,
  isActiveStatus,
  isActivityThisWeek,
  isExecutionStatus,
} from "@/lib/activity-workspace";

export type ActivityMissionView = "today" | "this_week" | "completed";

/** Ranked item in the business development attention queue. */
export type ActivityFocusItem = {
  id: string;
  activity: Activity;
  headline: string;
  whyItMatters: string;
  blockingProgress: string;
  recommendedAction: string;
  timingLabel?: string;
  priority: "urgent" | "high" | "normal";
  requiresAttention: boolean;
};

export type ActivityAttentionSnapshot = {
  headline: string;
  subline: string;
  requiresAttentionCount: number;
  overdueCount: number;
};

export type ActivityMissionControl = {
  /** @deprecated Use attention — kept for compatibility */
  summary: string;
  attention: ActivityAttentionSnapshot;
  overdueCount: number;
  todayFocus: ActivityFocusItem | null;
  needsAttention: ActivityFocusItem[];
  upcoming: ActivityFocusItem[];
  thisWeek: ActivityFocusItem[];
  completed: Activity[];
  openRisks: string[];
};

function parseActivityDate(value: string): Date {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(normalized);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isDueToday(activity: Activity): boolean {
  if (!activity.NextActionDate || !isFollowUpOpen(activity)) return false;
  return (
    startOfDay(parseActivityDate(activity.NextActionDate)).getTime() ===
    startOfDay(new Date()).getTime()
  );
}

function isUpcoming(activity: Activity): boolean {
  if (!isFollowUpOpen(activity) || !activity.NextActionDate) return false;
  if (isFollowUpOverdue(activity) || isDueToday(activity)) return false;
  if (activityNeedsAttention(activity)) return false;

  const due = startOfDay(parseActivityDate(activity.NextActionDate));
  const today = startOfDay(new Date());
  const diffDays = Math.floor((due.getTime() - today.getTime()) / 86_400_000);
  return diffDays > 0 && diffDays <= 14;
}

function itemRequiresAttention(activity: Activity): boolean {
  return (
    isFollowUpOverdue(activity) ||
    isDueToday(activity) ||
    activityNeedsAttention(activity) ||
    isExecutionStatus(activity.ActionStatus)
  );
}

function priorityScore(item: ActivityFocusItem): number {
  const weights = { urgent: 300, high: 200, normal: 100 };
  let score = weights[item.priority];
  if (item.activity.Priority === "Urgent") score += 50;
  if (item.activity.Priority === "High") score += 25;
  if (item.timingLabel?.toLowerCase().includes("overdue")) score += 100;
  if (item.activity.Risks?.length) score += 40;
  if (item.activity.ActionStatus === "Waiting") score += 30;
  return score;
}

function resolveDealName(activity: Activity, pipelines: PipelineRow[]): string | null {
  const dealId = activity.Deal?.Title;
  if (!dealId) return null;
  return pipelines.find((pipeline) => pipeline.id === dealId)?.assetName ?? dealId;
}

function buildWhyItMatters(activity: Activity, pipelines: PipelineRow[]): string {
  const dealName = resolveDealName(activity, pipelines);
  const account = activity.Company?.Title;

  if (isFollowUpOverdue(activity)) {
    return dealName
      ? `Overdue follow-up on ${dealName} — commercial credibility and deal momentum are at risk.`
      : "Overdue follow-up — relationship trust erodes when commitments slip.";
  }

  if (isDueToday(activity)) {
    return dealName
      ? `Due today on ${dealName} — timely action maintains commercial momentum.`
      : "Due today — keeping commitments protects relationship health.";
  }

  if (activity.ActionStatus === "Waiting") {
    return dealName
      ? `Waiting state on ${dealName} — stalled engagement slows opportunity progress.`
      : "Waiting on resolution — relationship momentum decays without follow-through.";
  }

  if (activity.ActionOutcome === "Negative") {
    return dealName
      ? `Negative outcome on ${dealName} — recovery action needed to protect the opportunity.`
      : "Negative interaction outcome — relationship recovery is required.";
  }

  const risk = activity.Risks?.[0];
  if (risk) {
    const target = dealName ?? account ?? "this engagement";
    return `Risk surfaced affecting ${target}: ${risk}`;
  }

  if (dealName) {
    return `Advances ${dealName} — this touchpoint affects opportunity health and stakeholder coverage.`;
  }

  if (account) {
    return `Maintains relationship with ${account} — consistent engagement drives future opportunities.`;
  }

  if (activity.Summary?.trim()) return activity.Summary.trim();

  return "Requires attention to prevent relationship or opportunity drift.";
}

function buildBlockingProgress(activity: Activity, pipelines: PipelineRow[]): string {
  if (activity.Risks?.[0]) return activity.Risks[0];

  if (activity.ActionStatus === "Waiting") {
    return activity.Summary?.trim()
      ? `Waiting — ${activity.Summary.trim()}`
      : "Blocked waiting on external or internal response.";
  }

  if (isFollowUpOverdue(activity)) {
    return "Overdue commitment — customer or stakeholder is waiting on follow-through.";
  }

  if (activity.ActionRequired && !activity.NextAction?.trim()) {
    return "No next step defined — progress cannot continue without a decision.";
  }

  if (isExecutionStatus(activity.ActionStatus) && !activity.Summary?.trim()) {
    return "In progress without captured outcome — decision context may be lost.";
  }

  if (activity.ActionOutcome === "Negative") {
    return "Previous interaction outcome was negative — objection or concern unresolved.";
  }

  const dealName = resolveDealName(activity, pipelines);
  if (dealName && itemRequiresAttention(activity)) {
    return `Opportunity momentum for ${dealName} depends on completing this engagement.`;
  }

  if (!activity.NextActionDate && activity.ActionRequired && isFollowUpOpen(activity)) {
    return "No due date set — commitment timing is undefined.";
  }

  return "No active blocker — act before attention decays.";
}

function buildRecommendedAction(activity: Activity): string {
  if (activity.NextAction?.trim()) return activity.NextAction.trim();

  if (isFollowUpOverdue(activity)) {
    return "Complete the overdue commitment or reschedule with the customer immediately.";
  }

  if (activity.ActionStatus === "Waiting") {
    return "Follow up to unblock — confirm status and define the next commitment.";
  }

  if (isExecutionStatus(activity.ActionStatus)) {
    return "Capture the outcome and define the next customer touchpoint.";
  }

  return "Define and schedule the next customer engagement.";
}

function toFocusItem(activity: Activity, pipelines: PipelineRow[]): ActivityFocusItem {
  const overdue = isFollowUpOverdue(activity);
  const dueToday = isDueToday(activity);
  const requiresAttention = itemRequiresAttention(activity);
  const priority: ActivityFocusItem["priority"] = overdue
    ? "urgent"
    : dueToday || requiresAttention
      ? "high"
      : "normal";

  let timingLabel: string | undefined;
  if (overdue) timingLabel = "Overdue";
  else if (dueToday) timingLabel = "Due today";
  else if (activity.NextActionDate) timingLabel = formatDueDate(activity.NextActionDate);

  return {
    id: activity.ActivityID,
    activity,
    headline: activity.Subject?.trim() || activity.ActivityType,
    whyItMatters: buildWhyItMatters(activity, pipelines),
    blockingProgress: buildBlockingProgress(activity, pipelines),
    recommendedAction: buildRecommendedAction(activity),
    timingLabel,
    priority,
    requiresAttention,
  };
}

/** Single-activity intelligence — shared by work queue and activity briefing. */
export function buildActivityFocusItem(
  activity: Activity,
  pipelines: PipelineRow[],
): ActivityFocusItem {
  return toFocusItem(activity, pipelines);
}

function sortFocusItems(items: ActivityFocusItem[]): ActivityFocusItem[] {
  return [...items].sort((a, b) => priorityScore(b) - priorityScore(a));
}

function buildAttentionSnapshot(
  requiresAttentionCount: number,
  overdueCount: number,
  todayFocus: ActivityFocusItem | null,
): ActivityAttentionSnapshot {
  if (requiresAttentionCount === 0) {
    return {
      headline: "Nothing requires immediate attention",
      subline: "Review upcoming engagements below — proactive outreach prevents drift.",
      requiresAttentionCount: 0,
      overdueCount: 0,
    };
  }

  if (overdueCount > 0 && todayFocus) {
    return {
      headline: `${requiresAttentionCount} require attention · ${overdueCount} overdue`,
      subline: "Ranked in the table below.",
      requiresAttentionCount,
      overdueCount,
    };
  }

  if (todayFocus) {
    return {
      headline: `${requiresAttentionCount} require attention`,
      subline: "Ranked in the table below.",
      requiresAttentionCount,
      overdueCount,
    };
  }

  return {
    headline: `${requiresAttentionCount} require attention this week`,
    subline: "Review the table below — the system has ranked what matters most.",
    requiresAttentionCount,
    overdueCount,
  };
}

export function buildActivityMissionControl(
  activities: Activity[],
  pipelines: PipelineRow[],
  ownerName?: string,
): ActivityMissionControl {
  const scoped = ownerName
    ? activities.filter(
        (activity) =>
          activity.ActivityOwner?.Title?.toLowerCase() === ownerName.toLowerCase(),
      )
    : activities;

  const active = scoped.filter((activity) => isActiveStatus(activity.ActionStatus));
  const completed = scoped
    .filter((activity) => activity.ActionStatus === "Completed")
    .sort(
      (a, b) =>
        parseActivityDate(b.ActivityDate).getTime() -
        parseActivityDate(a.ActivityDate).getTime(),
    );

  const attentionCandidates = active.filter(itemRequiresAttention);

  const needsAttention = sortFocusItems(
    attentionCandidates.map((activity) => toFocusItem(activity, pipelines)),
  );

  const upcoming = sortFocusItems(
    active
      .filter(isUpcoming)
      .map((activity) => toFocusItem(activity, pipelines)),
  );

  const thisWeek = sortFocusItems(
    active
      .filter((activity) => isActivityThisWeek(activity) && !isFollowUpOverdue(activity))
      .map((activity) => toFocusItem(activity, pipelines)),
  );

  const todayFocus = needsAttention[0] ?? upcoming[0] ?? thisWeek[0] ?? null;
  const overdueCount = active.filter(isFollowUpOverdue).length;
  const requiresAttentionCount = needsAttention.length;

  const attention = buildAttentionSnapshot(requiresAttentionCount, overdueCount, todayFocus);

  const openRisks = Array.from(
    new Set(active.flatMap((activity) => activity.Risks ?? []).filter(Boolean)),
  ).slice(0, 8);

  return {
    summary: attention.headline,
    attention,
    overdueCount,
    todayFocus,
    needsAttention: needsAttention.filter((item) => item.id !== todayFocus?.id),
    upcoming,
    thisWeek,
    completed,
    openRisks,
  };
}

export const ACTIVITY_MISSION_VIEWS = [
  { id: "today" as const, label: "Today" },
  { id: "this_week" as const, label: "This Week" },
  { id: "completed" as const, label: "Completed" },
];

export type ActivityWorkFilter =
  | "all"
  | "attention"
  | "overdue"
  | "due_today"
  | "this_week"
  | "completed";

export const ACTIVITY_WORK_FILTERS: Array<{ id: ActivityWorkFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "attention", label: "Requires attention" },
  { id: "overdue", label: "Overdue" },
  { id: "due_today", label: "Due today" },
  { id: "this_week", label: "This week" },
  { id: "completed", label: "Completed" },
];

export type ActivityIntelligentRow = ActivityFocusItem & {
  companyLabel: string;
  dealLabel: string;
  statusLabel: string;
  isCompleted: boolean;
};

export function buildActivityIntelligentRows(
  activities: Activity[],
  pipelines: PipelineRow[],
): ActivityIntelligentRow[] {
  return activities
    .map((activity) => {
      const focus = toFocusItem(activity, pipelines);
      return {
        ...focus,
        companyLabel: activity.Company?.Title ?? "—",
        dealLabel: activity.Deal?.Title ?? "—",
        statusLabel: activity.ActionStatus,
        isCompleted: activity.ActionStatus === "Completed",
      };
    })
    .sort((a, b) => priorityScore(b) - priorityScore(a));
}

export function filterActivityRows(
  rows: ActivityIntelligentRow[],
  filter: ActivityWorkFilter,
): ActivityIntelligentRow[] {
  return rows.filter((row) => {
    const activity = row.activity;
    if (filter === "completed") return row.isCompleted;
    if (row.isCompleted) return false;

    switch (filter) {
      case "all":
        return true;
      case "attention":
        return row.requiresAttention;
      case "overdue":
        return isFollowUpOverdue(activity);
      case "due_today":
        return isDueToday(activity);
      case "this_week":
        return isActivityThisWeek(activity);
      default:
        return true;
    }
  });
}

export function countActivityWorkFilters(
  rows: ActivityIntelligentRow[],
): Record<ActivityWorkFilter, number> {
  return {
    all: rows.filter((row) => !row.isCompleted).length,
    attention: filterActivityRows(rows, "attention").length,
    overdue: filterActivityRows(rows, "overdue").length,
    due_today: filterActivityRows(rows, "due_today").length,
    this_week: filterActivityRows(rows, "this_week").length,
    completed: rows.filter((row) => row.isCompleted).length,
  };
}
