import type { SharePointPerson } from "@/types/company";
import { STANDARD_BIO_USERS } from "@/types/bio-user";
import {
  getProjectRelatedOrganizations,
  getProjectStakeholders,
  isCompanyExplicitlyLinkedToProject,
} from "@/lib/project-relationship-utils";
import {
  INTERNAL_ORGANIZATION_ID,
  UNASSIGNED_ORGANIZATION_ID,
  type ProjectStakeholderRecord,
} from "@/types/project-relationships";
import type {
  Project,
  ProjectInternalMember,
  ProjectStakeholder,
  ProjectTeamCategory,
  ProjectTeamMember,
} from "@/types/project";
import {
  CUSTOMER_TEAM_CATEGORIES,
  INTERNAL_TEAM_CATEGORIES,
  PROJECT_TEAM_CATEGORY_LABELS,
  PROJECT_TEAM_CATEGORY_ORDER,
} from "@/types/project";

let teamMemberCounter = 0;

export function createTeamMemberId(): string {
  teamMemberCounter += 1;
  return `tm-${Date.now()}-${teamMemberCounter}`;
}

export function getProjectTeam(project: Project): ProjectTeamMember[] {
  if (project.team?.length) {
    return project.team;
  }
  return migrateLegacyProjectTeam(project);
}

export function migrateLegacyProjectTeam(project: Project): ProjectTeamMember[] {
  const members: ProjectTeamMember[] = [];
  let managerAssigned = false;

  for (const internal of project.internalMembers ?? []) {
    const isManager =
      !managerAssigned &&
      (internal.name === project.owner ||
        internal.role.toLowerCase().includes("owner") ||
        internal.role.toLowerCase().includes("manager"));

    members.push({
      id: createTeamMemberId(),
      category: isManager ? "project_manager" : "project_member",
      name: internal.name,
      userId: internal.userId,
      projectRole: internal.role,
    });

    if (isManager) {
      managerAssigned = true;
    }
  }

  if (!managerAssigned && project.owner?.trim()) {
    const canonical = STANDARD_BIO_USERS.find(
      (user) => user.Title.toLowerCase() === project.owner.toLowerCase(),
    );
    members.unshift({
      id: createTeamMemberId(),
      category: "project_manager",
      name: project.owner,
      userId: canonical?.Id,
      projectRole: "Project Manager",
    });
  }

  for (const stakeholder of project.stakeholders ?? []) {
    const roleLower = stakeholder.role.toLowerCase();
    let category: ProjectTeamCategory = "associated_contact";

    if (stakeholder.contactId && project.linkedCompanyId) {
      if (roleLower.includes("sponsor") || roleLower.includes("manager")) {
        category = roleLower.includes("customer") ? "customer_project_manager" : "customer_member";
      } else if (members.some((member) => member.category === "customer_project_manager")) {
        category = "customer_member";
      } else if (!members.some((member) => member.category === "customer_project_manager")) {
        category = "customer_project_manager";
      } else {
        category = "customer_member";
      }
    }

    members.push({
      id: createTeamMemberId(),
      category,
      name: stakeholder.name,
      contactId: stakeholder.contactId,
      companyId: project.linkedCompanyId,
      companyName: stakeholder.companyName,
      projectRole: stakeholder.role,
      influence: stakeholder.influence,
    });
  }

  return members;
}

export function normalizeProjectTeam(project: Project): Project {
  const team = getProjectTeam(project);
  const manager = team.find((member) => member.category === "project_manager");
  return {
    ...project,
    team,
    owner: manager?.name ?? project.owner,
    stakeholders: undefined,
    internalMembers: undefined,
  };
}

export function filterTeamByCategory(
  team: ProjectTeamMember[],
  category: ProjectTeamCategory,
): ProjectTeamMember[] {
  return team.filter((member) => member.category === category);
}

export function getTeamCategoryLabel(category: ProjectTeamCategory): string {
  return PROJECT_TEAM_CATEGORY_LABELS[category];
}

export function isInternalTeamCategory(category: ProjectTeamCategory): boolean {
  return INTERNAL_TEAM_CATEGORIES.includes(category);
}

export function isCustomerTeamCategory(category: ProjectTeamCategory): boolean {
  return CUSTOMER_TEAM_CATEGORIES.includes(category);
}

export { PROJECT_TEAM_CATEGORY_ORDER };

export function upsertProjectManager(
  team: ProjectTeamMember[],
  owner: SharePointPerson,
): ProjectTeamMember[] {
  const withoutManager = team.filter((member) => member.category !== "project_manager");
  const existing = team.find((member) => member.category === "project_manager");

  return [
    {
      id: existing?.id ?? createTeamMemberId(),
      category: "project_manager",
      name: owner.Title,
      userId: owner.Id,
      projectRole: existing?.projectRole ?? "Project Manager",
    },
    ...withoutManager,
  ];
}

