import type { Company } from "@/types/company";
import type { Project, ProjectTeamMember } from "@/types/project";
import { getProjectTeam } from "@/lib/project-team-utils";
import type {
  ProjectOrganizationType,
  ProjectRelatedOrganization,
  ProjectRemovedStakeholderRecord,
  ProjectStakeholderRecord,
} from "@/types/project-relationships";
import {
  DEFAULT_PROJECT_STAKEHOLDER_ROLES,
  INTERNAL_ORGANIZATION_ID,
  PROJECT_ORGANIZATION_TYPE_LABELS,
  UNASSIGNED_ORGANIZATION_ID,
} from "@/types/project-relationships";

let idCounter = 0;

export function createOrganizationId(): string {
  idCounter += 1;
  return `org-${Date.now()}-${idCounter}`;
}

export function createStakeholderId(): string {
  idCounter += 1;
  return `ps-${Date.now()}-${idCounter}`;
}

export function getOrganizationTypeLabel(type: ProjectOrganizationType): string {
  return PROJECT_ORGANIZATION_TYPE_LABELS[type];
}

export function getProjectRelatedOrganizations(project: Project): ProjectRelatedOrganization[] {
  if (project.relatedOrganizations !== undefined) {
    return project.relatedOrganizations;
  }
  return migrateOrganizationsFromLegacy(project);
}

export function isRemovedStakeholder(
  stakeholder: Pick<ProjectStakeholderRecord, "id" | "contactId" | "userId" | "role" | "name">,
  removed: ProjectRemovedStakeholderRecord[],
): boolean {
  return removed.some(
    (entry) =>
      entry.stakeholderId === stakeholder.id ||
      (entry.contactId && entry.contactId === stakeholder.contactId) ||
      (entry.userId &&
        entry.userId === stakeholder.userId &&
        entry.role?.toLowerCase() === stakeholder.role.toLowerCase()),
  );
}

export function getProjectStakeholders(project: Project): ProjectStakeholderRecord[] {
  const removed = project.removedStakeholders ?? [];

  if (project.projectStakeholders !== undefined) {
    return project.projectStakeholders.filter((entry) => !isRemovedStakeholder(entry, removed));
  }

  return migrateStakeholdersFromTeam(project).filter(
    (entry) => !isRemovedStakeholder(entry, removed),
  );
}

function migrateOrganizationsFromLegacy(project: Project): ProjectRelatedOrganization[] {
  const orgs: ProjectRelatedOrganization[] = [];

  if (project.linkedCompanyId) {
    orgs.push({
      id: createOrganizationId(),
      companyId: project.linkedCompanyId,
      organizationType: "customer",
      isPrimary: true,
      label: "Primary customer",
    });
  }

  return orgs;
}

function migrateStakeholdersFromTeam(project: Project): ProjectStakeholderRecord[] {
  const orgs = getProjectRelatedOrganizations(project);
  const primaryOrg = orgs.find((org) => org.isPrimary) ?? orgs[0];

  return getProjectTeam(project).map((member) => teamMemberToStakeholder(member, primaryOrg?.id));
}

function teamMemberToStakeholder(
  member: ProjectTeamMember,
  defaultOrgId?: string,
): ProjectStakeholderRecord {
  const isInternal =
    member.category === "project_manager" || member.category === "project_member";

  return {
    id: member.id,
    role: member.projectRole,
    name: member.name,
    userId: member.userId,
    contactId: member.contactId,
    organizationId: isInternal
      ? INTERNAL_ORGANIZATION_ID
      : defaultOrgId ?? member.companyId ?? INTERNAL_ORGANIZATION_ID,
    influence: member.influence,
  };
}

export function normalizeProjectRelationships(project: Project): Project {
  const relatedOrganizations = getProjectRelatedOrganizations(project);
  const removed = project.removedStakeholders ?? [];
  const rawStakeholders =
    project.projectStakeholders !== undefined
      ? project.projectStakeholders
      : migrateStakeholdersFromTeam(project);
  const projectStakeholders = rawStakeholders.filter(
    (entry) => !isRemovedStakeholder(entry, removed),
  );
  const primaryOrg =
    relatedOrganizations.find((org) => org.isPrimary) ?? relatedOrganizations[0];

  const manager = projectStakeholders.find(
    (entry) => entry.role.toLowerCase() === "project manager" && entry.userId,
  );

  return {
    ...project,
    relatedOrganizations,
    projectStakeholders,
    linkedCompanyId: primaryOrg?.companyId ?? project.linkedCompanyId,
    owner: manager?.name ?? project.owner,
    team: project.projectStakeholders !== undefined ? [] : getProjectTeam(project),
  };
}

export function resolveOrganizationLabel(
  organization: ProjectRelatedOrganization,
  companies: Company[],
): string {
  const company = companies.find((entry) => entry.CompanyID === organization.companyId);
  const typeLabel = getOrganizationTypeLabel(organization.organizationType);
  const companyName = company?.Title ?? organization.companyId;
  return organization.label?.trim()
    ? `${companyName} · ${organization.label}`
    : `${companyName} · ${typeLabel}`;
}

