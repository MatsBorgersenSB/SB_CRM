import type { Activity, ActivityType } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { formatActivityDateTime, formatDueDate, isFollowUpOpen, isFollowUpOverdue } from "@/lib/activity-utils";
import { buildActivityFocusItem } from "@/lib/activity-mission-control";
import { isExecutionStatus } from "@/lib/activity-workspace";
import { buildRelationshipMemory } from "@/lib/relationship-memory";
import { companyHref, deal360Href } from "@/types/relationship-navigation";

export type ActivityBusinessState =
  | "overdue"
  | "due_today"
  | "waiting"
  | "in_progress"
  | "requires_attention"
  | "on_track"
  | "completed"
  | "cancelled";

export type BlockerCategory =
  | "waiting_customer"
  | "waiting_standard_bio"
  | "waiting_third_party"
  | "missing_information"
  | "missing_decision_maker"
  | "overdue_commitment"
  | "none";

export const BUSINESS_STATE_LABELS: Record<ActivityBusinessState, string> = {
  overdue: "Overdue",
  due_today: "Due today",
  waiting: "Waiting",
  in_progress: "In progress",
  requires_attention: "Requires attention",
  on_track: "On track",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const BLOCKER_CATEGORY_LABELS: Record<BlockerCategory, string> = {
  waiting_customer: "Waiting for customer",
  waiting_standard_bio: "Waiting for Standard Bio",
  waiting_third_party: "Waiting for third party",
  missing_information: "Missing information",
  missing_decision_maker: "Missing decision maker",
  overdue_commitment: "Overdue commitment",
  none: "No active blocker",
};

export type ActivityBriefingContext = {
  companyName: string | null;
  companyHref: string | null;
  contactName: string | null;
  dealName: string | null;
  dealHref: string | null;
};

export type ActivityBriefingSupport = {
  interactionDetail: string | null;
  decisions: string[];
  agreements: string[];
  additionalRisks: string[];
  stakeholders: Array<{ name: string; role?: string }>;
  documents: Array<{ title: string }>;
  relatedActivityIds: string[];
};

export type ActivityBriefing = {
  activityId: string;
  name: string;
  activityType: string;
  documentLabel: string;
  status: Activity["ActionStatus"];
  statusLabel: string;
  businessState: ActivityBusinessState;
  businessStateLabel: string;
  occurredAt: string;
  timingLabel: string | null;
  context: ActivityBriefingContext;
  /** Woven opening — why this matters + what blocks, without repeating labels */
  situationParagraph: string;
  whyItMatters: string;
  blockingProgress: string;
  blockerCategory: BlockerCategory;
  blockerCategoryLabel: string;
  nextStep: string;
  nextStepDue: string | null;
  requiresAttention: boolean;
  support: ActivityBriefingSupport;
};

function isDueToday(activity: Activity): boolean {
  if (!activity.NextActionDate || !isFollowUpOpen(activity)) return false;
  const due = new Date(activity.NextActionDate.includes("T") ? activity.NextActionDate : `${activity.NextActionDate}T00:00:00`);
  const today = new Date();
  return (
    due.getFullYear() === today.getFullYear() &&
    due.getMonth() === today.getMonth() &&
    due.getDate() === today.getDate()
  );
}

function resolveBusinessState(activity: Activity, requiresAttention: boolean): ActivityBusinessState {
  if (activity.ActionStatus === "Completed") return "completed";
  if (activity.ActionStatus === "Cancelled") return "cancelled";
  if (isFollowUpOverdue(activity)) return "overdue";
  if (isDueToday(activity)) return "due_today";
  if (requiresAttention && activity.ActionStatus === "Waiting") return "waiting";
  if (isExecutionStatus(activity.ActionStatus)) return "in_progress";
  if (requiresAttention) return "requires_attention";
  return "on_track";
}

function inferBlockerCategory(activity: Activity, blockingText: string): BlockerCategory {
  const text = blockingText.toLowerCase();

  if (isFollowUpOverdue(activity)) return "overdue_commitment";

  if (activity.ActionStatus === "Waiting") {
    if (/standard bio|internal|our team|sb /.test(text)) return "waiting_standard_bio";
    if (/third party|authority|permit|regulator|vendor|supplier/.test(text)) {
      return "waiting_third_party";
    }
    return "waiting_customer";
  }

  if (/decision maker|decision authority|economic buyer|budget authority/.test(text)) {
    return "missing_decision_maker";
  }

  if (
    /no next step|missing information|not captured|undefined|without a decision/.test(text)
  ) {
    return "missing_information";
  }

  if (text.includes("no active blocker") || text.includes("nothing blocking")) {
    return "none";
  }

  if (activity.Risks?.length) return "missing_information";

  return "none";
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function isDuplicateOf(a: string, b: string): boolean {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function deriveDocumentLabel(type: ActivityType): string {
  switch (type) {
    case "Meeting":
    case "Teams Meeting":
      return "Minutes";
    case "Phone Call":
      return "Call note";
    case "Email":
    case "Email Follow-Up":
      return "Email note";
    case "Site Visit":
      return "Visit note";
    case "Proposal Sent":
      return "Proposal note";
    case "Technical Review":
    case "Commercial Review":
      return "Review note";
    case "Note":
      return "Note";
    default:
      return "Activity note";
  }
}

function buildSituationParagraph(
  whyItMatters: string,
  blockingProgress: string,
  blockerCategory: BlockerCategory,
  blockerCategoryLabel: string,
): string {
  const why = whyItMatters.trim();
  const block = blockingProgress.trim();

  if (!block || blockerCategory === "none" || isDuplicateOf(why, block)) {
    return why;
  }

  if (isDuplicateOf(why, blockerCategoryLabel)) {
    return `${why} ${block.endsWith(".") ? block : `${block}.`}`;
  }

  if (block.length < 60) {
    return `${why} ${block.endsWith(".") ? block : `${block}.`}`;
  }

  return `${why} ${blockerCategoryLabel.toLowerCase()}: ${block.endsWith(".") ? block : `${block}.`}`;
}

function buildSupport(
  activity: Activity,
  memory: ReturnType<typeof buildRelationshipMemory>,
  focus: ReturnType<typeof buildActivityFocusItem>,
  allActivities: Activity[],
): ActivityBriefingSupport {
  const subject = activity.Subject?.trim() ?? "";
  const blocking = focus.blockingProgress;
  const nextStep = focus.recommendedAction;

  const interactionDetail =
    memory.whatHappened &&
    !isDuplicateOf(memory.whatHappened, subject) &&
    !isDuplicateOf(memory.whatHappened, memory.summary) &&
    !isDuplicateOf(memory.whatHappened, focus.whyItMatters)
      ? memory.whatHappened
      : null;

  const agreements = [
    ...new Set(
      [
        ...memory.whatWasAgreed,
        ...memory.commitments.map((item) => item.text),
      ].filter(
        (item) =>
          item.trim() &&
          !isDuplicateOf(item, nextStep) &&
          !isDuplicateOf(item, activity.NextAction ?? ""),
      ),
    ),
  ];

  const additionalRisks = memory.risks.filter(
    (risk) => risk.trim() && !isDuplicateOf(risk, blocking),
  );

  const primaryContact = activity.Contact?.Title?.trim();
  const stakeholders = memory.stakeholders
    .filter((person) => !primaryContact || person.name !== primaryContact)
    .map((person) => ({ name: person.name, role: person.role }));

  const documents = memory.linkedDocuments.map((doc) => ({ title: doc.Title }));

  const relatedActivityIds = allActivities
    .filter((item) => item.ActivityID !== activity.ActivityID)
    .filter((item) => {
      if (activity.Company?.Title && item.Company?.Title === activity.Company.Title) return true;
      if (activity.Deal?.Title && item.Deal?.Title === activity.Deal.Title) return true;
      return false;
    })
    .slice(0, 5)
    .map((item) => item.ActivityID);

  return {
    interactionDetail,
    decisions: memory.decisions.filter((item) => item.trim()),
    agreements,
    additionalRisks,
    stakeholders,
    documents,
    relatedActivityIds,
  };
}

export function buildActivityBriefing(
  activity: Activity,
  pipelines: PipelineRow[],
  companies: Company[],
  allActivities: Activity[] = [],
): ActivityBriefing {
  const focus = buildActivityFocusItem(activity, pipelines);
  const memory = buildRelationshipMemory(activity);
  const company = companies.find((item) => item.Title === activity.Company?.Title);
  const deal = pipelines.find((item) => item.id === activity.Deal?.Title);
  const businessState = resolveBusinessState(activity, focus.requiresAttention);
  const blockerCategory = inferBlockerCategory(activity, focus.blockingProgress);

  const nextStepDue =
    activity.ActionRequired && activity.NextActionDate
      ? formatDueDate(activity.NextActionDate)
      : null;

  const whyItMatters = focus.whyItMatters;
  const blockingProgress = focus.blockingProgress;

  return {
    activityId: activity.ActivityID,
    name: activity.Subject?.trim() || activity.ActivityType,
    activityType: activity.ActivityType,
    documentLabel: deriveDocumentLabel(activity.ActivityType),
    status: activity.ActionStatus,
    statusLabel: activity.ActionStatus,
    businessState,
    businessStateLabel: BUSINESS_STATE_LABELS[businessState],
    occurredAt: formatActivityDateTime(activity.ActivityDate),
    timingLabel: focus.timingLabel ?? null,
    context: {
      companyName: activity.Company?.Title ?? null,
      companyHref: company ? companyHref(company.CompanyID) : null,
      contactName: activity.Contact?.Title ?? null,
      dealName: deal?.assetName ?? activity.Deal?.Title ?? null,
      dealHref: deal ? deal360Href(deal.id) : null,
    },
    situationParagraph: buildSituationParagraph(
      whyItMatters,
      blockingProgress,
      blockerCategory,
      BLOCKER_CATEGORY_LABELS[blockerCategory],
    ),
    whyItMatters,
    blockingProgress,
    blockerCategory,
    blockerCategoryLabel: BLOCKER_CATEGORY_LABELS[blockerCategory],
    nextStep: focus.recommendedAction,
    nextStepDue,
    requiresAttention: focus.requiresAttention,
    support: buildSupport(activity, memory, focus, allActivities),
  };
}

export function briefingHasSupportContent(support: ActivityBriefingSupport): boolean {
  return (
    Boolean(support.interactionDetail) ||
    support.decisions.length > 0 ||
    support.agreements.length > 0 ||
    support.additionalRisks.length > 0 ||
    support.stakeholders.length > 0 ||
    support.documents.length > 0 ||
    support.relatedActivityIds.length > 0
  );
}
