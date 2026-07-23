import type { ExecutionStatus } from "@/generated/prisma";

export type WorkflowExecutionView = {
  id: string;
  ruleId: string;
  ruleName: string;
  triggerType: string;
  opportunityId: string | null;
  opportunityName: string | null;
  companyId: string | null;
  companyName: string | null;
  actionType: string;
  status: ExecutionStatus;
  title: string;
  observation: string;
  reasoning: string;
  recommendation: string;
  expectedOutcome: string;
  executedAt: string | null;
  createdAt: string;
};

export type WorkflowApprovalQueueData = {
  executions: WorkflowExecutionView[];
  metrics: {
    pendingApprovals: number;
    executedToday: number;
    /** Advisory estimate — minutes saved when drafts/tasks are auto-prepared */
    timeSavedMinutes: number;
  };
  source: "prisma" | "empty";
};

export type WorkflowStatusFilter =
  | "all"
  | "pending_approval"
  | "executed"
  | "dismissed";

export type WorkflowTriggerFilter =
  | "all"
  | "expansion_signal_detected"
  | "meeting_commitment_confirmed"
  | "email_sentiment_drop";

export const WORKFLOW_STATUS_FILTERS: Array<{
  id: WorkflowStatusFilter;
  label: string;
}> = [
  { id: "all", label: "All statuses" },
  { id: "pending_approval", label: "Pending" },
  { id: "executed", label: "Executed" },
  { id: "dismissed", label: "Dismissed" },
];

export const WORKFLOW_TRIGGER_FILTERS: Array<{
  id: WorkflowTriggerFilter;
  label: string;
}> = [
  { id: "all", label: "All triggers" },
  { id: "expansion_signal_detected", label: "Signal Detected" },
  { id: "meeting_commitment_confirmed", label: "Commitment Confirmed" },
  { id: "email_sentiment_drop", label: "Sentiment Drop" },
];
