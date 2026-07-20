import type {
  ProjectRelatedOrganization,
  ProjectRemovedStakeholderRecord,
  ProjectStakeholderIntelligence,
  ProjectStakeholderRecord,
} from "@/types/project-relationships";
import type { ProjectUnderstanding } from "@/lib/project-discovery-intelligence";
import type { SmartAssistInsightCatalog } from "@/types/smartassist-intelligence";

/** Phase 2.1 — Project Workspace Light */

export type ProjectKind = "customer" | "internal" | "strategic" | "research";

export type ProjectStatus = "Planning" | "Active" | "On Hold" | "At Risk" | "Completed";

/** Lifecycle stage — independent of status/health. */
export type ProjectStage =
  | "Planning"
  | "Execution"
  | "Commissioning"
  | "Operational"
  | "Support"
  | "Closed";

export type ProjectPriority = "Critical" | "High" | "Medium" | "Low";

export type ProjectHealth = "Healthy" | "Needs Attention" | "At Risk";

export type StrategicImportance = "Critical" | "High" | "Medium" | "Low";

export type ProjectMilestoneStatus = "Planned" | "In Progress" | "Blocked" | "Complete";

export type StakeholderInfluence = "High" | "Medium" | "Low";

/** Hierarchy slot on the project team. */
export type ProjectTeamCategory =
  | "project_manager"
  | "project_member"
  | "customer_project_manager"
  | "customer_member"
  | "associated_contact";

export type ProjectTeamMember = {
  id: string;
  category: ProjectTeamCategory;
  name: string;
  projectRole: string;
  /** Standard Bio staff */
  userId?: number;
  /** External contact */
  contactId?: string;
  companyId?: string;
  companyName?: string;
  influence?: StakeholderInfluence;
};

/** @deprecated Use ProjectTeamMember with category associated_contact */
export type ProjectStakeholder = {
  contactId?: string;
  name: string;
  role: string;
  influence: StakeholderInfluence;
  companyName?: string;
};

/** @deprecated Use ProjectTeamMember with category project_member */
export type ProjectInternalMember = {
  userId: number;
  name: string;
  role: string;
};

export type ProjectMilestone = {
  id: string;
  title: string;
  owner: string;
  status: ProjectMilestoneStatus;
  targetDate: string;
};

export type ProjectDecision = {
  id: string;
  decision: string;
  date: string;
  owner: string;
};

export type ProjectRisk = {
  id: string;
  risk: string;
  impact: string;
  recommendedAction: string;
  severity: "critical" | "warning" | "healthy";
};

export type Project = {
  id: string;
  name: string;
  kind: ProjectKind;
  owner: string;
  status: ProjectStatus;
  /** Delivery lifecycle stage */
  stage?: ProjectStage;
  priority: ProjectPriority;
  health: ProjectHealth;
  strategicImportance: StrategicImportance;
  objective: string;
  problem: string;
  successCriteria: string;
  linkedCompanyId?: string;
  linkedDealId?: string;
  /** Phase 2.2A — related organizations on the project */
  relatedOrganizations?: ProjectRelatedOrganization[];
  /** Phase 2.2A — stakeholder roster with roles and org linkage */
  projectStakeholders?: ProjectStakeholderRecord[];
  /** Phase 2.2D — removed stakeholders stay removed */
  removedStakeholders?: ProjectRemovedStakeholderRecord[];
  team: ProjectTeamMember[];
  /** Legacy — migrated into team on read */
  stakeholders?: ProjectStakeholder[];
  /** Legacy — migrated into team on read */
  internalMembers?: ProjectInternalMember[];
  milestones: ProjectMilestone[];
  decisions: ProjectDecision[];
  risks: ProjectRisk[];
};

export type ProjectOpenWork = {
  openActivities: ActivitySummary[];
  blockedActivities: ActivitySummary[];
  openRisks: Array<{ id: string; risk: string; severity: ProjectRisk["severity"] }>;
  openIssues: Array<{ id: string; label: string; detail: string }>;
};

export type ActivitySummary = {
  id: string;
  subject: string;
  status: string;
};

export type ProjectIntelligence = {
  healthLabel: ProjectHealth;
  summary: string;
  whatChanged: string;
  requiresAttention: string | null;
  recommendedNext: string | null;
  biggestRisk: string | null;
  biggestOpportunity: string | null;
  confidence: "high" | "medium" | "low";
  stakeholderIntelligence?: ProjectStakeholderIntelligence;
  /** Phase 2.2 — evidence-based discovery model */
  discovery?: ProjectUnderstanding;
  insightCatalog?: SmartAssistInsightCatalog;
  discoveryReady?: boolean;
  /** Reality-first open work — only populated when items exist */
  openWork?: ProjectOpenWork;
  /** When true, suppress fabricated discovery hero insights */
  realityFirst?: boolean;
};

export const PROJECT_KIND_LABELS: Record<ProjectKind, string> = {
  customer: "Customer Project",
  internal: "Internal Project",
  strategic: "Strategic Initiative",
  research: "Research Project",
};

export const PROJECT_STAGES: ProjectStage[] = [
  "Planning",
  "Execution",
  "Commissioning",
  "Operational",
  "Support",
  "Closed",
];

export const PROJECT_STAGE_LABELS: Record<ProjectStage, string> = {
  Planning: "Planning",
  Execution: "Execution",
  Commissioning: "Commissioning",
  Operational: "Operational",
  Support: "Support",
  Closed: "Closed",
};

/** Stages where delivery discovery gaps (decision maker, approver) are not invented. */
export function isPostDeliveryStage(stage: ProjectStage | undefined): boolean {
  return stage === "Operational" || stage === "Support" || stage === "Closed";
}

export const PROJECT_TEAM_CATEGORY_LABELS: Record<ProjectTeamCategory, string> = {
  project_manager: "Project manager",
  project_member: "Project members",
  customer_project_manager: "Customer project manager",
  customer_member: "Customer members",
  associated_contact: "Associated contacts",
};

export const PROJECT_TEAM_CATEGORY_ORDER: ProjectTeamCategory[] = [
  "project_manager",
  "project_member",
  "customer_project_manager",
  "customer_member",
  "associated_contact",
];

export const INTERNAL_TEAM_CATEGORIES: ProjectTeamCategory[] = [
  "project_manager",
  "project_member",
];

export const CUSTOMER_TEAM_CATEGORIES: ProjectTeamCategory[] = [
  "customer_project_manager",
  "customer_member",
  "associated_contact",
];
