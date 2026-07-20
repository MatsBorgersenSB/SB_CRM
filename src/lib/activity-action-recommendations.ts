import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type {
  ActivityActionRecommendation,
  ActivityActionRecommendations,
  ActivityRecommendedActionType,
  PreparedCallAction,
  PreparedEmailAction,
  PreparedEscalationAction,
  PreparedFollowUpAction,
  PreparedTeamsMeetingAction,
} from "@/types/activity-action-recommendations";
import { ACTIVITY_ACTION_LABELS } from "@/types/activity-action-recommendations";
import type { ActivityBriefing } from "@/lib/activity-briefing";
import { buildActivityTeamsMeeting } from "@/lib/smartassist-meeting-engine";
import type { ConfidenceLevel } from "@/lib/opportunity-workspace-intelligence";
import { formatDueDate } from "@/lib/activity-utils";

type RecommendationContext = {
  activity: Activity;
  briefing: ActivityBriefing;
  companies: Company[];
  pipelines: PipelineRow[];
};

function contactFirstName(activity: Activity): string {
  return activity.Contact?.Title?.split(" ")[0] ?? "there";
}

function resolveContactEmail(activity: Activity, companies: Company[]): string {
  const company = companies.find((row) => row.Title === activity.Company?.Title);
  const contact = company?.contacts.find(
    (row) => row.Title === activity.Contact?.Title || row.ContactID === activity.Contact?.Title,
  );
  if (contact?.Email?.trim()) return contact.Email.trim();
  const slug = (activity.Company?.Title ?? "customer")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
  return `contact@${slug || "customer"}.com`;
}

function resolveContactPhone(activity: Activity, companies: Company[]): string | null {
  const company = companies.find((row) => row.Title === activity.Company?.Title);
  const contact = company?.contacts.find((row) => row.Title === activity.Contact?.Title);
  return contact?.Phone?.trim() || contact?.Mobile?.trim() || null;
}

