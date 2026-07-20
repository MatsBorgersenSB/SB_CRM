import { syncActivityCreate, syncActivityUpdate } from "@/lib/sync-activity";
import { stashSmartAssistPrefill } from "@/lib/smart-assist-prefill";
import type { CreateActivityInput } from "@/types/activity";
import type { CoPilotActionProposal } from "@/types/smartassist-copilot";
import { markCoPilotProposalApproved } from "@/lib/smartassist-copilot-store";

export type CoPilotExecuteResult =
  | { mode: "applied"; message: string }
  | { mode: "navigate"; href: string; message: string };

function defaultActivityDate(): string {
  return new Date().toISOString();
}

function normalizeCreateInput(
  partial: Partial<CreateActivityInput>,
): CreateActivityInput {
  return {
    ActivityType: partial.ActivityType ?? "Task",
    ActivityDate: partial.ActivityDate ?? defaultActivityDate(),
    Subject: partial.Subject ?? "CRM update",
    Summary: partial.Summary ?? partial.Subject ?? "CRM update",
    ActionRequired: partial.ActionRequired ?? false,
    NextAction: partial.NextAction ?? "",
    NextActionDate: partial.NextActionDate ?? "",
    ActionStatus: partial.ActionStatus ?? "Planned",
    ActionOutcome: partial.ActionOutcome ?? "",
    ActivityDescription: partial.ActivityDescription ?? partial.Summary ?? partial.Subject ?? "CRM update",
    Company: partial.Company ?? null,
    Contact: partial.Contact ?? null,
    Deal: partial.Deal ?? null,
    M365Targets: partial.M365Targets,
    KeyDecisions: partial.KeyDecisions,
    AgreedActions: partial.AgreedActions,
    Risks: partial.Risks,
    DurationMinutes: partial.DurationMinutes,
    Priority: partial.Priority,
    ActivityOwner: partial.ActivityOwner,
    LinkedDeals: partial.LinkedDeals,
    LinkedContacts: partial.LinkedContacts,
    LinkedDocuments: partial.LinkedDocuments,
  };
}

export async function executeCoPilotProposal(
  proposal: CoPilotActionProposal,
): Promise<CoPilotExecuteResult> {
  const { kind, payload } = proposal;

  if (kind === "complete_commitment" && payload.activityId && payload.activityUpdate) {
    await syncActivityUpdate(payload.activityId, payload.activityUpdate);
    markCoPilotProposalApproved(proposal.id);
    return {
      mode: "applied",
      message: `Marked "${proposal.objectName ?? "commitment"}" complete in CRM.`,
    };
  }

  if (
    (kind === "create_activity" ||
      kind === "schedule_follow_up" ||
      kind === "draft_email") &&
    payload.createActivity
  ) {
    await syncActivityCreate(normalizeCreateInput(payload.createActivity));
    markCoPilotProposalApproved(proposal.id);
    return {
      mode: "applied",
      message: `Created activity "${payload.createActivity.Subject ?? proposal.title}" in CRM.`,
    };
  }

  if (
    (kind === "review_opportunity" ||
      kind === "review_document" ||
      kind === "log_meeting_outcome") &&
    proposal.href
  ) {
    if (payload.prefill) stashSmartAssistPrefill(payload.prefill);
    markCoPilotProposalApproved(proposal.id);
    return {
      mode: "navigate",
      href: proposal.href,
      message: `Opening ${proposal.objectName ?? "record"} for review.`,
    };
  }

  if (proposal.href) {
    if (payload.prefill) stashSmartAssistPrefill(payload.prefill);
    markCoPilotProposalApproved(proposal.id);
    return {
      mode: "navigate",
      href: proposal.href,
      message: "Opening record for manual review.",
    };
  }

  throw new Error("This recommendation cannot be applied automatically.");
}
