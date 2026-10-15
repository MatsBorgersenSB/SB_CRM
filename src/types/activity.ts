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
  | "Tradeshow"
  | "Seminar"
  | "Other";

/**
 * Prisma `ActivityType` for the SmartAssist activity engine.
 * SharePoint display labels stay on `ActivityType` above.
 */
export const SMART_ACTIVITY_TYPES = [
  "MEETING",
  "TEAMS_MEETING",
  "PHONE_CALL",
  "EMAIL_FOLLOW_UP",
  "SITE_VISIT",
  "COMMERCIAL_REVIEW",
  "TASK",
  "NOTE",
  "TRADESHOW",
  "SEMINAR",
] as const;

export type SmartActivityType = (typeof SMART_ACTIVITY_TYPES)[number];

/** Schedule shape used later by calendar vs floating work surfaces. */
export const ACTIVITY_TYPE_CATEGORIES = {
  TIME_BOUND_ACTIVITIES: [
    "MEETING",
    "TEAMS_MEETING",
    "SITE_VISIT",
    "COMMERCIAL_REVIEW",
    "TRADESHOW",
    "SEMINAR",
  ],
  FLOATING_ACTIVITIES: ["PHONE_CALL", "EMAIL_FOLLOW_UP", "TASK", "NOTE"],
} as const satisfies Record<string, readonly SmartActivityType[]>;

export const TIME_BOUND_ACTIVITIES =
  ACTIVITY_TYPE_CATEGORIES.TIME_BOUND_ACTIVITIES;
export const FLOATING_ACTIVITIES =
  ACTIVITY_TYPE_CATEGORIES.FLOATING_ACTIVITIES;

/** Tradeshow and seminar occupy whole days, with no start or end hour. */
export const ALL_DAY_ACTIVITY_TYPES = ["TRADESHOW", "SEMINAR"] as const satisfies readonly SmartActivityType[];

export function isAllDayActivityType(
  type: string,
): type is (typeof ALL_DAY_ACTIVITY_TYPES)[number] {
  return (ALL_DAY_ACTIVITY_TYPES as readonly string[]).includes(type);
}

/** Display labels for the SharePoint activity record. */
export const SMART_ACTIVITY_DISPLAY: Record<SmartActivityType, ActivityType> = {
  MEETING: "Meeting",
  TEAMS_MEETING: "Teams Meeting",
  PHONE_CALL: "Phone Call",
  EMAIL_FOLLOW_UP: "Email Follow-Up",
  SITE_VISIT: "Site Visit",
  COMMERCIAL_REVIEW: "Commercial Review",
  TASK: "Task",
  NOTE: "Note",
  TRADESHOW: "Tradeshow",
  SEMINAR: "Seminar",
};

export function smartActivityLabel(type: SmartActivityType): string {
  return SMART_ACTIVITY_DISPLAY[type];
}

export function toSmartActivityType(value: string | null | undefined): SmartActivityType | "" {
  if (!value) return "";
  if ((SMART_ACTIVITY_TYPES as readonly string[]).includes(value)) {
    return value as SmartActivityType;
  }
  const match = (Object.entries(SMART_ACTIVITY_DISPLAY) as [SmartActivityType, ActivityType][]).find(
    ([, label]) => label === value,
  );
  return match?.[0] ?? "";
}

/** Light JSON stored on `Activity.aiContext`. */
export type ActivityAiContext = Record<string, unknown>;

/** Prisma `Activity` row. Company and opportunity links are optional. */
export type ActivityEngineRecord = {
  id: string;
  activityType: SmartActivityType;
  title: string;
  startDate: Date | null;
  endDate: Date | null;
  isAiProposed: boolean;
  completedAt: Date | null;
  aiContext: ActivityAiContext | null;
  companyId: string | null;
  opportunityId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

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
  "Tradeshow",
  "Seminar",
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
  "Tradeshow",
  "Seminar",
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
  | "my_tasks"
  | "shared_with_me"
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
  { id: "my_tasks", label: "My tasks" },
  { id: "shared_with_me", label: "Shared with me" },
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
  /**
   * Colleagues this task is shared with (watchers / collaborators).
   * Distinct from ActivityOwner (single assignee).
   */
  SharedWith?: SharePointPerson[];
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
  /** Tradeshow / seminar: where, link, organiser, themes, why we go. */
  EventDetails?: ActivityEventDetails | null;
  /** Proposed by SmartAssist (e.g. read from an event link) and accepted by a person. */
  IsAiProposed?: boolean;
  /** Graph calendar event id after Schedule Teams Meeting. */
  TeamsEventId?: string;
  /** Teams join URL for the scheduled online meeting. */
  TeamsJoinUrl?: string;
  /** Outlook/Teams web link to the calendar item. */
  TeamsWebLink?: string;
  /** True after Schedule Teams Meeting writes back — stops re-recommending the same action. */
  TeamsScheduled?: boolean;
};

export type ActivityEventDetails = {
  location: string | null;
  website: string | null;
  organizer: string | null;
  objective: string | null;
  themes: string[];
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
  SharedWith?: SharePointPerson[];
  OutlookMessageId?: string;
  OutlookConversationId?: string;
  ReconciledFromOutlook?: boolean;
  Company?: SharePointLookup | { CompanyID: string } | null;
  Contact?: SharePointLookup | { ContactID: string } | null;
  Deal?: SharePointLookup | { DealID: string } | null;
  ProjectId?: string | null;
  ProjectName?: string | null;
  ActivityOwner?: SharePointPerson | null;
  EventDetails?: ActivityEventDetails | null;
  IsAiProposed?: boolean;
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
