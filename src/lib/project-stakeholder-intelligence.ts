import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { Project } from "@/types/project";
import { isPostDeliveryStage } from "@/types/project";
import { detectProjectRelationshipMismatch } from "@/lib/project-relationship-validation";
import {
  getProjectRelatedOrganizations,
  getProjectStakeholders,
  resolveStakeholderOrganizationName,
} from "@/lib/project-relationship-utils";
import { INTERNAL_ORGANIZATION_ID } from "@/types/project-relationships";
import type {
  ProjectExecutionAssignment,
  ProjectExecutionBlocker,
  ProjectExecutionIntelligence,
  ProjectStakeholderGap,
  ProjectStakeholderIntelligence,
} from "@/types/project-relationships";

function roleMatches(stakeholders: ReturnType<typeof getProjectStakeholders>, patterns: string[]): boolean {
  return stakeholders.some((entry) =>
    patterns.some((pattern) => entry.role.toLowerCase().includes(pattern.toLowerCase())),
  );
}

function hasStakeholderEvidenceContext(
  project: Project,
  activities: Activity[],
  companies: Company[],
): boolean {
  const orgs = getProjectRelatedOrganizations(project);
  const accountId =
    project.linkedCompanyId ?? orgs.find((org) => org.isPrimary)?.companyId;
  if (!accountId) return false;

  const company = companies.find((entry) => entry.CompanyID === accountId);
  const hasContacts = (company?.contacts.length ?? 0) > 0;
  const hasDeal = Boolean(project.linkedDealId);
  const hasLoggedActivities = activities.some(
    (activity) => activity.Summary?.trim() || activity.Subject?.trim(),
  );
  const hasDecisions = project.decisions.length > 0;

  return hasContacts && (hasDeal || hasLoggedActivities || hasDecisions);
}

function buildMissingRoleGaps(
  project: Project,
  stakeholders: ReturnType<typeof getProjectStakeholders>,
  organizations: ReturnType<typeof getProjectRelatedOrganizations>,
  activities: Activity[],
  companies: Company[],
): ProjectStakeholderGap[] {
  const gaps: ProjectStakeholderGap[] = [];
  if (isPostDeliveryStage(project.stage)) {
    return gaps;
  }

  const hasEvidence = hasStakeholderEvidenceContext(project, activities, companies);

  if (
    hasEvidence &&
    project.kind === "customer" &&
    !roleMatches(stakeholders, ["decision maker"])
  ) {
    gaps.push({
      id: "decision_maker",
      label: "Missing Decision Maker",
      impact: "Commercial and technical trade-offs may stall without a named decision owner.",
      recommendedAction: "Assign a customer-side Decision Maker with budget authority.",
      severity: "warning",
    });
  }

  if (
    hasEvidence &&
    project.kind === "customer" &&
    (project.status === "Active" || project.decisions.length > 0) &&
    !roleMatches(stakeholders, ["executive sponsor", "project sponsor", "sponsor"])
  ) {
    gaps.push({
      id: "sponsor",
      label: "Missing Sponsor",
      impact: "Executive alignment weakens when no sponsor is accountable for project success.",
      recommendedAction: "Add an Executive Sponsor or Project Sponsor from the customer organization.",
      severity: "warning",
    });
  }

  if (
    hasEvidence &&
    project.milestones.length > 0 &&
    !roleMatches(stakeholders, ["technical lead", "integrator"])
  ) {
    gaps.push({
      id: "technical_lead",
      label: "Missing Technical Lead",
      impact: "Engineering decisions and specification changes lack a clear technical owner.",
      recommendedAction: "Assign a Technical Lead or Integrator from delivery or customer side.",
      severity: project.risks.some((risk) => risk.severity === "critical") ? "critical" : "warning",
    });
  }

  const hasSupplierOrg = organizations.some((org) => org.organizationType === "supplier");
  if (hasSupplierOrg && !roleMatches(stakeholders, ["supplier"])) {
    gaps.push({
      id: "supplier",
      label: "Missing Supplier Contact",
      impact: "Supplier delivery commitments are not represented on the project stakeholder map.",
      recommendedAction: "Add a Supplier contact from the linked supplier organization.",
      severity: "warning",
    });
  }

  const needsApprover =
    organizations.some((org) => org.organizationType === "regulator") ||
    project.risks.some((risk) => risk.risk.toLowerCase().includes("permit"));
  if (
    needsApprover &&
    hasEvidence &&
    !roleMatches(stakeholders, ["legal", "procurement", "approver", "eic"])
  ) {
    gaps.push({
      id: "approver",
      label: "Missing Approver",
      impact: "Permitting, legal, or procurement gates may block commissioning without an approver.",
      recommendedAction: "Add Legal, Procurement, or EIC coverage for regulatory sign-off.",
      severity: "critical",
    });
  }

  return gaps;
}

function computeCoverageScore(
  stakeholders: ReturnType<typeof getProjectStakeholders>,
  gaps: ProjectStakeholderGap[],
): number {
  const base = Math.min(100, stakeholders.length * 12);
  const penalty = gaps.filter((gap) => gap.severity === "critical").length * 18
    + gaps.filter((gap) => gap.severity === "warning").length * 8;
  return Math.max(0, Math.min(100, base - penalty));
}

function coverageLabel(score: number): string {
  if (score >= 80) return "Strong coverage";
  if (score >= 55) return "Partial coverage";
  return "Gaps in coverage";
}

function relationshipHealthFromCoverage(
  score: number,
  gaps: ProjectStakeholderGap[],
): ProjectStakeholderIntelligence["relationshipHealth"] {
  if (gaps.some((gap) => gap.severity === "critical")) return "At Risk";
  if (score < 55) return "Needs Attention";
  return "Healthy";
}