export function resolveProjectManagerName(project: Project): string {
  const manager = getProjectStakeholders(project).find(
    (entry) => entry.role.toLowerCase() === "project manager",
  );
  if (manager) return manager.name;
  const teamManager = getProjectTeam(project).find((member) => member.category === "project_manager");
  return teamManager?.name ?? project.owner;
}

export type ContactProjectRole = {
  projectId: string;
  projectName: string;
  projectStatus: Project["status"];
  projectHealth: Project["health"];
  category: ProjectTeamCategory;
  categoryLabel: string;
  projectRole: string;
  influence?: ProjectTeamMember["influence"];
  companyId?: string;
  companyName?: string;
};

export function getContactProjectRoles(
  contactId: string,
  projects: Project[],
): ContactProjectRole[] {
  const roles: ContactProjectRole[] = [];

  for (const project of projects) {
    const organizations = getProjectRelatedOrganizations(project);
    for (const member of getProjectStakeholders(project)) {
      if (member.contactId !== contactId) continue;
      const org = organizations.find((entry) => entry.id === member.organizationId);
      roles.push({
        projectId: project.id,
        projectName: project.name,
        projectStatus: project.status,
        projectHealth: project.health,
        category: "associated_contact",
        categoryLabel: member.role,
        projectRole: member.role,
        influence: member.influence,
        companyId: org?.companyId ?? project.linkedCompanyId,
        companyName: undefined,
      });
    }
  }

  return roles.sort((a, b) => a.projectName.localeCompare(b.projectName));
}

/**
 * Company 360 → Projects membership.
 * Explicit relatedOrganizations link, or people from this company already on the roster.
 */
export function getProjectsForCompany(
  companyId: string,
  projects: Project[],
  options?: { contactIds?: Iterable<string> },
): Project[] {
  const contactIds = new Set(
    Array.from(options?.contactIds ?? []).map((id) => id.trim()).filter(Boolean),
  );

  return projects
    .filter((project) => {
      if (isCompanyExplicitlyLinkedToProject(companyId, project)) return true;

      for (const member of getProjectStakeholders(project)) {
        if (member.organizationId === companyId) return true;
        if (member.contactId && contactIds.has(member.contactId)) return true;
      }
      return false;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getCompanyProjectParticipants(
  companyId: string,
  projects: Project[],
  options?: { contactIds?: Iterable<string> },
): Array<{ project: Project; member: ProjectStakeholderRecord }> {
  const contactIds = new Set(
    Array.from(options?.contactIds ?? []).map((id) => id.trim()).filter(Boolean),
  );
  const rows: Array<{ project: Project; member: ProjectStakeholderRecord }> = [];

  for (const project of projects) {
    const organizations = getProjectRelatedOrganizations(project);
    const companyOnProject =
      isCompanyExplicitlyLinkedToProject(companyId, project) ||
      getProjectStakeholders(project).some(
        (member) =>
          member.organizationId === companyId ||
          Boolean(member.contactId && contactIds.has(member.contactId)),
      );
    if (!companyOnProject) continue;

    for (const member of getProjectStakeholders(project)) {
      if (
        member.organizationId === INTERNAL_ORGANIZATION_ID ||
        member.organizationId === UNASSIGNED_ORGANIZATION_ID
      ) {
        // Still include if this contact belongs to the company.
        if (!(member.contactId && contactIds.has(member.contactId))) continue;
      } else {
        const org = organizations.find((entry) => entry.id === member.organizationId);
        const matchesOrg =
          org?.companyId === companyId || member.organizationId === companyId;
        const matchesContact = Boolean(
          member.contactId && contactIds.has(member.contactId),
        );
        if (!matchesOrg && !matchesContact) continue;
      }
      rows.push({ project, member });
    }
  }

  return rows;
}

export function getContactProjectRoleSummary(
  contactId: string,
  projects: Project[],
): string | null {
  const roles = getContactProjectRoles(contactId, projects);
  if (roles.length === 0) return null;
  const primary = roles[0];
  if (roles.length === 1) {
    return `${primary.projectRole} · ${primary.projectName}`;
  }
  return `${primary.projectRole} · ${roles.length} projects`;
}

export function getContactProjectRolesOnCompany(
  contactId: string,
  companyId: string,
  projects: Project[],
): ContactProjectRole[] {
  return getContactProjectRoles(contactId, projects).filter(
    (role) => role.companyId === companyId || !role.companyId,
  );
}
