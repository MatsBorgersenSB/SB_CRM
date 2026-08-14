import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { ActivityMissionControl, ActivityFocusItem } from "@/lib/activity-mission-control";
import { buildCustomerMeeting } from "@/lib/smartassist-meeting-engine";
import type { SmartAssistMeeting } from "@/types/smartassist-meeting";
import { formatDueDate } from "@/lib/activity-utils";
import { sectorDraftParagraph } from "@/lib/company-sectors";

export type ActivityExecutionContext = {
  mission: ActivityMissionControl;
  activities: Activity[];
  companies: Company[];
  pipelines: PipelineRow[];
  ownerName: string;
};

export type PreparedFollowUpEmail = {
  to: string;
  subject: string;
  body: string;
};

export type PreparedCustomerMeeting = SmartAssistMeeting;

export type PreparedRiskSummary = {
  headline: string;
  risks: Array<{ risk: string; context: string; suggestedAction: string }>;
};

export type PreparedWeeklyPlan = {
  headline: string;
  priorities: string[];
  meetings: string[];
  followUps: string[];
  risksToWatch: string[];
};

export function buildActivityExecutionContext(
  mission: ActivityMissionControl,
  activities: Activity[],
  companies: Company[],
  pipelines: PipelineRow[],
  ownerName: string,
): ActivityExecutionContext {
  return { mission, activities, companies, pipelines, ownerName };
}

function primaryContactEmail(activity: Activity, companies: Company[]): string {
  const company = companies.find((row) => row.Title === activity.Company?.Title);
  const contact = company?.contacts.find(
    (row) => row.Title === activity.Contact?.Title || row.ContactID === activity.Contact?.Title,
  );
  if (contact?.Email) return contact.Email;
  const domain = (activity.Company?.Title ?? "customer")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20);
  return `contact@${domain || "customer"}.com`;
}

function greeting(activity: Activity): string {
  const name = activity.Contact?.Title?.split(" ")[0];
  return name ?? "there";
}

function focusItems(ctx: ActivityExecutionContext): ActivityFocusItem[] {
  const { mission } = ctx;
  return [
    ...(mission.todayFocus ? [mission.todayFocus] : []),
    ...mission.needsAttention,
    ...mission.upcoming,
  ];
}

export function prepareFollowUpEmail(ctx: ActivityExecutionContext): PreparedFollowUpEmail {
  const focus = ctx.mission.todayFocus ?? focusItems(ctx)[0];
  const activity = focus?.activity;
  const companyTitle = activity?.Company?.Title ?? "your team";
  const companyRecord = activity?.Company?.Title
    ? ctx.companies.find((row) => row.Title === activity.Company?.Title)
    : undefined;
  const sectorLine = sectorDraftParagraph(companyRecord?.Sectors);
  const subject = activity?.Deal?.Title
    ? `Following up on ${activity.Deal.Title}`
    : `Following up — ${activity?.Subject ?? "next steps"}`;

  const questions = focusItems(ctx)
    .slice(0, 3)
    .map((item) => `• ${item.recommendedAction}`);

  const body = [
    `Hi ${greeting(activity ?? ({} as Activity))},`,
    "",
    `I wanted to follow up on ${activity?.Subject ?? "our recent conversation"} with ${companyTitle}.`,
    "",
    focus ? focus.whyItMatters : "Keeping momentum on our open items.",
    ...(sectorLine ? ["", sectorLine] : []),
    "",
    "Could you help with the following:",
    ...(questions.length > 0 ? questions : ["• Confirm timing for the next step"]),
    "",
    "Happy to jump on a short call if easier.",
    "",
    "Best regards,",
    ctx.ownerName,
  ].join("\n");

  return {
    to: activity ? primaryContactEmail(activity, ctx.companies) : "customer@example.com",
    subject,
    body,
  };
}

export function prepareCustomerMeeting(ctx: ActivityExecutionContext): PreparedCustomerMeeting {
  const focus = ctx.mission.todayFocus ?? focusItems(ctx)[0];
  const activity = focus?.activity;

  return buildCustomerMeeting({
    focus: focus ?? null,
    activity,
    companyName: activity?.Company?.Title ?? "Customer",
    ownerName: ctx.ownerName,
    focusItems: focusItems(ctx),
  });
}

export function summarizeOpenRisks(ctx: ActivityExecutionContext): PreparedRiskSummary {
  const risks = ctx.mission.openRisks.map((risk) => {
    const source = ctx.activities.find((activity) => activity.Risks?.includes(risk));
    return {
      risk,
      context: source?.Company?.Title
        ? `${source.Company.Title}${source.Deal?.Title ? ` · ${source.Deal.Title}` : ""}`
        : "Active workspace",
      suggestedAction:
        source?.NextAction?.trim() ||
        "Discuss with the customer and assign an owner to mitigate.",
    };
  });

  return {
    headline:
      risks.length > 0
        ? `${risks.length} open risk${risks.length === 1 ? "" : "s"} across your activities`
        : "No material risks flagged in open activities",
    risks,
  };
}

export function createWeeklyActionPlan(ctx: ActivityExecutionContext): PreparedWeeklyPlan {
  const priorities = focusItems(ctx)
    .slice(0, 5)
    .map((item) => `${item.headline} — ${item.recommendedAction}`);

  const meetings = ctx.activities
    .filter((activity) => /meeting|call/i.test(activity.ActivityType))
    .filter((activity) => activity.ActionStatus !== "Completed")
    .slice(0, 4)
    .map((activity) => activity.Subject);

  const followUps = focusItems(ctx)
    .slice(0, 6)
    .map((item) => {
      const due = item.timingLabel ?? formatDueDate(item.activity.NextActionDate);
      return `${item.headline}${due ? ` (${due})` : ""}`;
    });

  return {
    headline: `Weekly action plan — ${ctx.ownerName}`,
    priorities:
      priorities.length > 0
        ? priorities
        : ["Schedule proactive outreach with top accounts"],
    meetings,
    followUps,
    risksToWatch: ctx.mission.openRisks.slice(0, 4),
  };
}
