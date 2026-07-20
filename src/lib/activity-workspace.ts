import type { AttentionItem } from "@/types/attention-item";
import type {
  Activity,
  ActivityFilters,
  ActivityQuickFilter,
  ActivityType,
  ActionStatus,
  CreateActivityInput,
  M365ActivityTargets,
} from "@/types/activity";
import {
  isFollowUpOpen,
  isFollowUpOverdue,
  filterActivities,
} from "@/lib/activity-utils";
import type { Company } from "@/types/company";
import { isDraftEmailAction } from "@/lib/smartassist-email-engine";

export type SuggestedActivityAssistantKind = "email" | "activity" | "call" | "meeting";

export type SuggestedActivity = {
  id: string;
  label: string;
  reason: string;
  severity: AttentionItem["severity"];
  preset: Partial<CreateActivityInput>;
  attentionItem: AttentionItem;
  assistantKind: SuggestedActivityAssistantKind;
};

export type ActivityWorkspacePartitions = {
  planning: Activity[];
  execution: Activity[];
  history: Activity[];
};

const MEETING_TYPES: ActivityType[] = ["Meeting", "Teams Meeting"];
const CALL_TYPES: ActivityType[] = ["Phone Call"];
const TASK_TYPES: ActivityType[] = ["Task", "Note"];

function parseActivityDate(value: string): Date {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(normalized);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfWeek(date: Date): Date {
  const day = date.getDay();
  const diff = 7 - day;
  const end = new Date(date);
  end.setDate(end.getDate() + diff);
  end.setHours(23, 59, 59, 999);
  return end;
}

function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const start = new Date(date);
  start.setDate(start.getDate() - day);
  return startOfDay(start);
}

export function isActiveStatus(status: ActionStatus): boolean {
  return status !== "Completed" && status !== "Cancelled";
}

export function isPlannedStatus(status: ActionStatus): boolean {
  return status === "Planned" || status === "Open";
}

export function isExecutionStatus(status: ActionStatus): boolean {
  return status === "In Progress" || status === "Waiting";
}

export function isActivityThisWeek(activity: Activity): boolean {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);

  const activityDate = parseActivityDate(activity.ActivityDate);
  if (activityDate >= weekStart && activityDate <= weekEnd) return true;

  if (activity.NextActionDate) {
    const due = parseActivityDate(activity.NextActionDate);
    if (due >= weekStart && due <= weekEnd) return true;
  }

  return false;
}

export function activityNeedsAttention(activity: Activity): boolean {
  if (isFollowUpOverdue(activity)) return true;
  if (!isFollowUpOpen(activity) || !activity.NextActionDate) return false;

  const due = startOfDay(parseActivityDate(activity.NextActionDate));
  const today = startOfDay(new Date());
  const diffDays = Math.floor((due.getTime() - today.getTime()) / 86_400_000);
  return diffDays >= 0 && diffDays <= 3;
}

export function inferM365Targets(type: ActivityType): M365ActivityTargets {
  switch (type) {
    case "Teams Meeting":
      return { outlook: true, teams: true };
    case "Meeting":
      return { outlook: true };
    case "Task":
      return { planner: true };
    case "Note":
      return { onenote: true };
    case "Email Follow-Up":
    case "Email":
      return { outlook: true };
    default:
      return {};
  }
}

export function applyActivityQuickFilter(
  activities: Activity[],
  quickFilter: ActivityQuickFilter,
  currentUserName?: string,
): Activity[] {
  if (quickFilter === "all") return activities;

  return activities.filter((activity) => {
    switch (quickFilter) {
      case "mine":
        return (
          Boolean(currentUserName) &&
          activity.ActivityOwner?.Title?.toLowerCase() === currentUserName!.toLowerCase()
        );
      case "planned":
        return isPlannedStatus(activity.ActionStatus) && isActiveStatus(activity.ActionStatus);
      case "overdue":
        return isFollowUpOverdue(activity);
      case "completed":
        return activity.ActionStatus === "Completed";
      case "this_week":
        return isActivityThisWeek(activity);
      case "needs_attention":
        return activityNeedsAttention(activity);
      case "meetings":
        return MEETING_TYPES.includes(activity.ActivityType);
      case "calls":
        return CALL_TYPES.includes(activity.ActivityType);
      case "tasks":
        return TASK_TYPES.includes(activity.ActivityType);
      default:
        return true;
    }
  });
}

export function filterActivitiesForWorkspace(
  activities: Activity[],
  filters: ActivityFilters,
  companies: Company[],
  currentUserName?: string,
): Activity[] {
  const base = filterActivities(activities, filters, companies);
  return applyActivityQuickFilter(base, filters.quickFilter, currentUserName);
}

