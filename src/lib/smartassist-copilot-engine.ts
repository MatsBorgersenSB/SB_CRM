import { buildSuggestedActivities } from "@/lib/activity-workspace";
import { isFollowUpOpen, isFollowUpOverdue } from "@/lib/activity-utils";
import { buildAttentionItems } from "@/lib/smart-attention-engine";
import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { isQuotationKind } from "@/types/commercial-package";
import { deal360Href } from "@/types/relationship-navigation";
import type {
  CoPilotActionKind,
  CoPilotActionProposal,
  CoPilotSourceType,
} from "@/types/smartassist-copilot";
import type { AttentionItem } from "@/types/attention-item";

const MAX_PROPOSALS = 8;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isToday(value: string): boolean {
  if (!value) return false;
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  return startOfDay(date).getTime() === startOfDay(new Date()).getTime();
}

function isMeetingType(type: Activity["ActivityType"]): boolean {
  return type === "Meeting" || type === "Teams Meeting";
}

function meetingEnded(activity: Activity): boolean {
  if (!isToday(activity.ActivityDate)) return false;
  const start = new Date(
    activity.ActivityDate.includes("T")
      ? activity.ActivityDate
      : activity.ActivityDate.replace(" ", "T"),
  );
  const durationMs = (activity.DurationMinutes ?? 60) * 60_000;
  return Date.now() > start.getTime() + durationMs;
}

const RULE_KIND_MAP: Record<string, CoPilotActionKind> = {
  overdue_followup: "complete_commitment",
  due_today: "complete_commitment",
  no_activity: "create_activity",
  no_recent_contact: "schedule_follow_up",
  stalled_opportunity: "schedule_follow_up",
  maintain_momentum: "draft_email",
  missing_stakeholders: "review_opportunity",
  risk_threshold_exceeded: "review_opportunity",
  incomplete_document_set: "review_document",
  package_not_transmitted: "review_document",
  add_primary_contact: "review_opportunity",
};

const RULE_SOURCE_MAP: Record<string, CoPilotSourceType> = {
  overdue_followup: "activity",
  due_today: "activity",
  no_activity: "relationship",
  no_recent_contact: "relationship",
  stalled_opportunity: "opportunity",
  maintain_momentum: "relationship",
  missing_stakeholders: "opportunity",
  risk_threshold_exceeded: "opportunity",
  incomplete_document_set: "document",
  package_not_transmitted: "document",
  add_primary_contact: "relationship",
};

function impactForSeverity(severity: AttentionItem["severity"]): string {
  switch (severity) {
    case "urgent":
      return "Revenue or relationship at risk — delayed action may cost deal momentum";
    case "needs_attention":
      return "Commercial progress may slow — stakeholder confidence could weaken";
    default:
      return "Portfolio visibility improves with timely follow-through";
  }
}

function observedChangeForItem(item: AttentionItem): string {
  switch (item.objectType) {
    case "Opportunity":
      return `Opportunity "${item.sourceObjectName}" changed state`;
    case "Activity":
      return `Activity "${item.sourceObjectName}" needs CRM update`;
    case "Document":
    case "DocumentSet":
    case "TransmissionPackage":
    case "CommercialBaseline":
      return `Document "${item.sourceObjectName}" status changed`;
    case "Contact":
      return `Contact "${item.sourceObjectName}" relationship signal`;
    default:
      return `Account "${item.sourceObjectName}" needs attention`;
  }
}

function proposalFromAttentionItem(
  item: AttentionItem,
  suggestionsByAttentionId: Map<string, ReturnType<typeof buildSuggestedActivities>[number]>,
): CoPilotActionProposal | null {
  const kind = RULE_KIND_MAP[item.ruleId];
  if (!kind) return null;

  const suggestion = suggestionsByAttentionId.get(item.id);
  const sourceType = RULE_SOURCE_MAP[item.ruleId] ?? "activity";

  const base: CoPilotActionProposal = {
    id: `copilot-${item.id}`,
    kind,
    status: "pending",
    title: item.suggestedAiAction,
    reason: item.recommendation,
    impact: impactForSeverity(item.severity),
    observedChange: observedChangeForItem(item),
    sourceType,
    severity: item.severity,
    companyName: item.companyName,
    objectName: item.sourceObjectName,
    href: item.href,
    attentionItemId: item.id,
    payload: {},
  };

  if (kind === "complete_commitment" && item.objectType === "Activity") {
    return {
      ...base,
      payload: {
        activityId: item.sourceObjectId,
        activityUpdate: { ActionStatus: "Completed" },
      },
    };
  }

  if (
    (kind === "create_activity" || kind === "schedule_follow_up" || kind === "draft_email") &&
    suggestion
  ) {
    const preset = suggestion.preset;
    return {
      ...base,
      payload: {
        createActivity: {
          ActivityType: preset.ActivityType,
          Subject: preset.Subject,
          Summary: preset.Summary,
          ActivityDate: new Date().toISOString(),
          ActionRequired: preset.ActionRequired,
          NextAction: preset.NextAction,
          NextActionDate: preset.NextActionDate,
          ActionStatus: preset.ActionStatus ?? "Planned",
          Company: preset.Company,
          Contact: preset.Contact,
          Deal: preset.Deal,
          M365Targets: preset.M365Targets,
        },
      },
    };
  }

  if (kind === "review_opportunity" || kind === "review_document") {
    return {
      ...base,
      payload: {
        prefill: item.companyId ? { companyId: item.companyId } : undefined,
      },
    };
  }

  return base;
}

