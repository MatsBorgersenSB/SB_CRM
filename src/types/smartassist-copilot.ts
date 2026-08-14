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
  | "create_opportunity"
  | "classify_company"
  | "complete_commitment"
  | "schedule_follow_up"
  | "set_reminder"
  | "propose_record_update"
  | "draft_email"
  | "review_opportunity"
  | "review_document"
  | "log_meeting_outcome";

export type CoPilotProposalStatus = "pending" | "approved" | "dismissed";

export type CoPilotRecordUpdatePatch = {
  companyId: string;
  /** Human label for the change — never invent values beyond what the user will confirm. */
  fieldLabel: string;
  /** Sparse company patch applied only on Approve when safe. */
  companyPatch?: {
    Status?: string;
    CompanyTypes?: string[];
    Sectors?: string[];
    AccountOwner?: { Id: number; Title: string } | null;
  };
};

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
  companyId?: string;
  companyName?: string;
  objectName?: string;
  href?: string;
  attentionItemId?: string;
  /** Stable suppress key — survives proposal id format changes. */
  suppressionKey?: string;
  payload: {
    createActivity?: Partial<CreateActivityInput>;
    activityId?: string;
    activityUpdate?: Partial<UpdateActivityInput>;
    prefill?: Record<string, string>;
    recordUpdate?: CoPilotRecordUpdatePatch;
  };
};

export const COPILOT_ACTION_LABELS: Record<CoPilotActionKind, string> = {
  create_activity: "Create activity",
  create_opportunity: "Create opportunity",
  classify_company: "Classify company",
  complete_commitment: "Mark commitment complete",
  schedule_follow_up: "Schedule follow-up",
  set_reminder: "Set reminder",
  propose_record_update: "Update record",
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
