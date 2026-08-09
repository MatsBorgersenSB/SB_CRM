"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RoleSwitcher } from "@/components/auth/role-switcher";
import { Project360LivingWorkspace } from "@/components/project/project-360-living-workspace";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { WorkspaceMain } from "@/components/ui/workspace-main";
import { useAuth } from "@/context/auth-context";
import {
  canAssignProjectOwner,
  canManageProjectStakeholders,
} from "@/lib/permissions";
import {
  getProjectStakeholders,
  upsertProjectManagerStakeholder,
} from "@/lib/project-relationship-utils";
import {
  buildRemovedStakeholderRecord,
  clearRemovedStakeholderForOwner,
  mergeRemovedStakeholders,
} from "@/lib/project-stakeholder-contacts";
import { mergeStandardBioUserOptions } from "@/lib/standard-bio-users";
import {
  syncProjectOrganizations,
  syncProjectOwner,
  syncProjectStakeholders,
} from "@/lib/sync-project";
import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company, SharePointPerson } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { Project } from "@/types/project";
import type {
  ProjectRelatedOrganization,
  ProjectStakeholderRecord,
} from "@/types/project-relationships";
import type { StandardBioUserRecord } from "@/types/user-access";

export function Project360PageShell({
  projectId,
  project,
  companies,
  pipelines,
  activities,
  commercialPackages,
  standardBioUsers,
}: {
  projectId: string;
  project: Project | null;
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  commercialPackages: CommercialPackage[];
  standardBioUsers: StandardBioUserRecord[];
}) {
  const { user } = useAuth();
  const [currentProject, setCurrentProject] = useState(project);

  useEffect(() => {
    setCurrentProject(project);
  }, [project]);

  const resolvedProject = useMemo(() => currentProject ?? null, [currentProject]);

  const standardBioUserOptions = useMemo(() => {
    const extras: SharePointPerson[] = resolvedProject
      ? getProjectStakeholders(resolvedProject)
          .filter((member) => member.userId !== undefined)
          .map((member) => ({ Id: member.userId!, Title: member.name }))
      : [];
    return mergeStandardBioUserOptions(standardBioUsers, extras);
  }, [standardBioUsers, resolvedProject]);

  const persistStakeholders = useCallback(
    async (projectStakeholders: ProjectStakeholderRecord[]) => {
      if (!resolvedProject) {
        throw new Error("Project is not available.");
      }
      if (!canManageProjectStakeholders(user.role)) {
        throw new Error("You do not have permission to update stakeholders.");
      }

      const previous = getProjectStakeholders(resolvedProject);
      const nextIds = new Set(projectStakeholders.map((entry) => entry.id));
      const removedEntries = previous
        .filter((entry) => !nextIds.has(entry.id))
        .map((entry) => buildRemovedStakeholderRecord(entry));
      const removedStakeholders = mergeRemovedStakeholders(
        resolvedProject.removedStakeholders,
        removedEntries,
      );

      const updated = await syncProjectStakeholders(
        resolvedProject.id,
        projectStakeholders,
        user.role,
        removedStakeholders,
      );
      setCurrentProject(updated);
    },
    [resolvedProject, user.role],
  );

  const persistOrganizations = useCallback(
    async (relatedOrganizations: ProjectRelatedOrganization[]) => {
      if (!resolvedProject || !canManageProjectStakeholders(user.role)) return;
      const updated = await syncProjectOrganizations(
        resolvedProject.id,
        relatedOrganizations,
        user.role,
      );
      setCurrentProject(updated);
    },
    [resolvedProject, user.role],
  );

  const handleOwnerChange = useCallback(
    async (owner: SharePointPerson) => {
      if (!resolvedProject || !canAssignProjectOwner(user.role)) return;
      const projectStakeholders = upsertProjectManagerStakeholder(
        getProjectStakeholders(resolvedProject),
        owner,
        { force: true, removedStakeholders: resolvedProject.removedStakeholders },
      );
      const removedStakeholders = clearRemovedStakeholderForOwner(
        resolvedProject.removedStakeholders,
        owner,
      );
      const updated = await syncProjectOwner(
        resolvedProject.id,
        owner.Title,
        projectStakeholders,
        user.role,
        removedStakeholders,
      );
      setCurrentProject(updated);
    },
    [resolvedProject, user.role],
  );

  if (!resolvedProject) {
    notFound();
  }

  return (
    <WorkspaceChrome>
      <header className="sticky top-0 z-10 flex h-11 shrink-0 items-center justify-between border-b border-carbon-blue/8 bg-[var(--dashboard-surface)]/95 px-4 backdrop-blur-sm">
        <div className="min-w-0 truncate text-[11px] text-carbon-blue/50">
          <Link
            href="/projects"
            className="font-medium text-carbon-blue/45 transition-colors hover:text-upcycle-orange"
          >
            Projects
          </Link>
        </div>
        <RoleSwitcher companies={companies} />
      </header>

      <WorkspaceMain>
        <Project360LivingWorkspace
          project={resolvedProject}
          companies={companies}
          pipelines={pipelines}
          activities={activities}
          attentionItems={[]}
          role={user.role}
          onOwnerChange={handleOwnerChange}
          onStakeholdersChange={persistStakeholders}
          onOrganizationsChange={persistOrganizations}
          standardBioUsers={standardBioUserOptions}
          relationshipsReadOnly={!canManageProjectStakeholders(user.role)}
        />
      </WorkspaceMain>
    </WorkspaceChrome>
  );
}