function proposalsFromMeetings(activities: Activity[]): CoPilotActionProposal[] {
  const proposals: CoPilotActionProposal[] = [];

  for (const activity of activities) {
    if (!isMeetingType(activity.ActivityType)) continue;
    if (!isToday(activity.ActivityDate)) continue;
    if (!meetingEnded(activity)) continue;
    if (activity.ActionStatus === "Completed") continue;

    proposals.push({
      id: `copilot-meeting-${activity.ActivityID}`,
      kind: "log_meeting_outcome",
      status: "pending",
      title: `Log outcome for "${activity.Subject}"`,
      reason: "Meeting ended — capture decisions and next steps in CRM",
      impact: "Medium — keeps opportunity timeline accurate",
      observedChange: `Meeting "${activity.Subject}" completed today`,
      sourceType: "meeting",
      severity: "needs_attention",
      companyName: activity.Company?.Title,
      objectName: activity.Subject,
      href: `/activities/${activity.ActivityID}?capture=1`,
      payload: {
        activityId: activity.ActivityID,
        prefill: {
          ActivityType: activity.ActivityType,
          Subject: activity.Subject,
          companyId: activity.Company?.Title ?? "",
          dealId: activity.Deal?.Title ?? "",
          recordMode: "true",
        },
      },
    });
  }

  return proposals;
}

function proposalsFromQuotations(
  commercialPackages: CommercialPackage[],
): CoPilotActionProposal[] {
  const proposals: CoPilotActionProposal[] = [];

  for (const pkg of commercialPackages) {
    if (!isQuotationKind(pkg.kind)) continue;
    if (pkg.status !== "sent") continue;

    proposals.push({
      id: `copilot-quote-${pkg.PackageID}`,
      kind: "draft_email",
      status: "pending",
      title: `Follow up on quotation — ${pkg.title || pkg.DocumentSetID}`,
      reason: "Quotation sent and awaiting customer response",
      impact: "High — quotation follow-up protects revenue timing",
      observedChange: `Quotation "${pkg.title || pkg.DocumentSetID}" awaiting response`,
      sourceType: "document",
      severity: "needs_attention",
      objectName: pkg.title || pkg.DocumentSetID,
      href: deal360Href(pkg.DealId, "commercial", { packageId: pkg.PackageID }),
      payload: {
        createActivity: {
          ActivityType: "Email Follow-Up",
          Subject: `Follow up: ${pkg.title || pkg.DocumentSetID}`,
          Summary: "Quotation awaiting customer response — schedule follow-up",
          ActivityDate: new Date().toISOString(),
          ActionRequired: true,
          NextAction: "Send quotation follow-up email",
          NextActionDate: new Date().toISOString().slice(0, 10),
          ActionStatus: "Planned",
          Deal: { DealID: pkg.DealId },
        },
        prefill: {
          dealId: pkg.DealId,
          ActivityType: "Email Follow-Up",
          Subject: `Follow up: ${pkg.title || pkg.DocumentSetID}`,
        },
      },
    });
  }

  return proposals;
}

function proposalsFromOverdueFollowUps(activities: Activity[]): CoPilotActionProposal[] {
  const proposals: CoPilotActionProposal[] = [];

  for (const activity of activities) {
    if (!isFollowUpOpen(activity)) continue;
    if (!isFollowUpOverdue(activity)) continue;

    proposals.push({
      id: `copilot-overdue-${activity.ActivityID}`,
      kind: "complete_commitment",
      status: "pending",
      title: `Close overdue commitment — ${activity.NextAction || activity.Subject}`,
      reason: "Open commitment is past due — update CRM status",
      impact: "Medium — clears stale commitments from your queue",
      observedChange: `Commitment "${activity.NextAction || activity.Subject}" is overdue`,
      sourceType: "activity",
      severity: "urgent",
      companyName: activity.Company?.Title,
      objectName: activity.Subject,
      href: `/activities/${activity.ActivityID}`,
      payload: {
        activityId: activity.ActivityID,
        activityUpdate: { ActionStatus: "Completed" },
      },
    });
  }

  return proposals;
}

export function buildCoPilotProposals(
  companies: Company[],
  pipelines: PipelineRow[],
  activities: Activity[],
  commercialPackages: CommercialPackage[],
): CoPilotActionProposal[] {
  const attentionItems = buildAttentionItems({
    companies,
    pipelines,
    activities,
    commercialPackages,
  }).filter((item) => item.status === "open");

  const suggestions = buildSuggestedActivities(attentionItems);
  const suggestionsByAttentionId = new Map(
    suggestions.map((suggestion) => [suggestion.attentionItem.id, suggestion]),
  );

  const seen = new Set<string>();
  const proposals: CoPilotActionProposal[] = [];

  const pushUnique = (proposal: CoPilotActionProposal) => {
    if (seen.has(proposal.id)) return;
    seen.add(proposal.id);
    proposals.push(proposal);
  };

  for (const item of attentionItems) {
    const proposal = proposalFromAttentionItem(item, suggestionsByAttentionId);
    if (proposal) pushUnique(proposal);
  }

  for (const proposal of proposalsFromMeetings(activities)) {
    pushUnique(proposal);
  }

  for (const proposal of proposalsFromQuotations(commercialPackages)) {
    pushUnique(proposal);
  }

  for (const proposal of proposalsFromOverdueFollowUps(activities)) {
    pushUnique(proposal);
  }

  const severityRank: Record<AttentionItem["severity"], number> = {
    urgent: 0,
    needs_attention: 1,
    waiting: 2,
    healthy: 3,
    completed: 4,
  };

  return proposals
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
    .slice(0, MAX_PROPOSALS);
}
