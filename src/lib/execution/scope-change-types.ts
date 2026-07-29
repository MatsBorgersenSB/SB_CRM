/** Scope Change / ECO types — safe for client components. */

export type ScopeChangeRequestSource =
  | "CLIENT_REQUEST"
  | "INTERNAL_ENGINEERING"
  | "SITE_SAFETY";

export type ScopeChangeStatus = "PROPOSED" | "APPROVED" | "REJECTED";

export type ScopeChangeRecord = {
  id: string;
  projectId: string;
  decisionJournalId: string | null;
  changeTitle: string;
  requestedBy: ScopeChangeRequestSource | string;
  description: string;
  costImpactEur: number;
  scheduleImpactDays: number;
  status: ScopeChangeStatus;
  approvedBy: string | null;
  createdAt: string;
};

export type ScopeChangeSummary = {
  projectId: string;
  projectTitle: string;
  changes: ScopeChangeRecord[];
  cumulativeCostImpactEur: number;
  cumulativeScheduleImpactDays: number;
  openProposedCount: number;
};

export const SCOPE_REQUEST_SOURCE_LABELS: Record<
  ScopeChangeRequestSource,
  string
> = {
  CLIENT_REQUEST: "Client Request",
  INTERNAL_ENGINEERING: "Internal Engineering",
  SITE_SAFETY: "Site Safety",
};

export const SCOPE_STATUS_LABELS: Record<ScopeChangeStatus, string> = {
  PROPOSED: "Proposed",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const SCOPE_REQUEST_SOURCE_OPTIONS: Array<{
  id: ScopeChangeRequestSource;
  label: string;
}> = [
  { id: "CLIENT_REQUEST", label: "Client Request" },
  { id: "INTERNAL_ENGINEERING", label: "Internal Engineering" },
  { id: "SITE_SAFETY", label: "Site Safety" },
];
