"use client";

import { useMemo, useState } from "react";
import type { Project } from "@/types/project";
import type { Company } from "@/types/company";
import type { UserRole } from "@/types/auth";
import {
  ensureCompanyLinkedToProject,
  getProjectRelatedOrganizations,
  getProjectStakeholders,
} from "@/lib/project-relationship-utils";
import { getCompanyProjectParticipants } from "@/lib/project-team-utils";
import { syncProjectRecord } from "@/lib/sync-project";
import { canManageProjectStakeholders } from "@/lib/permissions";
import { getCompanyRelationshipPosture } from "@/lib/company-classification";
import type { ProjectOrganizationType } from "@/types/project-relationships";
import { ProjectLink, ContactLink } from "@/components/relationship/relationship-links";
import { HealthStatusIcon, IconLabel } from "@/components/ui/smartcrm-icon";
import {
  resolveStakeholderOrganizationName,
} from "@/lib/project-relationship-utils";

function organizationTypeForCompany(company: Company): ProjectOrganizationType {
  const posture = getCompanyRelationshipPosture(company);
  if (posture === "sell_to") return "customer";
  if (posture === "buy_from") return "supplier";
  if (posture === "collaborate") return "partner";
  if (posture === "fund") return "investor";
  if (posture === "internal") return "internal";
  // watch / unclassified — never invent customer
  return "other";
}

