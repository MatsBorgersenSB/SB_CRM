"use client";

import type { Project } from "@/types/project";
import type { Company } from "@/types/company";
import {
  getProjectRelatedOrganizations,
  getProjectStakeholders,
  resolveStakeholderOrganizationName,
} from "@/lib/project-relationship-utils";
import { getCompanyProjectParticipants } from "@/lib/project-team-utils";
import { ProjectLink, ContactLink } from "@/components/relationship/relationship-links";
import { HealthStatusIcon, IconLabel } from "@/components/ui/smartcrm-icon";

export function CompanyProjectsTable({
  projects,
  companyId,
  companies = [],
}: {
  projects: Project[];
  companyId: string;
  companies?: Company[];
}) {
  if (projects.length === 0) {
    return (
      <p className="text-sm text-carbon-blue/45">
        No linked projects yet. Projects appear here only when this company is explicitly
        linked as a related organization on the project.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {projects.map((project) => {
        const organizations = getProjectRelatedOrganizations(project);
        const companyTeam = getCompanyProjectParticipants(companyId, [project]).map(
          (row) => row.member,
        );

        return (
          <section key={project.id} className="border border-carbon-blue/8 bg-carbon-blue/[0.02] p-4">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <ProjectLink projectId={project.id} className="text-[14px] font-semibold text-carbon-blue hover:text-upcycle-orange">
                {project.name}
              </ProjectLink>
              <span className="inline-flex items-center gap-1.5 text-[12px] text-carbon-blue/60">
                <HealthStatusIcon status={project.health} size="xs" />
                {project.status}
              </span>
            </div>

            {companyTeam.length === 0 ? (
              <p className="text-[12px] text-carbon-blue/45">
                No roles from this company assigned on the project yet.
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
                    <tr key={member.id} className="border-b border-carbon-blue/5 last:border-b-0">
                      <td className="px-2 py-2.5">
                        {member.contactId ? (
                          <ContactLink contactId={member.contactId} companyId={companyId}>
                            {member.name}
                          </ContactLink>
                        ) : (
                          <span className="font-medium text-carbon-blue">{member.name}</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-carbon-blue/70">
                        {resolveStakeholderOrganizationName(member, organizations, companies).name}
                      </td>
                      <td className="px-2 py-2.5 text-carbon-blue/70">{member.role}</td>
                      <td className="px-2 py-2.5 text-carbon-blue/55">{member.influence ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
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
