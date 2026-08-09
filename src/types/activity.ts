import type { SharePointLookup, SharePointPerson } from "@/types/company";

export type ActivityType =
  | "Phone Call"
  | "Email"
  | "Email Follow-Up"
  | "Teams Meeting"
  | "Meeting"
  | "Site Visit"
  | "Proposal Sent"
  | "Technical Review"
  | "Commercial Review"
  | "Task"
  | "Note"
  | "Other";

export type ActionStatus =
  | "Planned"
  | "Open"
  | "In Progress"
  | "Waiting"
  | "Completed"
  | "Cancelled";

export type ActionOutcome =
  | "Positive"
  | "Neutral"
  | "Negative"
  | "Pending"
  | "";

export type ActivityPriority = "Low" | "Normal" | "High" | "Urgent";

/** M365 sync targets — readiness for Outlook, Teams, Planner, OneNote. */
export type M365ActivityTargets = {
  outlook?: boolean;
  teams?: boolean;
  planner?: boolean;
  onenote?: boolean;
};

export const WORKSPACE_ACTIVITY_TYPES: ActivityType[] = [
  "Meeting",
  "Teams Meeting",
  "Phone Call",
  "Email Follow-Up",
  "Site Visit",
  "Commercial Review",
  "Task",
  "Note",
];

export const ACTIVITY_TYPES: ActivityType[] = [
  "Phone Call",
  "Email",
  "Email Follow-Up",
  "Teams Meeting",
  "Meeting",
  "Site Visit",
  "Proposal Sent",
  "Technical Review",
  "Commercial Review",
  "Task",
  "Note",
  "Other",
];

export const ACTION_STATUSES: ActionStatus[] = [
  "Planned",
  "Open",
  "In Progress",
  "Waiting",
  "Completed",
  "Cancelled",
];

export const TRACKING_STATUSES: ActionStatus[] = [
  "Planned",
  "In Progress",
  "Waiting",
  "Completed",
  "Cancelled",
];

export const ACTIVITY_PRIORITIES: ActivityPriority[] = [
  "Low",
  "Normal",
  "High",
  "Urgent",
];

export const ACTION_OUTCOMES: ActionOutcome[] = [
  "Positive",
  "Neutral",
  "Negative",
  "Pending",
  "",
];

export type ActivityQuickFilter =
  | "all"
  | "mine"
  | "planned"
  | "overdue"
  | "completed"
  | "this_week"
  | "needs_attention"
  | "meetings"
  | "calls"
  | "tasks";

export const ACTIVITY_QUICK_FILTERS: {
  id: ActivityQuickFilter;
  label: string;
}[] = [
  { id: "all", label: "All" },
  { id: "mine", label: "Mine" },
  { id: "planned", label: "Planned" },
  { id: "overdue", label: "Overdue" },
  { id: "completed", label: "Completed" },
  { id: "this_week", label: "This Week" },
  { id: "needs_attention", label: "Needs Attention" },
  { id: "meetings", label: "Meetings" },
  { id: "calls", label: "Calls" },
  { id: "tasks", label: "Tasks" },
];

/** Contextual document linked to an interaction — not folder browsing. */
export type LinkedDocument = {
  Title: string;
  DocCategory?: string;
  Revision?: string;
  DealId?: string;
};

/** Commitment captured during an interaction. */
export type AgreedAction = {
  text: string;
  dueDate?: string;
  status?: ActionStatus;
};

/** Stakeholder involved in an interaction. */
export type ActivityStakeholder = {
  name: string;
  role?: string;
  contactId?: string;
  influence?: "decision_maker" | "influencer" | "operational";
};

/** SmartAssist-generated assessment of knowledge completeness. */
export type SmartAssistAssessment = {
  generatedAt: string;
  confidence: "high" | "medium" | "low";
  summary: string;
  completenessScore: number;
  gaps: string[];
  recommendations: string[];
};

/**
 * SharePoint Activities list — frozen schema + Relationship Memory extensions.
 * Memory fields are optional for backward compatibility; derived at read time when absent.
 */