export function CompanyProjectsTable({
  projects,
  companyId,
  company,
  allProjects = [],
  companies = [],
  role,
  onProjectUpdated,
}: {
  projects: Project[];
  companyId: string;
  company?: Company;
  allProjects?: Project[];
  companies?: Company[];
  role?: UserRole;
  onProjectUpdated?: (project: Project) => void;
}) {
  const contactIds = useMemo(
    () => (company?.contacts ?? []).map((contact) => contact.ContactID),
    [company?.contacts],
  );
  const canManage = role ? canManageProjectStakeholders(role) : false;
  const [linkOpen, setLinkOpen] = useState(false);
  const [projectQuery, setProjectQuery] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const linkedIds = useMemo(
    () => new Set(projects.map((project) => project.id)),
    [projects],
  );

  const availableProjects = useMemo(() => {
    return allProjects
      .filter((project) => !linkedIds.has(project.id))
      .filter((project) => project.status !== "Completed")
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allProjects, linkedIds]);

  const filteredProjects = useMemo(() => {
    const q = projectQuery.trim().toLowerCase();
    if (!q) return availableProjects.slice(0, 40);
    return availableProjects
      .filter(
        (project) =>
          project.name.toLowerCase().includes(q) ||
          project.id.toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [availableProjects, projectQuery]);

  const selectedProject = availableProjects.find(
    (project) => project.id === selectedProjectId,
  );

  const handleLink = async () => {
    setError(null);
    if (!company || !selectedProject) {
      setError("Select a project.");
      return;
    }

    const ensured = ensureCompanyLinkedToProject(
      selectedProject,
      company.CompanyID,
      {
        organizationType: organizationTypeForCompany(company),
        label: company.Title,
      },
    );

    setBusy(true);
    try {
      const updated = await syncProjectRecord(
        selectedProject.id,
        {
          relatedOrganizations: ensured.project.relatedOrganizations,
          linkedCompanyId: ensured.project.linkedCompanyId,
        },
        role ?? "admin",
      );
      onProjectUpdated?.(updated);
      setLinkOpen(false);
      setSelectedProjectId("");
      setProjectQuery("");
      setPickerOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not link project.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {projects.length === 0 ? (
        <p className="text-sm text-carbon-blue/45">
          No linked projects yet. Link this company to a project, or add one of its
          contacts to a project — the company follows automatically.
        </p>
      ) : (
        projects.map((project) => {
          const organizations = getProjectRelatedOrganizations(project);
          const companyTeam = getCompanyProjectParticipants(
            companyId,
            [project],
            { contactIds },
          ).map((row) => row.member);

          return (
            <section
              key={project.id}
              className="border border-carbon-blue/8 bg-carbon-blue/[0.02] p-4"
            >
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <ProjectLink
                  projectId={project.id}
                  className="text-[14px] font-semibold text-carbon-blue hover:text-upcycle-orange"
                >
                  {project.name}
                </ProjectLink>
                <span className="inline-flex items-center gap-1.5 text-[12px] text-carbon-blue/60">
                  <HealthStatusIcon status={project.health} size="xs" />
                  {project.status}
                </span>
              </div>

              {companyTeam.length === 0 ? (
                <p className="text-[12px] text-carbon-blue/45">
                  Company is linked. No people from this company are assigned on the
                  project yet.
                </p>
              ) : (
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-carbon-blue/10 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                      <th className="px-2 py-2 font-semibold">Contact</th>
                      <th className="px-2 py-2 font-semibold">Organization</th>
                      <th className="px-2 py-2 font-semibold">Project role</th>
                      <th className="px-2 py-2 font-semibold">Influence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companyTeam.map((member) => (
                      <tr
                        key={member.id}
                        className="border-b border-carbon-blue/5 last:border-b-0"
                      >
                        <td className="px-2 py-2.5">
                          {member.contactId ? (
                            <ContactLink
                              contactId={member.contactId}
                              companyId={companyId}
                            >
                              {member.name}
                            </ContactLink>
                          ) : (
                            <span className="font-medium text-carbon-blue">
                              {member.name}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-carbon-blue/70">
                          {
                            resolveStakeholderOrganizationName(
                              member,
                              organizations,
                              companies,
                            ).name
                          }
                        </td>
                        <td className="px-2 py-2.5 text-carbon-blue/70">
                          {member.role}
                        </td>
                        <td className="px-2 py-2.5 text-carbon-blue/55">
                          {member.influence ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          );
        })
      )}

      {canManage && company ? (
        <div className="border border-dashed border-carbon-blue/15 bg-white p-3">
          {!linkOpen ? (
            <button
              type="button"
              onClick={() => setLinkOpen(true)}
              className="text-[12px] font-semibold text-upcycle-orange hover:underline"
            >
              + Link to existing project
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/45">
                Link {company.Title} to a project
              </p>
              <div className="relative">
                <input
                  value={
                    pickerOpen || !selectedProject
                      ? projectQuery
                      : selectedProject.name
                  }
                  onChange={(event) => {
                    setProjectQuery(event.target.value);
                    setSelectedProjectId("");
                    setPickerOpen(true);
                  }}
                  onFocus={() => setPickerOpen(true)}
                  placeholder="Search projects…"
                  className="w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue"
                />
                {pickerOpen ? (
                  <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto border border-carbon-blue/15 bg-white shadow-sm">
                    {filteredProjects.length === 0 ? (
                      <p className="px-3 py-2 text-[12px] text-carbon-blue/45">
                        No matching projects.
                      </p>
                    ) : (
                      filteredProjects.map((project) => (
                        <button
                          key={project.id}
                          type="button"
                          className="block w-full px-3 py-2 text-left text-[12px] text-carbon-blue hover:bg-upcycle-orange/10"
                          onClick={() => {
                            setSelectedProjectId(project.id);
                            setProjectQuery(project.name);
                            setPickerOpen(false);
                          }}
                        >
                          {project.name}
                          <span className="ml-2 text-carbon-blue/40">{project.id}</span>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
              {error ? (
                <p className="text-[12px] text-red-600">{error}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !selectedProject}
                  onClick={() => void handleLink()}
                  className="border border-upcycle-orange/30 bg-upcycle-orange/10 px-3 py-1.5 text-[11px] font-semibold text-upcycle-orange disabled:opacity-50"
                >
                  {busy ? "Linking…" : "Link project"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setLinkOpen(false);
                    setError(null);
                    setSelectedProjectId("");
                    setProjectQuery("");
                  }}
                  className="border border-carbon-blue/15 px-3 py-1.5 text-[11px] font-semibold text-carbon-blue/70"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function CompanyProjectsOverviewTable({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return <p className="text-sm text-carbon-blue/45">No linked projects.</p>;
  }

  return (
    <table className="w-full table-fixed border-collapse text-left">
      <colgroup>
        <col className="w-[34%]" />
        <col className="w-[18%]" />
        <col className="w-[18%]" />
        <col className="w-[15%]" />
        <col className="w-[15%]" />
      </colgroup>
      <thead>
        <tr className="border-b border-carbon-blue/8 bg-carbon-blue/[0.03]">
          <th className="px-3 py-2 text-left">
            <IconLabel icon="project" iconSize="xs" className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
              Project
            </IconLabel>
          </th>
          <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
            Status
          </th>
          <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
            Priority
          </th>
          <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
            Health
          </th>
          <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
            Team
          </th>
        </tr>
      </thead>
      <tbody>
        {projects.map((project) => (
          <tr key={project.id} className="border-b border-carbon-blue/6 last:border-b-0 hover:bg-carbon-blue/[0.02]">
            <td className="px-3 py-2.5">
              <ProjectLink projectId={project.id} className="group block truncate">
                <span className="text-[13px] font-semibold text-carbon-blue group-hover:text-upcycle-orange">
                  {project.name}
                </span>
              </ProjectLink>
            </td>
            <td className="px-3 py-2.5 text-[12px] text-carbon-blue/70">{project.status}</td>
            <td className="px-3 py-2.5 text-[12px] text-carbon-blue/70">{project.priority}</td>
            <td className="px-3 py-2.5">
              <span className="inline-flex items-center gap-1.5 text-[12px] text-carbon-blue/70">
                <HealthStatusIcon status={project.health} size="xs" />
                {project.health}
              </span>
            </td>
            <td className="px-3 py-2.5 text-[12px] text-carbon-blue/55">
              {getProjectStakeholders(project).length}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
