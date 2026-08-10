/** Phase 2.2A — Project relationship & stakeholder model */

import type { StakeholderInfluence } from "@/types/project";

export type ProjectOrganizationType =
  | "customer"
  | "partner"
  | "supplier"
  | "consultant"
  | "regulator"
  | "investor"
  | "internal"
  | "other";

export type ProjectRelatedOrganization = {
  id: string;
  companyId: string;
  organizationType: ProjectOrganizationType;
  label?: string;
  isPrimary?: boolean;
};

/** Sentinel id for Standard Bio internal organization on a project. */
export const INTERNAL_ORGANIZATION_ID = "org-internal-standard-bio";

/**
 * Sentinel for external stakeholders whose company is not yet explicitly linked
 * on the project. Reality First: never invent a company membership from this.
 */
export const UNASSIGNED_ORGANIZATION_ID = "org-unassigned";

export type ProjectStakeholderRecord = {
  id: string;
  role: string;
  name: string;
  userId?: number;
  contactId?: string;
  organizationId: string;
  responsibilities?: string;
  influence?: StakeholderInfluence;
};

/** Phase 2.2D — user-removed stakeholders must not be recreated by migration or SmartAssist. */
export type ProjectRemovedStakeholderRecord = {
  stakeholderId: string;
  contactId?: string;
  userId?: number;
  role?: string;
  name?: string;
  removedAt: string;
};

export const PROJECT_ORGANIZATION_TYPE_LABELS: Record<ProjectOrganizationType, string> = {
  customer: "Customer",
  partner: "Partner",
  supplier: "Supplier",
  consultant: "Consultant",
  regulator: "Regulator",
  investor: "Investor",
  internal: "Internal",
  other: "Other",
};

export const PROJECT_ORGANIZATION_TYPES: ProjectOrganizationType[] = [
  "customer",
  "partner",
  "supplier",
  "consultant",
  "regulator",
  "investor",
  "internal",
  "other",
];

export const DEFAULT_PROJECT_STAKEHOLDER_ROLES = [
  "Project Manager",
  "Commercial Lead",
  "Technical Lead",
  "Decision Maker",
  "Executive Sponsor",
  "Project Sponsor",
  "Supplier",
  "Integrator",
  "Consultant",
  "EIC",
  "Procurement",
  "Legal",
] as const;

export type DefaultProjectStakeholderRole = (typeof DEFAULT_PROJECT_STAKEHOLDER_ROLES)[number];

export type ProjectStakeholderGapKind =
  | "decision_maker"
  | "sponsor"
  | "technical_lead"
  | "supplier"
  | "approver";

export type ProjectStakeholderGap = {
  id: ProjectStakeholderGapKind;
  label: string;
  impact: string;
  recommendedAction: string;
  severity: "critical" | "warning";
};

export type ProjectStakeholderInfluenceNode = {
  stakeholderId: string;
  name: string;
  role: string;
  influence: StakeholderInfluence;
  organizationName: string;
  organizationType: ProjectOrganizationType | "internal";
  responsibilities?: string;
};

export type ProjectStakeholderIntelligence = {
  coverageScore: number;
  coverageLabel: string;
  relationshipHealth: "Healthy" | "Needs Attention" | "At Risk";
  missingRoles: ProjectStakeholderGap[];
  influenceMap: ProjectStakeholderInfluenceNode[];
  responsibilities: Array<{
    stakeholderId: string;
    name: string;
    role: string;
    responsibilities: string;
  }>;
  /** Phase 2.2B — SmartAssist relationship validation */
  relationshipValidation?: ProjectRelationshipValidation;
  /** Phase 2.2B — who owns, delivers, approves, receives, waits, blocks */
  executionIntelligence?: ProjectExecutionIntelligence;
};

export type ProjectRelationshipValidation = {
  id: "relationship_mismatch";
  detected: boolean;
  severity: "warning" | "info";
  projectName: string;
  accountName: string;
  message: string;
  detail: string;
  recommendedAction: string;
};

export type ProjectExecutionAssignmentKind =
  | "owner"
  | "delivery"
  | "approval"
  | "recipient"
  | "waiting";

export type ProjectExecutionAssignment = {
  id: string;
  kind: ProjectExecutionAssignmentKind;
  name: string;
  role: string;
  organizationName: string;
  detail: string;
};

export type ProjectExecutionBlocker = {
  id: string;
  label: string;
  owner?: string;
  detail: string;
  severity: "critical" | "warning";
};

export type ProjectExecutionIntelligence = {
  owners: ProjectExecutionAssignment[];
  delivery: ProjectExecutionAssignment[];
  approvers: ProjectExecutionAssignment[];
  recipients: ProjectExecutionAssignment[];
  waiting: ProjectExecutionAssignment[];
  blocked: ProjectExecutionBlocker[];
  missing: string[];
};