function resolveDealName(activity: Activity, pipelines: PipelineRow[]): string | null {
  const dealId = activity.Deal?.Title;
  if (!dealId) return null;
  return pipelines.find((pipeline) => pipeline.id === dealId)?.assetName ?? dealId;
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function suggestedQuestions(briefing: ActivityBriefing, activity: Activity): string[] {
  const questions: string[] = [];
  if (activity.NextAction?.trim()) {
    questions.push(`Can we confirm progress on: ${activity.NextAction.trim()}?`);
  }
  if (briefing.support.agreements[0]) {
    questions.push(`What is the status of: ${briefing.support.agreements[0]}?`);
  }
  if (briefing.blockerCategory === "missing_decision_maker") {
    questions.push("Who holds final decision authority for this initiative?");
  }
  if (briefing.blockerCategory === "missing_information") {
    questions.push("What information do you need from us to move forward?");
  }
  questions.push("What should we prioritize before our next touchpoint?");
  return [...new Set(questions)].slice(0, 4);
}

function determinePrimaryActionType(ctx: RecommendationContext): ActivityRecommendedActionType {
  const { activity, briefing } = ctx;
  const next = briefing.nextStep.toLowerCase();

  if (activity.ActionStatus === "Completed" || activity.ActionStatus === "Cancelled") {
    return "close_activity";
  }

  if (briefing.blockerCategory === "waiting_standard_bio") {
    return "create_follow_up";
  }

  if (briefing.blockerCategory === "missing_decision_maker") {
    return "schedule_teams_meeting";
  }

  if (
    briefing.blockerCategory === "missing_information" ||
    next.includes("request") ||
    next.includes("sample") ||
    next.includes("information") ||
    next.includes("certification") ||
    next.includes("document")
  ) {
    return "request_information";
  }

  if (
    activity.Priority === "Urgent" &&
    (briefing.businessState === "overdue" || briefing.blockerCategory === "overdue_commitment")
  ) {
    return "escalate";
  }

  if (briefing.blockerCategory === "waiting_third_party") {
    return "create_follow_up";
  }

  if (
    next.includes("meeting") ||
    next.includes("align") ||
    next.includes("workshop") ||
    /meeting|site visit/i.test(activity.ActivityType)
  ) {
    return "schedule_teams_meeting";
  }

  if (
    next.includes("call") ||
    activity.ActivityType === "Phone Call" ||
    briefing.blockerCategory === "waiting_customer"
  ) {
    return "schedule_call";
  }

  if (activity.ActionRequired && !next.includes("email")) {
    return "create_follow_up";
  }

  return "send_email";
}

function alternativeActionTypes(
  primary: ActivityRecommendedActionType,
  ctx: RecommendationContext,
): ActivityRecommendedActionType[] {
  const pool: ActivityRecommendedActionType[] = [
    "send_email",
    "schedule_call",
    "schedule_teams_meeting",
    "create_follow_up",
    "request_information",
    "escalate",
  ];

  if (ctx.activity.ActionStatus === "Completed") {
    return [];
  }

  return pool.filter((type) => type !== primary).slice(0, 3);
}

function confidenceFor(
  actionType: ActivityRecommendedActionType,
  ctx: RecommendationContext,
): { confidence: ConfidenceLevel; reason: string } {
  const { activity, briefing } = ctx;
  const hasContact = Boolean(activity.Contact?.Title);
  const hasEmail = resolveContactEmail(activity, ctx.companies).includes("@");
  const hasExplicitNext = Boolean(activity.NextAction?.trim());

  if (actionType === "close_activity") {
    return { confidence: "high", reason: "Activity status is terminal." };
  }

  if (!hasContact && (actionType === "send_email" || actionType === "schedule_call")) {
    return {
      confidence: "low",
      reason: "No contact is linked — validate recipient before sending.",
    };
  }

  if (hasExplicitNext && hasContact && briefing.requiresAttention) {
    return {
      confidence: "high",
      reason: "Clear next step and contact context support this action.",
    };
  }

  if (hasEmail && hasExplicitNext) {
    return { confidence: "medium", reason: "Inferred from activity context — confirm before executing." };
  }

  return { confidence: "medium", reason: "Recommended from blocker pattern — validate with customer." };
}

function buildRecommendation(
  actionType: ActivityRecommendedActionType,
  ctx: RecommendationContext,
): ActivityActionRecommendation {
  const { briefing, activity } = ctx;
  const dealName = resolveDealName(activity, ctx.pipelines);
  const company = activity.Company?.Title ?? "the customer";
  const { confidence, reason: confidenceReason } = confidenceFor(actionType, ctx);

  const reasonByType: Record<ActivityRecommendedActionType, string> = {
    send_email: `Follow-up is required on ${dealName ?? company} and email is the fastest path to unblock progress.`,
    schedule_call: `${briefing.blockerCategoryLabel} — a direct conversation will clarify status faster than async messages.`,
    schedule_teams_meeting: `Multiple stakeholders or decisions are involved on ${dealName ?? company}.`,
    create_follow_up: `Ownership and timing need to be captured so ${briefing.blockerCategoryLabel.toLowerCase()} does not persist.`,
    request_information: `Progress depends on information that is not yet confirmed: ${briefing.blockingProgress}`,
    escalate: `Attention is ${briefing.businessStateLabel.toLowerCase()} — internal alignment is needed to protect the relationship.`,
    close_activity: "No further customer action is required on this activity.",
  };

  const outcomeByType: Record<ActivityRecommendedActionType, string> = {
    send_email: "Customer confirms next step and timeline, restoring commercial momentum.",
    schedule_call: "Open questions resolved and a dated commitment agreed.",
    schedule_teams_meeting: "Stakeholders aligned with owners, dates, and success criteria documented.",
    create_follow_up: "A tracked follow-up exists with due date and success criteria.",
    request_information: "Missing information received and logged against the opportunity.",
    escalate: "Internal owner engaged with a clear recovery plan within 24 hours.",
    close_activity: "Activity closed with outcomes captured in the record.",
  };

  return {
    actionType,
    actionLabel: ACTIVITY_ACTION_LABELS[actionType],
    reason: reasonByType[actionType],
    expectedOutcome: outcomeByType[actionType],
    confidence,
    confidenceReason,
  };
}

function prepareEmail(ctx: RecommendationContext, objective: string): PreparedEmailAction {
  const { activity, briefing } = ctx;
  const dealName = resolveDealName(activity, ctx.pipelines);
  const company = activity.Company?.Title ?? "your team";
  const subject = dealName
    ? `Following up — ${dealName}`
    : `Following up: ${activity.Subject}`;

  const body = [
    `Hi ${contactFirstName(activity)},`,
    "",
    `Following our recent ${activity.ActivityType.toLowerCase()} regarding ${activity.Subject.toLowerCase()}.`,
    "",
    objective,
    "",
    briefing.nextStep ? `Suggested next step: ${briefing.nextStep}` : "",
    "",
    "Please let me know if a short call would be easier.",
    "",
    "Best regards,",
    activity.ActivityOwner?.Title ?? "Standard Bio",
  ]
    .filter((line, index, arr) => !(line === "" && arr[index - 1] === ""))
    .join("\n");

  return {
    to: resolveContactEmail(activity, ctx.companies),
    subject,
    body,
    objective,
  };
}

function prepareCall(ctx: RecommendationContext): PreparedCallAction {
  const { briefing, activity } = ctx;
  return {
    objective: briefing.nextStep || `Unblock ${activity.Subject}`,
    suggestedQuestions: suggestedQuestions(briefing, activity),
    desiredOutcome: briefing.blockingProgress.includes("No active blocker")
      ? "Confirm next commitment and due date."
      : `Resolve blocker: ${briefing.blockingProgress}`,
    contactPhone: resolveContactPhone(activity, ctx.companies),
  };
}

function prepareTeamsMeeting(ctx: RecommendationContext): PreparedTeamsMeetingAction {
  return buildActivityTeamsMeeting({
    activity: ctx.activity,
    briefing: ctx.briefing,
    dealName: resolveDealName(ctx.activity, ctx.pipelines),
  });
}

function prepareFollowUp(ctx: RecommendationContext): PreparedFollowUpAction {
  const { activity, briefing } = ctx;
  const dueIso =
    activity.NextActionDate && activity.ActionRequired
      ? activity.NextActionDate.slice(0, 10)
      : formatIsoDate(addDays(new Date(), briefing.businessState === "overdue" ? 1 : 3));

  return {
    title: briefing.nextStep || `Follow up: ${activity.Subject}`,
    dueDate: dueIso,
    dueDateLabel: formatDueDate(dueIso),
    purpose: briefing.blockerCategoryLabel,
    successCriteria: briefing.nextStep
      ? `Customer confirms: ${briefing.nextStep}`
      : "Blocker removed and next commercial step scheduled.",
  };
}

function prepareEscalation(ctx: RecommendationContext): PreparedEscalationAction {
  const { activity, briefing } = ctx;
  const owner = activity.ActivityOwner?.Title ?? "deal team";
  const objective = `Escalate overdue engagement on ${activity.Subject}`;

  return {
    to: `${owner.replace(/\s+/g, ".").toLowerCase()}@standardbio.com`,
    subject: `Escalation: ${activity.Subject} (${activity.ActivityID})`,
    objective,
    body: [
      `Hi ${owner.split(" ")[0] ?? "team"},`,
      "",
      `Escalation for ${activity.ActivityID} — ${activity.Subject}.`,
      "",
      `Situation: ${briefing.situationParagraph}`,
      "",
      `Blocking progress: ${briefing.blockingProgress}`,
      "",
      `Recommended recovery: ${briefing.nextStep}`,
      "",
      "Please confirm owner and recovery plan within 24 hours.",
    ].join("\n"),
  };
}

function attachArtifact(
  recommendations: ActivityActionRecommendations,
  actionType: ActivityRecommendedActionType,
  ctx: RecommendationContext,
): ActivityActionRecommendations {
  switch (actionType) {
    case "send_email":
      return {
        ...recommendations,
        email: prepareEmail(ctx, `I would like to align on next steps for ${ctx.activity.Subject}.`),
      };
    case "request_information":
      return {
        ...recommendations,
        email: prepareEmail(
          ctx,
          `Could you please provide the information needed to move forward: ${ctx.briefing.blockingProgress}`,
        ),
      };
    case "schedule_call":
      return { ...recommendations, call: prepareCall(ctx) };
    case "schedule_teams_meeting":
      return { ...recommendations, teamsMeeting: prepareTeamsMeeting(ctx) };
    case "create_follow_up":
      return { ...recommendations, followUp: prepareFollowUp(ctx) };
    case "escalate":
      return { ...recommendations, escalation: prepareEscalation(ctx) };
    default:
      return recommendations;
  }
}

export function buildActivityActionRecommendations(
  activity: Activity,
  briefing: ActivityBriefing,
  companies: Company[],
  pipelines: PipelineRow[],
): ActivityActionRecommendations {
  const ctx: RecommendationContext = { activity, briefing, companies, pipelines };
  const primaryType = determinePrimaryActionType(ctx);
  const primary = buildRecommendation(primaryType, ctx);
  const alternatives = alternativeActionTypes(primaryType, ctx).map((type) =>
    buildRecommendation(type, ctx),
  );

  const base: ActivityActionRecommendations = {
    blockingProgress: briefing.blockingProgress,
    blockerCategoryLabel: briefing.blockerCategoryLabel,
    primary,
    alternatives,
  };

  return attachArtifact(base, primaryType, ctx);
}

export function buildActivityActionRecommendationsForType(
  activity: Activity,
  briefing: ActivityBriefing,
  companies: Company[],
  pipelines: PipelineRow[],
  actionType: ActivityRecommendedActionType,
): ActivityActionRecommendations {
  const ctx: RecommendationContext = { activity, briefing, companies, pipelines };
  const primary = buildRecommendation(actionType, ctx);
  const alternatives = alternativeActionTypes(actionType, ctx).map((type) =>
    buildRecommendation(type, ctx),
  );
  const base: ActivityActionRecommendations = {
    blockingProgress: briefing.blockingProgress,
    blockerCategoryLabel: briefing.blockerCategoryLabel,
    primary,
    alternatives,
  };
  return attachArtifact(base, actionType, ctx);
}
