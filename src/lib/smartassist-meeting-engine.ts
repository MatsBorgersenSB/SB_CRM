import type { Activity } from "@/types/activity";
import type { ActivityBriefing } from "@/lib/activity-briefing";
import type { ActivityFocusItem } from "@/lib/activity-mission-control";
import type { OpportunityUnderstanding } from "@/lib/opportunity-workspace-intelligence";
import type { PipelineRow } from "@/types/pipeline";
import {
  MEETING_PURPOSE_LABELS,
  type MeetingPurpose,
  type SmartAssistMeeting,
} from "@/types/smartassist-meeting";

function finalizeAgenda(
  topics: [string, string, string],
): SmartAssistMeeting["agenda"] {
  return [topics[0], topics[1], topics[2], "Decisions Required", "Next Steps"];
}

function uniqueNonEmpty(values: string[], limit = 4): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, limit);
}

function classifyPurposeFromSignals(signals: string): MeetingPurpose {
  const corpus = signals.toLowerCase();

  if (/executive|decision.?maker|sponsor|board|ceo|cfo|director|vp\b|approval authority/i.test(corpus)) {
    return "executive_review";
  }
  if (/technical|engineering|specification|compliance|integration|feasibility/i.test(corpus)) {
    return "technical_review";
  }
  if (/validat|verify|confirm assumption|proof|evidence|sample|certification/i.test(corpus)) {
    return "validation";
  }
  if (/discover|explore|understand|scope|requirements|qualify/i.test(corpus)) {
    return "discovery";
  }
  if (/pipeline|opportunity|commercial|deal|close|milestone|stage/i.test(corpus)) {
    return "opportunity_review";
  }
  if (/follow.?up|status|check.?in|progress|alignment|sync/i.test(corpus)) {
    return "follow_up";
  }

  return "follow_up";
}

function agendaTopicsForPurpose(
  purpose: MeetingPurpose,
  ctx: {
    dealName?: string | null;
    companyName?: string | null;
    blocker?: string;
    nextStep?: string;
    gap?: string;
    objective?: string;
    stageLabel?: string;
  },
): [string, string, string] {
  const account = ctx.companyName ?? "the customer";
  const deal = ctx.dealName ?? "this initiative";

  switch (purpose) {
    case "discovery":
      return [
        `Business context and priorities at ${account}`,
        ctx.gap
          ? `Open questions: ${ctx.gap}`
          : "Key unknowns blocking commercial confidence",
        ctx.objective
          ? `Align on objective: ${ctx.objective}`
          : "Success criteria for the current engagement phase",
      ];
    case "validation":
      return [
        ctx.gap ? `Validate: ${ctx.gap}` : "Assumptions requiring customer confirmation",
        "Evidence, constraints, and boundary conditions",
        ctx.nextStep ? `Progress check: ${ctx.nextStep}` : "Requirements fit against proposed scope",
      ];
    case "executive_review":
      return [
        `Strategic fit and commercial position on ${deal}`,
        "Investment, resources, and timeline alignment",
        ctx.blocker
          ? `Resolve blocker: ${ctx.blocker}`
          : "Decision authority and internal approval path",
      ];
    case "opportunity_review":
      return [
        ctx.stageLabel
          ? `Pipeline status at ${ctx.stageLabel.toLowerCase()}`
          : `Current status on ${deal}`,
        ctx.blocker ? `Commercial blockers: ${ctx.blocker}` : "Risks and momentum factors",
        "Path to the next milestone and close criteria",
      ];
    case "technical_review":
      return [
        "Technical scope, specifications, and quality requirements",
        ctx.gap ? `Open technical point: ${ctx.gap}` : "Compliance and integration considerations",
        "Feasibility assessment and implementation constraints",
      ];
    case "follow_up":
    default:
      return [
        ctx.blocker ? `Current status: ${ctx.blocker}` : "Progress since last interaction",
        ctx.nextStep ? `Outstanding: ${ctx.nextStep}` : "Open commitments and deliverables",
        "Priorities and timing for the period ahead",
      ];
  }
}

