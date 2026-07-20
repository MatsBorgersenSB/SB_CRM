"use client";

import type { ContactProjectRole } from "@/lib/project-team-utils";
import { ProjectLink } from "@/components/relationship/relationship-links";
import { HealthStatusIcon, IconLabel } from "@/components/ui/smartcrm-icon";

export function ContactProjectRolesTable({ roles }: { roles: ContactProjectRole[] }) {
  if (roles.length === 0) {
    return (
      <p className="text-sm text-carbon-blue/45">
        No project roles yet. Add this contact to a project stakeholder roster to track involvement.
      </p>
    );
  }

  return (
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
            <IconLabel icon="project" iconSize="xs" className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
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
        {roles.map((role) => (
          <tr key={`${role.projectId}-${role.category}-${role.projectRole}`} className="border-b border-carbon-blue/6 last:border-b-0 hover:bg-carbon-blue/[0.02]">
            <td className="px-3 py-2.5">
              <ProjectLink projectId={role.projectId} className="group block truncate">
                <span className="text-[13px] font-semibold text-carbon-blue group-hover:text-upcycle-orange">
                  {role.projectName}
                </span>
              </ProjectLink>
            </td>
            <td className="truncate px-3 py-2.5 text-[12px] text-carbon-blue/70">{role.categoryLabel}</td>
            <td className="truncate px-3 py-2.5 text-[12px] text-carbon-blue/70">{role.projectRole}</td>
            <td className="px-3 py-2.5 text-[12px] text-carbon-blue/55">{role.influence ?? "—"}</td>
            <td className="px-3 py-2.5">
              <span className="inline-flex items-center gap-1.5 text-[12px] text-carbon-blue/70">
                <HealthStatusIcon status={role.projectHealth} size="xs" />
                {role.projectStatus}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