export function resolveStakeholderOrganizationName(
  stakeholder: ProjectStakeholderRecord,
  organizations: ProjectRelatedOrganization[],
  companies: Company[],
): { name: string; type: ProjectOrganizationType | "internal" } {
  if (stakeholder.organizationId === INTERNAL_ORGANIZATION_ID) {
    return { name: "Standard Bio", type: "internal" };
  }

  if (stakeholder.organizationId === UNASSIGNED_ORGANIZATION_ID) {
    return { name: "Organization not linked", type: "other" };
  }

  const org = organizations.find((entry) => entry.id === stakeholder.organizationId);
  if (!org) {
    const company = companies.find((entry) => entry.CompanyID === stakeholder.organizationId);
    return {
      name: company?.Title ?? "Unknown organization",
      type: "other",
    };
  }

  const company = companies.find((entry) => entry.CompanyID === org.companyId);
  return {
    name: company?.Title ?? org.companyId,
    type: org.organizationType,
  };
}

/**
 * Company ↔ project membership rule (Reality First):
 * A company appears on Company 360 → Projects only when it is listed in
 * `project.relatedOrganizations` with a matching `companyId` (or legacy
 * `linkedCompanyId` when `relatedOrganizations` is unset and migrated).
 *
 * Do NOT treat as membership:
 * - stakeholder rows that reuse a company name/string
 * - contacts whose registry company happens to match
 * - deal ClientName / project name similarity
 */
export function isCompanyExplicitlyLinkedToProject(
  companyId: string,
  project: Project,
): boolean {
  if (!companyId.trim()) return false;
  return getProjectRelatedOrganizations(project).some(
    (org) => org.companyId === companyId,
  );
}

/**
 * Strip a company from a project's explicit organization links.
 * Also reassigns stakeholders that pointed at removed org rows to unassigned
 * so Company 360 cannot inherit a false organization label.
 */
export function detachCompanyFromProject(
  project: Project,
  companyId: string,
): { project: Project; changed: boolean } {
  if (!companyId.trim()) return { project, changed: false };

  const organizations = getProjectRelatedOrganizations(project);
  const removedOrgIds = new Set(
    organizations.filter((org) => org.companyId === companyId).map((org) => org.id),
  );
  const nextOrganizations = organizations.filter((org) => org.companyId !== companyId);
  const linkedCleared = project.linkedCompanyId === companyId;

  const stakeholders = getProjectStakeholders(project);
  let stakeholdersChanged = false;
  const nextStakeholders = stakeholders.map((entry) => {
    if (!removedOrgIds.has(entry.organizationId)) return entry;
    stakeholdersChanged = true;
    return { ...entry, organizationId: UNASSIGNED_ORGANIZATION_ID };
  });

  const changed =
    removedOrgIds.size > 0 ||
    linkedCleared ||
    stakeholdersChanged ||
    nextOrganizations.length !== organizations.length;

  if (!changed) return { project, changed: false };

  const primary =
    nextOrganizations.find((org) => org.isPrimary) ?? nextOrganizations[0];

  return {
    changed: true,
    project: {
      ...project,
      relatedOrganizations: nextOrganizations,
      projectStakeholders: nextStakeholders,
      linkedCompanyId: primary?.companyId,
    },
  };
}

export function buildStakeholderRoleOptions(customRoles: string[]): string[] {
  const roles = new Set<string>(DEFAULT_PROJECT_STAKEHOLDER_ROLES);
  for (const role of customRoles) {
    if (role.trim()) roles.add(role.trim());
  }
  return Array.from(roles).sort((a, b) => a.localeCompare(b));
}

export function upsertProjectManagerStakeholder(
  stakeholders: ProjectStakeholderRecord[],
  owner: { Id: number; Title: string },
  options?: { force?: boolean; removedStakeholders?: ProjectRemovedStakeholderRecord[] },
): ProjectStakeholderRecord[] {
  const removed = options?.removedStakeholders ?? [];
  const candidate = {
    id: "pm-candidate",
    role: "Project Manager",
    name: owner.Title,
    userId: owner.Id,
    organizationId: INTERNAL_ORGANIZATION_ID,
  };

  if (
    !options?.force &&
    isRemovedStakeholder(candidate, removed)
  ) {
    return stakeholders;
  }

  const withoutManager = stakeholders.filter(
    (entry) => entry.role.toLowerCase() !== "project manager",
  );
  const existing = stakeholders.find((entry) => entry.role.toLowerCase() === "project manager");

  return [
    {
      id: existing?.id ?? createStakeholderId(),
      role: "Project Manager",
      name: owner.Title,
      userId: owner.Id,
      organizationId: INTERNAL_ORGANIZATION_ID,
      responsibilities: existing?.responsibilities,
    },
    ...withoutManager,
  ];
}

export function getCompanyIdsForProject(project: Project): string[] {
  return getProjectRelatedOrganizations(project).map((org) => org.companyId);
}

export { DEFAULT_PROJECT_STAKEHOLDER_ROLES, INTERNAL_ORGANIZATION_ID, UNASSIGNED_ORGANIZATION_ID };