function decisionsForPurpose(
  purpose: MeetingPurpose,
  ctx: {
    blocker?: string;
    nextStep?: string;
    gap?: string;
    decisions?: string[];
  },
): string[] {
  const fromContext = ctx.decisions?.slice(0, 2) ?? [];

  const byPurpose: Record<MeetingPurpose, string[]> = {
    discovery: [
      ctx.gap ? `Scope of discovery on ${ctx.gap.toLowerCase()}` : "Priority discovery topics for next phase",
      "Owner for information exchange and follow-up timing",
    ],
    validation: [
      ctx.gap ? `Accept or reject assumptions on ${ctx.gap.toLowerCase()}` : "Confirm validated requirements",
      "Go/no-go on proceeding with current scope",
    ],
    follow_up: [
      ctx.nextStep ? `Commitment on: ${ctx.nextStep}` : "Owners and due dates for open items",
      "Whether a further touchpoint is required before next milestone",
    ],
    executive_review: [
      "Executive sponsorship and decision authority",
      ctx.blocker ? `Resolution path for: ${ctx.blocker}` : "Priority relative to other initiatives",
    ],
    opportunity_review: [
      "Next commercial milestone and target date",
      ctx.blocker ? `Owner to remove: ${ctx.blocker}` : "Resource allocation to advance the deal",
    ],
    technical_review: [
      ctx.gap ? `Technical sign-off on: ${ctx.gap.toLowerCase()}` : "Technical feasibility confirmation",
      "Sample, documentation, or site visit requirements",
    ],
  };

  return uniqueNonEmpty([...fromContext, ...byPurpose[purpose]], 3);
}

function outcomesForPurpose(
  purpose: MeetingPurpose,
  ctx: { nextStep?: string; gap?: string; dealName?: string | null },
): string[] {
  const deal = ctx.dealName ?? "the opportunity";

  const byPurpose: Record<MeetingPurpose, string[]> = {
    discovery: [
      "Customer priorities and constraints documented",
      ctx.gap ? `${ctx.gap} scoped with clear next actions` : "Discovery plan agreed with owners and dates",
      "Shared understanding of success criteria",
    ],
    validation: [
      "Key assumptions validated or flagged for rework",
      ctx.gap ? `${ctx.gap} confirmed or escalated` : "Requirements baseline agreed",
      "Confidence to advance commercial discussions",
    ],
    follow_up: [
      ctx.nextStep ? `Customer confirms: ${ctx.nextStep}` : "Open items closed or re-owned with dates",
      "No outstanding commitments without an owner",
      "Next touchpoint scheduled if required",
    ],
    executive_review: [
      "Executive alignment on strategic fit and priority",
      "Decision path and approvers identified",
      `Clear mandate to advance ${deal}`,
    ],
    opportunity_review: [
      "Pipeline position and blockers understood by all attendees",
      "Next milestone defined with owner and date",
      "Commercial momentum restored or escalation triggered",
    ],
    technical_review: [
      "Technical scope and constraints documented",
      ctx.gap ? `${ctx.gap} resolved or assigned` : "Feasibility confirmed for proposed approach",
      "Technical next steps scheduled with owners",
    ],
  };

  return uniqueNonEmpty(byPurpose[purpose], 3);
}

function objectiveForPurpose(
  purpose: MeetingPurpose,
  ctx: {
    dealName?: string | null;
    companyName?: string | null;
    blocker?: string;
    whyItMatters?: string;
    gap?: string;
    stageLabel?: string;
  },
): string {
  const account = ctx.companyName ?? "the customer";
  const deal = ctx.dealName ?? ctx.companyName ?? "this engagement";

  if (ctx.whyItMatters?.trim() && purpose === "follow_up") {
    return ctx.whyItMatters.trim().replace(/\.$/, "") + ".";
  }

  const objectives: Record<MeetingPurpose, string> = {
    discovery: `Understand ${account}'s priorities and close knowledge gaps needed to advance ${deal}.`,
    validation: `Validate assumptions and confirm requirements so ${deal} can progress with confidence.`,
    follow_up: ctx.blocker
      ? `Align on progress and remove the blocker: ${ctx.blocker}.`
      : `Confirm status, commitments, and next steps on ${deal}.`,
    executive_review: `Secure executive alignment and decision authority to unblock ${deal}.`,
    opportunity_review: ctx.stageLabel
      ? `Review commercial position at ${ctx.stageLabel.toLowerCase()} and agree the path to the next milestone on ${deal}.`
      : `Assess pipeline momentum and agree concrete next steps on ${deal}.`,
    technical_review: ctx.gap
      ? `Resolve the technical question: ${ctx.gap}, and confirm feasibility for ${deal}.`
      : `Align on technical scope, constraints, and feasibility for ${deal}.`,
  };

  return objectives[purpose];
}

