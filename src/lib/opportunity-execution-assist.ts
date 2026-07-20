import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import { findCompanyForDeal } from "@/lib/opportunity-intelligence-engine";
import { opportunityStageLabel } from "@/lib/opportunity-overview";
import { resolveOpportunityOwner } from "@/lib/opportunity-owner";
import type { OpportunityUnderstanding } from "@/lib/opportunity-workspace-intelligence";
import {
  buildOpportunityTimeline,
  topRecommendedMilestone,
  type RecommendedTimelineMilestone,
} from "@/lib/opportunity-timeline";
import { buildOpportunityMeeting as buildStructuredOpportunityMeeting } from "@/lib/smartassist-meeting-engine";
import type { SmartAssistMeeting } from "@/types/smartassist-meeting";
import type { Activity } from "@/types/activity";
import type { PipelineRow } from "@/types/pipeline";

export type OpportunityExecutionContext = {
  pipeline: PipelineRow;
  company?: Company;
  stageLabel: string;
  ownerName: string;
  understanding: OpportunityUnderstanding;
  primaryContact: {
    name: string;
    title?: string;
    email?: string;
  } | null;
  attendees: Array<{ name: string; role?: string }>;
};

export type PreparedEmail = {
  to: string;
  subject: string;
  body: string;
};

export type PreparedMeeting = SmartAssistMeeting;

export type PreparedOpportunityPlan = {
  headline: string;
  objective: string;
  currentPhase: string;
  phases: Array<{ phase: string; focus: string; timing: string }>;
  priorityActions: string[];
  risksToWatch: string[];
};

export type PreparedMilestoneSchedule = {
  milestone: string;
  suggestedDate: string;
  owner: string;
  duration: string;
  prepActions: string[];
  successCriteria: string;
};

export function buildOpportunityExecutionContext(
  pipeline: PipelineRow,
  companies: Company[],
  commercialPackages: CommercialPackage[],
  understanding: OpportunityUnderstanding,
): OpportunityExecutionContext {
  const company = findCompanyForDeal(pipeline.id, companies);
  const owner = resolveOpportunityOwner(pipeline, company);

  const contacts =
    company?.contacts
      .filter((contact) => contact.Title?.trim())
      .map((contact) => ({
        name: contact.Title,
        role: contact.JobTitle?.trim() || contact.Role?.trim() || undefined,
        email: contact.Email?.trim() || undefined,
        score: scoreContact(contact.JobTitle, contact.Role),
      }))
      .sort((a, b) => b.score - a.score) ?? [];

  const primaryContact = contacts[0]
    ? {
        name: contacts[0].name,
        title: contacts[0].role,
        email: contacts[0].email,
      }
    : null;

  const attendees = contacts.slice(0, 4).map((contact) => ({
    name: contact.name,
    role: contact.role,
  }));

  if (owner?.Title && !attendees.some((person) => person.name === owner.Title)) {
    attendees.push({ name: owner.Title, role: "Account owner" });
  }

  return {
    pipeline,
    company,
    stageLabel: opportunityStageLabel(pipeline, commercialPackages),
    ownerName: owner?.Title ?? "your SmartCRM team",
    understanding,
    primaryContact,
    attendees,
  };
}

function scoreContact(jobTitle?: string, role?: string): number {
  const corpus = `${jobTitle ?? ""} ${role ?? ""}`.toLowerCase();
  if (/plant|operations|technical|engineering|project/i.test(corpus)) return 3;
  if (/procurement|commercial|buyer|purchasing/i.test(corpus)) return 2;
  if (/ceo|cfo|director|vp|head|manager/i.test(corpus)) return 4;
  return 1;
}

function pickDiscoveryQuestions(ctx: OpportunityExecutionContext): string[] {
  const fromGaps = ctx.understanding.knowledgeModel.criticalGaps
    .slice(0, 2)
    .map((gap) => gap.recommendedAction.replace(/\.$/, ""));
  const fromQuestions = ctx.understanding.suggestedQuestions.slice(0, 3);
  const merged = [...fromGaps, ...fromQuestions];
  const unique = Array.from(new Set(merged));
  return unique.slice(0, 4);
}

function greetingName(ctx: OpportunityExecutionContext): string {
  const first = ctx.primaryContact?.name.split(" ")[0];
  return first ?? "there";
}

