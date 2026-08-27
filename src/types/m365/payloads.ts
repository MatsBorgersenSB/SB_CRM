/**
 * Canonical M365 intelligence payloads.
 * Never expose raw CRM entities — only decision-ready intelligence blocks.
 */

export type M365Severity = "critical" | "warning" | "info";

export type M365Priority = "High" | "Medium" | "Low";

/** Required on every API response — answers the four intelligence questions. */
export type M365IntelligenceMeta = {
  generatedAt: string;
  /** What matters? */
  whatMatters: string;
  /** What is at risk? */
  whatIsAtRisk: string;
  /** Why should I care? — primary impact narrative */
  whyItMatters: string;
  /** What should happen next? */
  whatShouldHappenNext: string;
};

export type M365HealthBlock = {
  score: number;
  status: string;
  trend: string;
};

export type M365RiskBlock = {
  id: string;
  label: string;
  detail?: string;
  severity: M365Severity;
  /** Required — why should I care? */
  impact: string[];
};

export type M365ActionBlock = {
  id: string;
  action: string;
  priority: M365Priority;
  /** Required — includes reason + consequences */
  impact: string[];
  href: string;
  plannerEligible: boolean;
  /**
   * FS-013 — when set, Outlook / Active Assist can Approve without leaving context.
   * Serialized Co-Pilot proposal for `/api/smartassist/copilot/execute`.
   */
  activeAssistProposal?: import("@/types/smartassist-copilot").CoPilotActionProposal;
};

export type M365OpportunityBlock = {
  id: string;
  label: string;
  stage: string;
  valueLabel: string;
  healthScore: number;
  impact: string[];
  href: string;
};

export type M365CommitmentBlock = {
  count: number;
  stateLabel: string;
  impact: string[];
};

export type M365OpportunityExposureBlock = {
  count: number;
  valueLabel: string;
  impact: string[];
};

export type M365ActivityBlock = {
  id: string;
  label: string;
  occurredLabel: string;
  href: string;
};

export type M365KnowledgeRiskBlock = {
  id: string;
  label: string;
  impact: string[];
  href: string;
};

/** Open NextAction shown under the relationship header — not a sixth intelligence block. */
export type M365PendingCommitment = {
  activityId: string;
  title: string;
  dueDate: string;
  overdue: boolean;
};

/** Outlook Relationship Card — exactly 5 blocks, no scroll. */
export type M365RelationshipCardPayload = {
  kind: "relationship-card";
  meta: M365IntelligenceMeta;
  companyName: string;
  /** Account id for Outlook capture actions (create opportunity). */
  companyId: string;
  /** Ecosystem role label — Supplier, Prospect, Unclassified, etc. */
  relationshipRoleLabel: string;
  /** Assigned go-to-market sectors. Empty until a person tags the company. */
  sectors: string[];
  /**
   * Header chrome — the open/overdue commitment the user owes this relationship.
   * Render under SectorTagManager; do not count toward the 5-block budget.
   */
  pendingCommitment: M365PendingCommitment | null;
  /**
   * Reality First — true only for sell-to roles (Customer / Prospect / Offtaker).
   * Outlook must not nag "Create opportunity" for suppliers, consultants, or unclassified.
   */
  opportunityEligible: boolean;
  health: M365HealthBlock;
  topRisk: M365RiskBlock | null;
  nextBestAction: M365ActionBlock;
  openOpportunities: M365OpportunityExposureBlock;
  openCommitments: M365CommitmentBlock;
  deepLink: string;
};

/** Outlook / Teams Meeting Briefing. */
export type M365MeetingBriefingPayload = {
  kind: "meeting-briefing";
  meta: M365IntelligenceMeta;
  companyName: string;
  /** Person in the meeting / email — Reality First when known. */
  counterpartyName: string | null;
  counterpartyRole: string | null;
  counterpartyEmail: string | null;
  meetingObjective: string;
  relationshipSummary: string;
  whatChanged: string[];
  openOpportunities: M365OpportunityBlock[];
  topRisks: M365RiskBlock[];
  discussionTopics: string[];
  nextBestAction: M365ActionBlock;
  deepLink: string;
};

/** Outlook Daily Focus pane — FS-018 exactly 4 blocks. */
export type M365DailyFocusCommitment = {
  id: string;
  title: string;
  dueLabel: string;
  overdue: boolean;
  impact: string[];
  href: string;
};

export type M365DailyFocusPayload = {
  kind: "daily-focus";
  meta: M365IntelligenceMeta;
  /** Block 1 — who to engage today (external preferred). */
  whoToEngage: M365ActionBlock | null;
  /** Block 2 — opportunity or project/relationship work at risk. */
  workAtRisk: M365RiskBlock | null;
  /** Block 3 — open commitment due or overdue. */
  openCommitmentDue: M365DailyFocusCommitment | null;
  /** Block 4 — singular next best action. */
  nextBestAction: M365ActionBlock;
};

/** Teams Account Workspace — max 7 sections. */
export type M365AccountWorkspacePayload = {
  kind: "account-workspace";
  meta: M365IntelligenceMeta;
  companyName: string;
  health: M365HealthBlock;
  relationshipSnapshot: string;
  lastContactLabel: string;
  nextBestAction: M365ActionBlock;
  topRisk: M365RiskBlock | null;
  openOpportunities: M365OpportunityBlock[];
  recentActivity: M365ActivityBlock[];
  knowledgeAtRisk: M365KnowledgeRiskBlock[];
  deepLink: string;
};

export type M365Payload =
  | M365RelationshipCardPayload
  | M365MeetingBriefingPayload
  | M365DailyFocusPayload
  | M365AccountWorkspacePayload;