function suggestDuration(purpose: MeetingPurpose, complexity: number): string {
  if (purpose === "executive_review" || purpose === "technical_review") {
    return complexity >= 3 ? "60 minutes" : "45 minutes";
  }
  if (purpose === "discovery" || purpose === "opportunity_review") {
    return complexity >= 3 ? "60 minutes" : "45 minutes";
  }
  return complexity >= 2 ? "45 minutes" : "30 minutes";
}

function buildMeeting(
  purpose: MeetingPurpose,
  input: {
    title: string;
    companyName?: string | null;
    dealName?: string | null;
    blocker?: string;
    nextStep?: string;
    gap?: string;
    objective?: string;
    whyItMatters?: string;
    stageLabel?: string;
    decisions?: string[];
    attendees: string[];
    complexity?: number;
  },
): SmartAssistMeeting {
  const topics = agendaTopicsForPurpose(purpose, input);

  return {
    title: input.title,
    purpose,
    purposeLabel: MEETING_PURPOSE_LABELS[purpose],
    objective: objectiveForPurpose(purpose, input),
    agenda: finalizeAgenda(topics),
    decisionsRequired: decisionsForPurpose(purpose, input),
    desiredOutcomes: outcomesForPurpose(purpose, input),
    suggestedDuration: suggestDuration(purpose, input.complexity ?? 1),
    suggestedAttendees: input.attendees.length > 0 ? input.attendees : ["Customer contact", "Account owner"],
  };
}

// ─── Activity action recommendations (activity detail) ─────────────────────────

export type ActivityMeetingInput = {
  activity: Activity;
  briefing: ActivityBriefing;
  dealName: string | null;
};

export function buildActivityTeamsMeeting(input: ActivityMeetingInput): SmartAssistMeeting {
  const { activity, briefing, dealName } = input;
  const companyName = activity.Company?.Title ?? null;
  const signals = [
    activity.Subject,
    activity.ActivityType,
    briefing.nextStep,
    briefing.blockerCategory,
    briefing.blockingProgress,
    dealName,
  ].join(" ");

  const purpose = classifyPurposeFromSignals(signals);
  const resolvedPurpose =
    briefing.blockerCategory === "missing_information" && purpose === "follow_up"
      ? "validation"
      : purpose;

  if (briefing.blockerCategory === "missing_decision_maker") {
    return buildMeeting("executive_review", {
      title: dealName ? `${dealName} — executive alignment` : `${activity.Subject} — executive review`,
      companyName,
      dealName,
      blocker: briefing.blockingProgress,
      nextStep: briefing.nextStep,
      whyItMatters: briefing.whyItMatters,
      decisions: briefing.support.decisions,
      attendees: uniqueNonEmpty([
        activity.Contact?.Title ?? "",
        activity.ActivityOwner?.Title ?? "",
        ...briefing.support.stakeholders.slice(0, 2).map((person) => person.name),
      ]),
      complexity: briefing.support.decisions.length + briefing.support.agreements.length,
    });
  }

  const title =
    resolvedPurpose === "technical_review"
      ? `${dealName ?? activity.Subject} — technical review`
      : resolvedPurpose === "discovery"
        ? `${dealName ?? companyName ?? activity.Subject} — discovery`
        : dealName
          ? `${dealName} — ${MEETING_PURPOSE_LABELS[resolvedPurpose].toLowerCase()}`
          : `${activity.Subject} — ${MEETING_PURPOSE_LABELS[resolvedPurpose].toLowerCase()}`;

  return buildMeeting(resolvedPurpose, {
    title,
    companyName,
    dealName,
    blocker: briefing.blockingProgress,
    nextStep: briefing.nextStep,
    gap: briefing.blockerCategory === "missing_information" ? briefing.blockingProgress : undefined,
    whyItMatters: briefing.whyItMatters,
    decisions: briefing.support.decisions,
    attendees: uniqueNonEmpty([
      activity.Contact?.Title ?? "",
      activity.ActivityOwner?.Title ?? "",
      ...briefing.support.stakeholders.slice(0, 2).map((person) => person.name),
    ]),
    complexity: briefing.support.decisions.length + briefing.support.agreements.length,
  });
}

