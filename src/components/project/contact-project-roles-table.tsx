"use client";

import { useMemo, useState } from "react";
import type { Contact } from "@/types/contact";
import { getContactDisplayName } from "@/types/contact";
import type { Company } from "@/types/company";
import type { Project } from "@/types/project";
import type { StakeholderInfluence } from "@/types/project";
import type { UserRole } from "@/types/auth";
import type { ContactProjectRole } from "@/lib/project-team-utils";
import {
  buildStakeholderRoleOptions,
  createStakeholderId,
  getProjectRelatedOrganizations,
  getProjectStakeholders,
} from "@/lib/project-relationship-utils";
import { findCompanyByProjectRef } from "@/lib/project-stakeholder-contacts";
import { syncProjectStakeholders } from "@/lib/sync-project";
import { canManageProjectStakeholders } from "@/lib/permissions";
import { ProjectLink } from "@/components/relationship/relationship-links";
import { HealthStatusIcon, IconLabel } from "@/components/ui/smartcrm-icon";
import { project360Href } from "@/types/relationship-navigation";

const INFLUENCE_OPTIONS: StakeholderInfluence[] = ["High", "Medium", "Low"];
const DEFAULT_ROLE = "Decision Maker";

type ContactProjectRolesTableProps = {
  roles: ContactProjectRole[];
  contact: Contact;
  company: Company;
  companies: Company[];
  projects: Project[];
  role: UserRole;
  onProjectUpdated?: (project: Project) => void;
};

/**
 * Contact 360 — list project roles and add this contact to an existing project
 * without navigating away.
 */
