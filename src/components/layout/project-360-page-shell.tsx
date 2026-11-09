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
  canCreateCompany,
  canManageProjectStakeholders,
} from "@/lib/permissions";
import {
  companyTypeForProjectOrganizationType,
  getProjectStakeholders,
  upsertProjectManagerStakeholder,
} from "@/lib/project-relationship-utils";
import {
  buildRemovedStakeholderRecord,
  clearRemovedStakeholderForOwner,
  mergeRemovedStakeholders,
} from "@/lib/project-stakeholder-contacts";
import { mergeStandardBioUserOptions } from "@/lib/standard-bio-users";
import { createCompanyRecord } from "@/lib/sync-company";
import {
  syncProjectOrganizations,
  syncProjectOwner,
  syncProjectRecord,
  syncProjectStakeholders,
} from "@/lib/sync-project";
import type { OpportunityUnderstandingCapture } from "@/types/opportunity-understanding";
import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company, SharePointPerson } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { Project } from "@/types/project";
import type {
  ProjectOrganizationType,
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
  const [currentCompanies, setCurrentCompanies] = useState(companies);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync server-rendered project prop into local state
    setCurrentProject(project);
  }, [project]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync server-rendered companies prop into local state
    setCurrentCompanies(companies);
  }, [companies]);

  useEffect(() => {
    let active = true;
    const refreshCompanies = () => {
      fetch("/api/companies", { credentials: "include", cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((items: Company[] | null) => {
          if (!active || !Array.isArray(items) || items.length === 0) return;
          setCurrentCompanies((prev) => {
            const byId = new Map<string, Company>();
            for (const row of prev) byId.set(row.CompanyID, row);
            for (const row of items) byId.set(row.CompanyID, row);
            return Array.from(byId.values());
          });
        })
        .catch(() => undefined);
    };
    refreshCompanies();
    window.addEventListener("focus", refreshCompanies);
    return () => {
      active = false;
      window.removeEventListener("focus", refreshCompanies);
    };
  }, []);

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

  const handleCreateCompany = useCallback(
    async (
      title: string,
      organizationType: ProjectOrganizationType,
    ): Promise<Company | null> => {
      if (!canCreateCompany(user.role)) return null;
      const companyType = companyTypeForProjectOrganizationType(organizationType);
      const created = await createCompanyRecord(
        {
          Title: title.trim(),
          Industry: "",
          Status: "Active",
          City: "",
          Domain: "",
          Phone: "",
          CompanyTypes: [companyType],
        },
        user.role,
      );
      setCurrentCompanies((prev) => {
        if (prev.some((row) => row.CompanyID === created.CompanyID)) {
          return prev;
        }
        return [...prev, created];
      });
      return created;
    },
    [user.role],
  );

  const persistUnderstanding = useCallback(
    async (understanding: OpportunityUnderstandingCapture) => {
      if (!resolvedProject) return;
      const updated = await syncProjectRecord(
        resolvedProject.id,
        { understanding },
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
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("smartcrm:notifications-refresh"));
      }
    },
    [resolvedProject, user.role],
  );

  if (!resolvedProject) {
    notFound();
  }

  return (
    <WorkspaceChrome>
      <header className="sticky top-0 z-10 flex h-11 shrink-0 items-center justify-between border-b border-carbon-blue/8 bg-[var(--dashboard-surface)]/95 px-4 backdrop-blur-sm">
        <div className="min-w-0 truncate text-[12px] text-carbon-blue/50">
          <Link
            href="/projects"
            className="font-medium text-carbon-blue/65 transition-colors hover:text-upcycle-orange"
          >
            Projects
          </Link>
        </div>
        <RoleSwitcher companies={currentCompanies} />
      </header>

      <WorkspaceMain>
        <Project360LivingWorkspace
          project={resolvedProject}
          companies={currentCompanies}
          pipelines={pipelines}
          activities={activities}
          attentionItems={[]}
          role={user.role}
          onOwnerChange={handleOwnerChange}
          onStakeholdersChange={persistStakeholders}
          onOrganizationsChange={persistOrganizations}
          onCreateCompany={canCreateCompany(user.role) ? handleCreateCompany : undefined}
          onUnderstandingChange={persistUnderstanding}
          standardBioUsers={standardBioUserOptions}
          relationshipsReadOnly={!canManageProjectStakeholders(user.role)}
        />
      </WorkspaceMain>
    </WorkspaceChrome>
  );
}