export type Activity = {
  /** SharePoint native list item ID */
  id: number;
  /** Tracking identifier, e.g. ACT-9001 */
  ActivityID: string;
  ActivityType: ActivityType;
  ActivityDate: string;
  Subject: string;
  ActivityDescription: string;
  Company: SharePointLookup | null;
  Contact: SharePointLookup | null;
  Deal: SharePointLookup | null;
  /** Project Workspace Light id (JSON project store — not a SharePoint lookup). */
  ProjectId?: string | null;
  ProjectName?: string | null;
  ActivityOwner: SharePointPerson | null;
  ActionRequired: boolean;
  NextAction: string;
  NextActionDate: string;
  ActionStatus: ActionStatus;
  ActionOutcome: ActionOutcome;
  /** Planned duration in minutes */
  DurationMinutes?: number;
  Priority?: ActivityPriority;
  /** M365 integration readiness */
  M365Targets?: M365ActivityTargets;
  /** Phase 1.26 — Outlook reconciliation metadata */
  OutlookMessageId?: string;
  OutlookConversationId?: string;
  ReconciledFromOutlook?: boolean;
  /** One-line relationship memory — visible on timeline without opening details */
  Summary?: string;
  /** Decisions made during the interaction */
  KeyDecisions?: string[];
  /** Commitments beyond the primary follow-up */
  AgreedActions?: AgreedAction[];
  /** Risks or blockers surfaced */
  Risks?: string[];
  /** Documents referenced in context */
  LinkedDocuments?: LinkedDocument[];
  /** Additional deals beyond primary Deal lookup */
  LinkedDeals?: SharePointLookup[];
  /** Additional contacts beyond primary Contact lookup */
  LinkedContacts?: SharePointLookup[];
  /** Extended stakeholder list beyond primary lookups */
  Stakeholders?: ActivityStakeholder[];
  /** SmartAssist knowledge capture assessment */
  SmartAssistAssessment?: SmartAssistAssessment;
};

export type CreateActivityInput = Pick<
  Activity,
  | "ActivityType"
  | "ActivityDate"
  | "Subject"
  | "ActivityDescription"
  | "ActionRequired"
  | "NextAction"
  | "NextActionDate"
  | "ActionStatus"
  | "ActionOutcome"
> & {
  Summary?: string;
  KeyDecisions?: string[];
  AgreedActions?: AgreedAction[];
  Risks?: string[];
  LinkedDocuments?: LinkedDocument[];
  LinkedDeals?: SharePointLookup[];
  LinkedContacts?: SharePointLookup[];
  Stakeholders?: ActivityStakeholder[];
  SmartAssistAssessment?: SmartAssistAssessment;
  DurationMinutes?: number;
  Priority?: ActivityPriority;
  M365Targets?: M365ActivityTargets;
  OutlookMessageId?: string;
  OutlookConversationId?: string;
  ReconciledFromOutlook?: boolean;
  Company?: SharePointLookup | { CompanyID: string } | null;
  Contact?: SharePointLookup | { ContactID: string } | null;
  Deal?: SharePointLookup | { DealID: string } | null;
  ProjectId?: string | null;
  ProjectName?: string | null;
  ActivityOwner?: SharePointPerson | null;
};

export type UpdateActivityInput = Partial<
  Omit<Activity, "id" | "ActivityID">
>;

export type ActivityFilters = {
  search: string;
  companyId: string;
  contactId: string;
  dealId: string;
  activityType: ActivityType | "";
  ownerId: string;
  status: ActionStatus | "";
  dateFrom: string;
  dateTo: string;
  quickFilter: ActivityQuickFilter;
};

export const EMPTY_ACTIVITY_FILTERS: ActivityFilters = {
  search: "",
  companyId: "",
  contactId: "",
  dealId: "",
  activityType: "",
  ownerId: "",
  status: "",
  dateFrom: "",
  dateTo: "",
  quickFilter: "all",
};

export type ActivityWorkspaceContext = {
  companyId?: string;
  contactId?: string;
  dealId?: string;
  projectId?: string;
  companyName?: string;
  contactName?: string;
  dealName?: string;
  projectName?: string;
};