export function ContactProjectRolesTable({
  roles,
  contact,
  company,
  companies,
  projects,
  role,
  onProjectUpdated,
}: ContactProjectRolesTableProps) {
  const canManage = canManageProjectStakeholders(role);
  const [assignOpen, setAssignOpen] = useState(false);
  const [projectQuery, setProjectQuery] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [stakeholderRole, setStakeholderRole] = useState(DEFAULT_ROLE);
  const [influence, setInfluence] = useState<StakeholderInfluence>("Medium");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const assignedProjectIds = useMemo(
    () => new Set(roles.map((entry) => entry.projectId)),
    [roles],
  );

  const availableProjects = useMemo(() => {
    return projects
      .filter((project) => !assignedProjectIds.has(project.id))
      .filter((project) => project.status !== "Completed" && project.status !== "On Hold")
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [projects, assignedProjectIds]);

  const filteredProjects = useMemo(() => {
    const q = projectQuery.trim().toLowerCase();
    if (!q) return availableProjects.slice(0, 40);
    return availableProjects
      .filter((project) => {
        const primaryCompanyId =
          getProjectRelatedOrganizations(project).find((org) => org.isPrimary)?.companyId ??
          project.linkedCompanyId;
        const account = findCompanyByProjectRef(companies, primaryCompanyId)?.Title ?? "";
        return (
          project.name.toLowerCase().includes(q) ||
          project.id.toLowerCase().includes(q) ||
          account.toLowerCase().includes(q)
        );
      })
      .slice(0, 40);
  }, [availableProjects, projectQuery, companies]);

  const selectedProject = availableProjects.find((project) => project.id === selectedProjectId);

  const roleOptions = useMemo(
    () => buildStakeholderRoleOptions([stakeholderRole]),
    [stakeholderRole],
  );

  const resolveOrganizationId = (project: Project) => {
    const orgs = getProjectRelatedOrganizations(project);
    const matchedOrg = orgs.find((org) => {
      const matched = findCompanyByProjectRef(companies, org.companyId);
      return matched?.CompanyID === company.CompanyID || org.companyId === company.CompanyID;
    });
    // Persist company id when the project has no matching related org yet.
    return matchedOrg?.id ?? company.CompanyID;
  };

  const handleAdd = async () => {
    setError(null);
    if (!selectedProject) {
      setError("Select a project.");
      return;
    }
    if (!stakeholderRole.trim()) {
      setError("Select a role.");
      return;
    }

    const nextStakeholders = [
      ...getProjectStakeholders(selectedProject),
      {
        id: createStakeholderId(),
        role: stakeholderRole.trim(),
        name: getContactDisplayName(contact),
        contactId: contact.ContactID,
        organizationId: resolveOrganizationId(selectedProject),
        influence,
      },
    ];

    // Re-adding after a prior remove must clear the tombstone or the contact stays hidden.
    const removedStakeholders = (selectedProject.removedStakeholders ?? []).filter(
      (entry) => entry.contactId !== contact.ContactID,
    );

    setBusy(true);
    try {
      const updated = await syncProjectStakeholders(
        selectedProject.id,
        nextStakeholders,
        role,
        removedStakeholders,
      );
      onProjectUpdated?.(updated);
      setAssignOpen(false);
      setSelectedProjectId("");
      setProjectQuery("");
      setStakeholderRole(DEFAULT_ROLE);
      setInfluence("Medium");
      setPickerOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add to project.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {roles.length === 0 ? (
        <p className="text-sm text-carbon-blue/45">
          No project roles yet. Add {getContactDisplayName(contact)} to a project from here.
        </p>
      ) : (
        <table className="w-full table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-[28%]" />
            <col className="w-[22%]" />
            <col className="w-[22%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-carbon-blue/8 bg-carbon-blue/[0.03]">
              <th className="px-3 py-2 text-left">
                <IconLabel
                  icon="project"
                  iconSize="xs"
                  className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45"
                >
                  Project
                </IconLabel>
              </th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
                Role
              </th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
                Project role
              </th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
                Influence
              </th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {roles.map((entry) => (
              <tr
                key={`${entry.projectId}-${entry.category}-${entry.projectRole}`}
                className="border-b border-carbon-blue/6 last:border-b-0 hover:bg-carbon-blue/[0.02]"
              >
                <td className="px-3 py-2.5">
                  <ProjectLink projectId={entry.projectId} className="group block truncate">
                    <span className="text-[13px] font-semibold text-carbon-blue group-hover:text-upcycle-orange">
                      {entry.projectName}
                    </span>
                  </ProjectLink>
                </td>
                <td className="truncate px-3 py-2.5 text-[12px] text-carbon-blue/70">
                  {entry.categoryLabel}
                </td>
                <td className="truncate px-3 py-2.5 text-[12px] text-carbon-blue/70">
                  {entry.projectRole}
                </td>
                <td className="px-3 py-2.5 text-[12px] text-carbon-blue/55">
                  {entry.influence ?? "—"}
                </td>
                <td className="px-3 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-carbon-blue/70">
                    <HealthStatusIcon status={entry.projectHealth} size="xs" />
                    {entry.projectStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canManage ? (
        assignOpen ? (
          <div className="border border-carbon-blue/10 bg-carbon-blue/[0.02] p-3">
            <p className="text-[11px] font-semibold text-carbon-blue">
              Add to existing project
            </p>
            <p className="mt-0.5 text-[10px] text-carbon-blue/50">
              Search a project — no need to open it first.
            </p>

            <label className="relative mt-3 block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                Project
              </span>
              <input
                type="search"
                value={
                  selectedProject && !pickerOpen
                    ? selectedProject.name
                    : projectQuery
                }
                disabled={busy}
                placeholder="Search projects… e.g. Escalante"
                autoComplete="off"
                onFocus={() => {
                  setPickerOpen(true);
                  if (selectedProject) setProjectQuery(selectedProject.name);
                }}
                onChange={(event) => {
                  setProjectQuery(event.target.value);
                  setSelectedProjectId("");
                  setPickerOpen(true);
                }}
                className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue outline-none focus:border-upcycle-orange"
              />
              {pickerOpen ? (
                <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto border border-carbon-blue/15 bg-white shadow-md">
                  {filteredProjects.length === 0 ? (
                    <li className="px-3 py-2 text-[11px] text-carbon-blue/50">
                      {availableProjects.length === 0
                        ? "Already on all active projects, or no projects exist."
                        : "No projects match your search."}
                    </li>
                  ) : (
                    filteredProjects.map((project) => (
                      <li key={project.id}>
                        <button
                          type="button"
                          className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-upcycle-orange/10"
                          onClick={() => {
                            setSelectedProjectId(project.id);
                            setProjectQuery(project.name);
                            setPickerOpen(false);
                          }}
                        >
                          <span className="text-[12px] font-medium text-carbon-blue">
                            {project.name}
                          </span>
                          <span className="text-[10px] text-carbon-blue/45">
                            {project.id} · {project.status}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
            </label>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                  Role on project
                </span>
                <select
                  value={stakeholderRole}
                  disabled={busy}
                  onChange={(event) => setStakeholderRole(event.target.value)}
                  className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px]"
                >
                  {roleOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                  Influence
                </span>
                <select
                  value={influence}
                  disabled={busy}
                  onChange={(event) =>
                    setInfluence(event.target.value as StakeholderInfluence)
                  }
                  className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px]"
                >
                  {INFLUENCE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error ? (
              <p className="mt-2 text-[11px] text-thermal-red">{error}</p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !selectedProjectId}
                onClick={() => void handleAdd()}
                className="border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Adding…" : "Add to project"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setAssignOpen(false);
                  setError(null);
                  setPickerOpen(false);
                }}
                className="border border-carbon-blue/15 bg-white px-3 py-1.5 text-[11px] font-semibold text-carbon-blue/60"
              >
                Cancel
              </button>
              {selectedProject ? (
                <a
                  href={project360Href(selectedProject.id)}
                  className="px-2 py-1.5 text-[11px] font-semibold text-carbon-blue/45 hover:text-upcycle-orange"
                >
                  Open project
                </a>
              ) : null}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAssignOpen(true)}
            className="border border-carbon-blue/15 bg-white px-3 py-1.5 text-[11px] font-semibold text-carbon-blue hover:border-upcycle-orange hover:text-upcycle-orange"
          >
            + Add to project
          </button>
        )
      ) : null}
    </div>
  );
}