const OWNER_ROLE_PATTERNS = ["project manager", "commercial lead", "sponsor"];
const DELIVERY_ROLE_PATTERNS = ["technical lead", "integrator", "supplier", "consultant"];
const APPROVAL_ROLE_PATTERNS = ["decision maker", "legal", "procurement", "eic", "approver"];
const RECIPIENT_ROLE_PATTERNS = ["project sponsor", "technical buyer", "customer"];

function matchesRolePatterns(role: string, patterns: string[]): boolean {
  const normalized = role.toLowerCase();
  return patterns.some((pattern) => normalized.includes(pattern));
}

function buildExecutionIntelligence(
  project: Project,
  stakeholders: ReturnType<typeof getProjectStakeholders>,
  organizations: ReturnType<typeof getProjectRelatedOrganizations>,
  companies: Company[],
  activities: Activity[],
  missingRoles: ProjectStakeholderGap[],
): ProjectExecutionIntelligence {
  const owners: ProjectExecutionAssignment[] = [];
  const delivery: ProjectExecutionAssignment[] = [];
  const approvers: ProjectExecutionAssignment[] = [];
  const recipients: ProjectExecutionAssignment[] = [];
  const waiting: ProjectExecutionAssignment[] = [];

  for (const entry of stakeholders) {
    const org = resolveStakeholderOrganizationName(entry, organizations, companies);
    const detail = entry.responsibilities?.trim() || `${entry.role} on ${org.name}`;
    const base = {
      id: entry.id,
      name: entry.name,
      role: entry.role,
      organizationName: org.name,
      detail,
    };

    if (matchesRolePatterns(entry.role, OWNER_ROLE_PATTERNS)) {
      owners.push({ ...base, kind: "owner" });
    }
    if (matchesRolePatterns(entry.role, DELIVERY_ROLE_PATTERNS)) {
      delivery.push({ ...base, kind: "delivery" });
    }
    if (matchesRolePatterns(entry.role, APPROVAL_ROLE_PATTERNS)) {
      approvers.push({ ...base, kind: "approval" });
    }
    if (
      entry.organizationId !== INTERNAL_ORGANIZATION_ID ||
      matchesRolePatterns(entry.role, RECIPIENT_ROLE_PATTERNS)
    ) {
      if (entry.organizationId !== INTERNAL_ORGANIZATION_ID) {
        recipients.push({ ...base, kind: "recipient" });
      }
    }
  }

  for (const activity of activities) {
    if (activity.ActionStatus !== "Waiting") continue;
    const ownerName = activity.ActivityOwner?.Title ?? "Unassigned";
    waiting.push({
      id: `wait-${activity.id}`,
      kind: "waiting",
      name: ownerName,
      role: "Activity owner",
      organizationName: activity.Company?.Title ?? "—",
      detail: activity.Subject ?? "Waiting on follow-up",
    });
  }

  const blocked: ProjectExecutionBlocker[] = [];

  for (const milestone of project.milestones.filter((entry) => entry.status === "Blocked")) {
    blocked.push({
      id: `ms-${milestone.id}`,
      label: milestone.title,
      owner: milestone.owner,
      detail: `Milestone blocked — owner: ${milestone.owner}`,
      severity: "critical",
    });
  }

  for (const activity of activities.filter((entry) => entry.ActionStatus === "In Progress")) {
    blocked.push({
      id: `act-${activity.id}`,
      label: activity.Subject ?? "Open activity",
      owner: activity.ActivityOwner?.Title,
      detail: "Activity in progress — may need escalation if stalled.",
      severity: "warning",
    });
  }

  const missing = missingRoles.map((gap) => gap.label);

  if (owners.length === 0) {
    missing.push("No named project owner on stakeholder map");
  }
  if (delivery.length === 0) {
    missing.push("No delivery owner assigned");
  }
  if (approvers.length === 0 && project.kind === "customer") {
    missing.push("No approver or decision maker identified");
  }

  return {
    owners,
    delivery,
    approvers,
    recipients,
    waiting,
    blocked,
    missing,
  };
}

export function buildProjectStakeholderIntelligence(
  project: Project,
  companies: Company[],
  activities: Activity[] = [],
): ProjectStakeholderIntelligence {
  const organizations = getProjectRelatedOrganizations(project);
  const stakeholders = getProjectStakeholders(project);
  const missingRoles = buildMissingRoleGaps(
    project,
    stakeholders,
    organizations,
    activities,
    companies,
  );
  const coverageScore = computeCoverageScore(stakeholders, missingRoles);
  const relationshipValidation = detectProjectRelationshipMismatch(project, companies);
  const executionIntelligence = buildExecutionIntelligence(
    project,
    stakeholders,
    organizations,
    companies,
    activities,
    missingRoles,
  );

  const influenceMap = stakeholders.map((entry) => {
    const org = resolveStakeholderOrganizationName(entry, organizations, companies);
    return {
      stakeholderId: entry.id,
      name: entry.name,
      role: entry.role,
      influence: entry.influence ?? "Medium",
      organizationName: org.name,
      organizationType: org.type,
      responsibilities: entry.responsibilities,
    };
  });

  const responsibilities = stakeholders
    .filter((entry) => entry.responsibilities?.trim())
    .map((entry) => ({
      stakeholderId: entry.id,
      name: entry.name,
      role: entry.role,
      responsibilities: entry.responsibilities!.trim(),
    }));

  return {
    coverageScore,
    coverageLabel: coverageLabel(coverageScore),
    relationshipHealth: relationshipHealthFromCoverage(coverageScore, missingRoles),
    missingRoles,
    influenceMap,
    responsibilities,
    relationshipValidation,
    executionIntelligence,
  };
}
