import type { CreateActivityInput, UpdateActivityInput } from "@/types/activity";
import type { AttentionSeverity } from "@/types/attention-item";

export type CoPilotSourceType =
  | "activity"
  | "meeting"
  | "email"
  | "document"
  | "opportunity"
  | "relationship";

export type CoPilotActionKind =
  | "create_activity"
  | "complete_commitment"
  | "schedule_follow_up"
  | "draft_email"
  | "review_opportunity"
  | "review_document"
  | "log_meeting_outcome";

export type CoPilotProposalStatus = "pending" | "approved" | "dismissed";

export type CoPilotActionProposal = {
  id: string;
  kind: CoPilotActionKind;
  status: CoPilotProposalStatus;
  title: string;
  reason: string;
  impact: string;
  observedChange: string;
  sourceType: CoPilotSourceType;
  severity: AttentionSeverity;
  companyName?: string;
  objectName?: string;
  href?: string;
  attentionItemId?: string;
  payload: {
    createActivity?: Partial<CreateActivityInput>;
    activityId?: string;
    activityUpdate?: Partial<UpdateActivityInput>;
    prefill?: Record<string, string>;
  };
};

export const COPILOT_ACTION_LABELS: Record<CoPilotActionKind, string> = {
  create_activity: "Create activity",
  complete_commitment: "Mark commitment complete",
  schedule_follow_up: "Schedule follow-up",
  draft_email: "Draft follow-up email",
  review_opportunity: "Review opportunity",
  review_document: "Review document",
  log_meeting_outcome: "Log meeting outcome",
};

/** Result of approving a Co-Pilot proposal (API / server executor). */
export type CoPilotExecuteResult =
  | { mode: "applied"; message: string }
  | {
      mode: "navigate";
      href: string;
      message: string;
      prefill?: Record<string, string>;
    };