// ─── Activity workspace (mission control) ────────────────────────────────────

export type CustomerMeetingInput = {
  focus: ActivityFocusItem | null;
  activity: Activity | undefined;
  companyName: string;
  ownerName: string;
  focusItems: ActivityFocusItem[];
};

export function buildCustomerMeeting(input: CustomerMeetingInput): SmartAssistMeeting {
  const { focus, activity, companyName, ownerName, focusItems } = input;
  const signals = [
    activity?.Subject,
    activity?.ActivityType,
    focus?.headline,
    focus?.recommendedAction,
    focus?.whyItMatters,
  ].join(" ");

  const purpose = classifyPurposeFromSignals(signals);
  const dealName = activity?.Deal?.Title ?? null;

  return buildMeeting(purpose, {
    title: activity?.Subject
      ? `${activity.Subject} — ${MEETING_PURPOSE_LABELS[purpose].toLowerCase()}`
      : `${companyName} — ${MEETING_PURPOSE_LABELS[purpose].toLowerCase()}`,
    companyName,
    dealName,
    blocker: focus?.headline,
    nextStep: focus?.recommendedAction,
    whyItMatters: focus?.whyItMatters,
    attendees: uniqueNonEmpty([
      activity?.Contact?.Title ?? "",
      activity?.ActivityOwner?.Title ?? ownerName,
    ]),
    complexity: focusItems.length,
  });
}

// ─── Opportunity workspace ───────────────────────────────────────────────────

export type OpportunityMeetingInput = {
  pipeline: PipelineRow;
  companyName: string;
  stageLabel: string;
  ownerName: string;
  understanding: OpportunityUnderstanding;
  attendees: string[];
};

export function buildOpportunityMeeting(input: OpportunityMeetingInput): SmartAssistMeeting {
  const { pipeline, companyName, stageLabel, understanding, attendees, ownerName } = input;
  const gaps = understanding.knowledgeModel.criticalGaps;
  const topGap = gaps[0];
  const signals = [
    pipeline.assetName,
    stageLabel,
    pipeline.status,
    topGap?.missingInformation,
    understanding.nextBestAction.action,
    ...understanding.suggestedQuestions.slice(0, 2),
  ].join(" ");

  let purpose = classifyPurposeFromSignals(signals);
  if (gaps.length >= 2 && purpose === "follow_up") {
    purpose = "discovery";
  }
  if (/proposal|negotiat|contract|close/i.test(stageLabel) && purpose !== "technical_review") {
    purpose = "opportunity_review";
  }

  const title = topGap
    ? `${pipeline.assetName} — ${topGap.missingInformation}`
    : `${pipeline.assetName} — ${MEETING_PURPOSE_LABELS[purpose].toLowerCase()}`;

  return buildMeeting(purpose, {
    title,
    companyName,
    dealName: pipeline.assetName,
    gap: topGap?.missingInformation,
    blocker: topGap?.whyItMatters,
    nextStep: understanding.nextBestAction.action,
    objective: understanding.clientObjective.statement || undefined,
    stageLabel,
    attendees:
      attendees.length > 0
        ? attendees
        : [`${companyName} project lead`, ownerName],
    complexity: gaps.length + understanding.suggestedQuestions.length,
  });
}

// ─── Compose / clipboard formatting ──────────────────────────────────────────

export function formatSmartAssistMeetingForCompose(meeting: SmartAssistMeeting): string {
  return [
    "Meeting Objective",
    "",
    meeting.objective,
    "",
    "Agenda",
    "",
    ...meeting.agenda.map((item, index) => `${index + 1}. ${item}`),
    "",
    "Decisions Required",
    "",
    ...meeting.decisionsRequired.map((item) => `• ${item}`),
    "",
    "Desired Outcome",
    "",
    ...meeting.desiredOutcomes.map((item) => `✓ ${item}`),
  ].join("\n");
}