export function prepareOpportunityEmail(ctx: OpportunityExecutionContext): PreparedEmail {
  const { pipeline, company, stageLabel, understanding } = ctx;
  const questions = pickDiscoveryQuestions(ctx);
  const topGap = understanding.knowledgeModel.criticalGaps[0];
  const accountName = company?.Title ?? "your team";
  const projectName = pipeline.assetName;

  const subject = topGap
    ? `${projectName} — aligning on ${topGap.missingInformation.toLowerCase()}`
    : `${projectName} — next steps on ${stageLabel.toLowerCase()}`;

  const questionBlock =
    questions.length > 0
      ? questions.map((question) => `• ${question}`).join("\n")
      : "• Confirm priorities for the current project phase";

  const body = [
    `Hi ${greetingName(ctx)},`,
    "",
    `Following our work on ${projectName} at ${accountName}, I wanted to align on a few points as we progress through ${stageLabel.toLowerCase()}.`,
    "",
    understanding.clientObjective.statement
      ? `We understand your focus is to ${understanding.clientObjective.statement.charAt(0).toLowerCase()}${understanding.clientObjective.statement.slice(1).replace(/\.$/, "")}.`
      : null,
    "",
    topGap
      ? `To keep momentum, it would help to clarify ${topGap.missingInformation.toLowerCase()}. Specifically:`
      : "To keep momentum on this opportunity, could you help us with the following:",
    "",
    questionBlock,
    "",
    `Happy to find a short call if easier — otherwise a reply here works well.`,
    "",
    "Best regards,",
    ctx.ownerName,
  ]
    .filter((line) => line !== null)
    .join("\n");

  return {
    to: ctx.primaryContact?.email ?? `${greetingName(ctx).toLowerCase()}@${slugify(accountName)}.com`,
    subject,
    body,
  };
}

export function prepareOpportunityMeeting(ctx: OpportunityExecutionContext): PreparedMeeting {
  const accountName = ctx.company?.Title ?? "Customer";
  const suggestedAttendees = ctx.attendees.map((person) =>
    person.role ? `${person.name} (${person.role})` : person.name,
  );

  return buildStructuredOpportunityMeeting({
    pipeline: ctx.pipeline,
    companyName: accountName,
    stageLabel: ctx.stageLabel,
    ownerName: ctx.ownerName,
    understanding: ctx.understanding,
    attendees: suggestedAttendees,
  });
}

export function prepareOpportunityPlan(
  ctx: OpportunityExecutionContext,
  activities: Activity[],
  commercialPackages: CommercialPackage[],
): PreparedOpportunityPlan {
  const { pipeline, understanding, stageLabel } = ctx;
  const timeline = buildOpportunityTimeline(
    pipeline,
    activities,
    commercialPackages,
    understanding,
  );
  const gaps = understanding.knowledgeModel.criticalGaps;
  const topGap = gaps[0];

  const phases = [
    {
      phase: "Resolve blockers",
      focus: topGap
        ? topGap.recommendedAction
        : understanding.nextBestAction.action,
      timing: "Now — 2 weeks",
    },
    {
      phase: "Advance commercial confidence",
      focus:
        understanding.assessment.pathsForward[0] ??
        "Validate scope, pricing assumptions, and decision process",
      timing: "2 — 4 weeks",
    },
    {
      phase: "Drive to close",
      focus: pipeline.expectedCloseDate
        ? `Align on delivery and close by ${formatPlanDate(pipeline.expectedCloseDate)}`
        : "Confirm close criteria and internal approvals",
      timing: pipeline.expectedCloseDate ? `By ${formatPlanDate(pipeline.expectedCloseDate)}` : "4 — 8 weeks",
    },
  ];

  const priorityActions = [
    understanding.nextBestAction.action,
    ...timeline.recommended.slice(0, 3).map((item) => item.title),
  ].slice(0, 4);

  const risksToWatch = [
    ...gaps.slice(0, 2).map((gap) => gap.missingInformation),
    ...activities
      .flatMap((activity) => activity.Risks ?? [])
      .slice(0, 2),
  ].filter(Boolean);

  return {
    headline: `${pipeline.assetName} — win plan at ${stageLabel.toLowerCase()}`,
    objective: understanding.clientObjective.statement || "Advance the opportunity with clarity and momentum.",
    currentPhase: pipeline.status || stageLabel,
    phases,
    priorityActions,
    risksToWatch: Array.from(new Set(risksToWatch)).slice(0, 4),
  };
}

export function scheduleNextMilestone(
  ctx: OpportunityExecutionContext,
  activities: Activity[],
  commercialPackages: CommercialPackage[],
  milestone?: RecommendedTimelineMilestone | null,
): PreparedMilestoneSchedule {
  const timeline = buildOpportunityTimeline(
    ctx.pipeline,
    activities,
    commercialPackages,
    ctx.understanding,
  );
  const target = milestone ?? topRecommendedMilestone(timeline);
  const suggestedDate = target?.suggestedTiming ?? "This week";

  return {
    milestone: target?.title ?? ctx.understanding.nextBestAction.action,
    suggestedDate,
    owner: ctx.ownerName,
    duration: target?.title.toLowerCase().includes("meeting") ? "60 minutes" : "30 minutes",
    prepActions: [
      ctx.understanding.knowledgeModel.criticalGaps[0]
        ? `Review gap: ${ctx.understanding.knowledgeModel.criticalGaps[0].missingInformation}`
        : "Review latest customer interactions",
      "Confirm attendees and send agenda 24 hours ahead",
      "Prepare discovery questions from outstanding knowledge gaps",
    ],
    successCriteria:
      target?.expectedImpact ??
      ctx.understanding.nextBestAction.expectedImpact,
  };
}

function formatPlanDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "customer";
}
