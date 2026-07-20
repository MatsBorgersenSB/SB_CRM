import type { UserRole } from "@/types/auth";
import type { Project } from "@/types/project";
import type {
  ProjectRelatedOrganization,
  ProjectRemovedStakeholderRecord,
  ProjectStakeholderRecord,
} from "@/types/project-relationships";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";

export async function syncProjectRecord(
  projectId: string,
  patch: Partial<
    Pick<
      Project,
      | "owner"
      | "team"
      | "relatedOrganizations"
      | "projectStakeholders"
      | "removedStakeholders"
      | "linkedCompanyId"
    >
  >,
  role: UserRole = "superuser",
): Promise<Project> {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      [AUTH_ROLE_HEADER]: role,
    },
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to update project");
  }

  return (await response.json()) as Project;
}

export async function syncProjectStakeholders(
  projectId: string,
  projectStakeholders: ProjectStakeholderRecord[],
  role: UserRole = "superuser",
  removedStakeholders?: ProjectRemovedStakeholderRecord[],
): Promise<Project> {
  return syncProjectRecord(
    projectId,
    {
      projectStakeholders,
      ...(removedStakeholders !== undefined ? { removedStakeholders } : {}),
    },
    role,
  );
}

export async function syncProjectOrganizations(
  projectId: string,
  relatedOrganizations: ProjectRelatedOrganization[],
  role: UserRole = "superuser",
): Promise<Project> {
  const primary = relatedOrganizations.find((org) => org.isPrimary) ?? relatedOrganizations[0];
  return syncProjectRecord(
    projectId,
    {
      relatedOrganizations,
      linkedCompanyId: primary?.companyId,
    },
    role,
  );
}

export async function syncProjectOwner(
  projectId: string,
  owner: string,
  projectStakeholders: ProjectStakeholderRecord[],
  role: UserRole = "superuser",
  removedStakeholders?: ProjectRemovedStakeholderRecord[],
): Promise<Project> {
  return syncProjectRecord(
    projectId,
    {
      owner,
      projectStakeholders,
      ...(removedStakeholders !== undefined ? { removedStakeholders } : {}),
    },
    role,
  );
}

/** @deprecated Use syncProjectStakeholders */
export async function syncProjectTeam(
  projectId: string,
  team: Project["team"],
  role: UserRole = "superuser",
): Promise<Project> {
  return syncProjectRecord(projectId, { team }, role);
}

export async function syncProjectInternalMembers(
  projectId: string,
  projectStakeholders: ProjectStakeholderRecord[],
  role: UserRole = "superuser",
): Promise<Project> {
  return syncProjectStakeholders(projectId, projectStakeholders, role);
}
