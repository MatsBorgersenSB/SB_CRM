import type { AttentionItem } from "@/types/attention-item";
import type { SmartAssistEmailBriefing, SmartAssistEmailContext } from "@/types/smartassist-email";
import type { ConfidenceLevel } from "@/lib/opportunity-workspace-intelligence";

/** Pure SmartAssist email preparation — safe for client and server bundles. */

function confidenceFromSeverity(severity: AttentionItem["severity"]): ConfidenceLevel {
  if (severity === "urgent" || severity === "needs_attention") return "high";
  if (severity === "waiting") return "medium";
  return "low";
}

function confidenceLabel(level: ConfidenceLevel): string {
  if (level === "high") return "High";
  if (level === "medium") return "Medium";
  return "Low";
}

function contactFirstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function resolveEmail(item: AttentionItem): string {
  if (item.contactEmail) return item.contactEmail;
  const domain = (item.companyName ?? item.sourceObjectName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
  return `contact@${domain || "customer"}.com`;
}

function objectiveForItem(item: AttentionItem, contactName: string): string {
  switch (item.ruleId) {
    case "no_activity":
    case "log_first_interaction":
      return `Re-establish contact with ${contactName} and discover new initiatives or opportunities.`;
    case "no_recent_contact":
    case "schedule_follow_up_call":
      return `Restore relationship momentum and confirm current priorities with ${contactName}.`;
    case "stalled_opportunity":
    case "re_engage_stalled":
    case "follow_up_proposal":
      return `Re-engage on open commercial discussion and confirm decision timeline.`;
    case "maintain_momentum":
      return "Maintain active relationship cadence and surface upcoming business needs.";
    case "overdue_followup":
    case "complete_overdue_commitment":
    case "due_today":
      return "Close the open commitment and agree the next dated step.";
    case "missing_stakeholders":
    case "engage_additional_stakeholders":
      return `Expand stakeholder engagement at ${item.companyName ?? "the account"}.`;
    case "package_not_transmitted":
      return "Confirm receipt of commercial package and schedule review discussion.";
    case "risk_threshold_exceeded":
    case "document_risk":
      return "Address relationship or document risk before it affects delivery.";
    default:
      return `Follow up with ${contactName} on the recommended next step.`;
  }
}

function expectedOutcomeForItem(item: AttentionItem): string {
  switch (item.ruleId) {
    case "no_activity":
    case "log_first_interaction":
      return "Confirm relationship status and identify the next business discussion.";
    case "no_recent_contact":
    case "schedule_follow_up_call":
      return "Agree a dated next touchpoint and restore engagement cadence.";
    case "stalled_opportunity":
    case "re_engage_stalled":
    case "follow_up_proposal":
      return "Opportunity progression restored with clear owner and timeline.";
    case "maintain_momentum":
      return "Relationship stays warm with a logged next action.";
    case "overdue_followup":
    case "complete_overdue_commitment":
    case "due_today":
      return "Commitment closed or rescheduled with accountable owner.";
    default:
      return "Customer responds with clarity on next steps and timing.";
  }
}

function subjectForItem(item: AttentionItem, contactName: string): string {
  const company = item.companyName;
  if (item.objectType === "Opportunity") {
    return `Following up — ${item.sourceObjectName}`;
  }
  if (company) {
    return `Reconnecting — ${company}`;
  }
  return `Following up with ${contactName}`;
}

function buildEmailBody(
  item: AttentionItem,
  contactName: string,
  ownerName: string,
  objective: string,
): string {
  const greeting = contactFirstName(contactName);
  const company = item.companyName ?? "your organization";

  const lines = [
    `Hi ${greeting},`,
    "",
    `I hope you are well. I wanted to reach out regarding our work with ${company}.`,
    "",
    objective,
    "",
    "Would you have time for a brief conversation in the coming days? I am happy to work around your schedule.",
    "",
    "Best regards,",
    ownerName,
  ];

  if (item.recommendation && !item.recommendation.includes(greeting)) {
    lines.splice(4, 0, item.recommendation, "");
  }

  return lines.filter((line, index, arr) => !(line === "" && arr[index - 1] === "")).join("\n");
}

function followUpForItem(item: AttentionItem, contactName: string): string {
  if (item.ruleId === "no_activity" || item.ruleId === "log_first_interaction") {
    return `If no reply within 5 business days, schedule a follow-up call with ${contactName}.`;
  }
  if (item.dueDate) {
    return `Follow up by ${new Date(item.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} if no response.`;
  }
  return "Log a follow-up activity if no reply within one week.";
}

function meetingForItem(item: AttentionItem, contactName: string): string {
  const company = item.companyName ?? "the account";
  return `30-minute sync with ${contactName} to review ${company} priorities and agree next steps.`;
}

export function isDraftEmailAction(item: Pick<AttentionItem, "suggestedAiAction">): boolean {
  const action = item.suggestedAiAction.toLowerCase();
  return action.includes("draft email") || action.includes("send email");
}

export function prepareSmartAssistEmail(
  item: AttentionItem,
  context: SmartAssistEmailContext,
): SmartAssistEmailBriefing {
  const contactName = context.contactName ?? item.sourceObjectName;
  const confidence = confidenceFromSeverity(item.severity);
  const objective = objectiveForItem(item, contactName);
  const expectedOutcome = expectedOutcomeForItem(item);
  const subject = subjectForItem(item, contactName);
  const body = buildEmailBody(item, contactName, context.ownerName, objective);
  const suggestedMeetingTitle = `Sync — ${item.companyName ?? contactName}`;

  return {
    actionLabel: item.suggestedAiAction,
    reason: item.recommendation,
    objective,
    expectedOutcome,
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    to: resolveEmail(item),
    contactName,
    companyName: item.companyName,
    subject,
    body,
    suggestedFollowUp: followUpForItem(item, contactName),
    suggestedMeeting: meetingForItem(item, contactName),
    suggestedMeetingTitle,
  };
}
