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

/** Outlook Relationship Card — exactly 5 blocks, no scroll. */
export type M365RelationshipCardPayload = {
  kind: "relationship-card";
  meta: M365IntelligenceMeta;
  companyName: string;
  /** Account id for Outlook capture actions (create opportunity). */
  companyId: string;
  /** Ecosystem role label — Supplier, Prospect, Unclassified, etc. */
  relationshipRoleLabel: string;
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
  meetingObjective: string;
  relationshipSummary: string;
  whatChanged: string[];
  openOpportunities: M365OpportunityBlock[];
  topRisks: M365RiskBlock[];
  discussionTopics: string[];
  nextBestAction: M365ActionBlock;
  deepLink: string;
};

/** Outlook Daily Focus pane. */
export type M365DailyFocusPayload = {
  kind: "daily-focus";
  meta: M365IntelligenceMeta;
  todaysFocus: string;
  topActions: M365ActionBlock[];
  topRelationshipRisk: M365RiskBlock | null;
  topOpportunityRisk: M365RiskBlock | null;
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