export function partitionActivitiesForWorkspace(
  activities: Activity[],
): ActivityWorkspacePartitions {
  const planning: Activity[] = [];
  const execution: Activity[] = [];
  const history: Activity[] = [];

  const sorted = [...activities].sort(
    (a, b) =>
      parseActivityDate(b.ActivityDate).getTime() -
      parseActivityDate(a.ActivityDate).getTime(),
  );

  for (const activity of sorted) {
    if (activity.ActionStatus === "Completed" || activity.ActionStatus === "Cancelled") {
      history.push(activity);
      continue;
    }

    if (isExecutionStatus(activity.ActionStatus) || isFollowUpOverdue(activity)) {
      execution.push(activity);
      continue;
    }

    if (isPlannedStatus(activity.ActionStatus) || isFollowUpOpen(activity)) {
      planning.push(activity);
      continue;
    }

    history.push(activity);
  }

  return { planning, execution, history };
}

const ACTIVITY_SUGGESTION_RULES: Record<
  string,
  { type: ActivityType; subject: string; actionRequired?: boolean }
> = {
  no_activity: {
    type: "Phone Call",
    subject: "Log first interaction",
    actionRequired: false,
  },
  no_recent_contact: {
    type: "Phone Call",
    subject: "Schedule follow-up call",
    actionRequired: true,
  },
  stalled_opportunity: {
    type: "Meeting",
    subject: "Re-engage stalled opportunity",
    actionRequired: true,
  },
  overdue_followup: {
    type: "Task",
    subject: "Complete overdue commitment",
    actionRequired: true,
  },
  due_today: {
    type: "Task",
    subject: "Complete commitment due today",
    actionRequired: true,
  },
  maintain_momentum: {
    type: "Email Follow-Up",
    subject: "Maintain relationship momentum",
    actionRequired: true,
  },
};

export function resolveAssistantKind(item: AttentionItem): SuggestedActivityAssistantKind {
  if (isDraftEmailAction(item)) return "email";
  const action = item.suggestedAiAction.toLowerCase();
  if (action.includes("schedule meeting") || action.includes("teams meeting")) return "meeting";
  if (action.includes("call") || action.includes("phone")) return "call";
  return "activity";
}

function buildSuggestionPreset(
  item: AttentionItem,
  template: { type: ActivityType; subject: string; actionRequired?: boolean } | undefined,
  context?: {
    companyId?: string;
    contactId?: string;
    dealId?: string;
    companyName?: string;
    contactName?: string;
  },
): Partial<CreateActivityInput> {
  const companyId = context?.companyId ?? item.companyId;
  return {
    ActivityType: template?.type ?? "Task",
    Subject: template?.subject ?? item.suggestedAiAction,
    Summary: item.recommendation,
    ActionRequired: template?.actionRequired ?? false,
    ActionStatus: "Planned",
    NextAction: item.suggestedAiAction,
    NextActionDate: item.dueDate ?? "",
    Company: companyId ? { CompanyID: companyId } : null,
    Contact: context?.contactId ? { ContactID: context.contactId } : null,
    Deal: context?.dealId ? { DealID: context.dealId } : null,
    M365Targets: inferM365Targets(template?.type ?? "Task"),
  };
}

export function buildSuggestedActivities(
  attentionItems: AttentionItem[],
  context?: {
    companyId?: string;
    contactId?: string;
    dealId?: string;
    companyName?: string;
    contactName?: string;
  },
): SuggestedActivity[] {
  const suggestions: SuggestedActivity[] = [];
  const seen = new Set<string>();

  for (const item of attentionItems) {
    if (item.status !== "open") continue;

    const assistantKind = resolveAssistantKind(item);
    const template = ACTIVITY_SUGGESTION_RULES[item.ruleId];
    if (!template && assistantKind === "activity") continue;

    const key = `${item.ruleId}-${item.sourceObjectId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    suggestions.push({
      id: `suggest-${item.id}`,
      label: item.suggestedAiAction,
      reason: item.recommendation,
      severity: item.severity,
      attentionItem: item,
      assistantKind,
      preset: buildSuggestionPreset(item, template, context),
    });

    if (suggestions.length >= 5) break;
  }

  return suggestions;
}

export function formatActivityTime(value: string): string {
  const date = parseActivityDate(value);
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function formatDuration(minutes?: number): string {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function statusBadgeClass(status: ActionStatus): string {
  switch (status) {
    case "Planned":
    case "Open":
      return "bg-sky-500/10 text-sky-700 border-sky-500/20";
    case "In Progress":
      return "bg-upcycle-orange/10 text-upcycle-orange border-upcycle-orange/25";
    case "Waiting":
      return "bg-amber-500/10 text-amber-700 border-amber-500/20";
    case "Completed":
      return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
    case "Cancelled":
      return "bg-carbon-blue/5 text-carbon-blue/50 border-carbon-blue/10";
    default:
      return "bg-carbon-blue/5 text-carbon-blue/60 border-carbon-blue/10";
  }
}

export function priorityBadgeClass(priority?: string): string {
  switch (priority) {
    case "Urgent":
      return "text-red-600";
    case "High":
      return "text-upcycle-orange";
    case "Low":
      return "text-carbon-blue/45";
    default:
      return "text-carbon-blue/60";
  }
}
