"use client";

import Link from "next/link";
import type { Project } from "@/types/project";
import { PROJECT_KIND_LABELS, PROJECT_STAGE_LABELS } from "@/types/project";
import { project360Href } from "@/types/relationship-navigation";
import { HealthStatusIcon } from "@/components/ui/smartcrm-icon";
import {
  WorkspaceTable,
  WorkspaceTableBody,
  WorkspaceTableBodyCell,
  WorkspaceTableBodyRow,
  WorkspaceTableHead,
  WorkspaceTableHeadCell,
  WorkspaceTableHeadRow,
} from "@/components/ui/workspace-table";

/**
 * Four columns: which project (and what kind), where it is, how it is
 * doing, who owns it. Priority and strategic importance only appear when
 * they say something — High or Critical — as a second line under health.
 */
export function ProjectsDirectory({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return (
      <p className="border border-carbon-blue/10 bg-white p-6 text-sm text-carbon-blue/65">
        No projects yet. Start one with the button above.
      </p>
    );
  }

  return (
    <div className="w-full border border-carbon-blue/10 bg-white">
      <WorkspaceTable>
        <colgroup>
          <col className="w-[40%]" />
          <col className="w-[20%]" />
          <col className="w-[22%]" />
          <col className="w-[18%]" />
        </colgroup>
        <WorkspaceTableHead>
          <WorkspaceTableHeadRow>
            <WorkspaceTableHeadCell>Project</WorkspaceTableHeadCell>
            <WorkspaceTableHeadCell>Stage</WorkspaceTableHeadCell>
            <WorkspaceTableHeadCell>Health</WorkspaceTableHeadCell>
            <WorkspaceTableHeadCell>Owner</WorkspaceTableHeadCell>
          </WorkspaceTableHeadRow>
        </WorkspaceTableHead>
        <WorkspaceTableBody>
          {projects.map((project) => {
            const emphasis = [
              project.priority === "Critical" || project.priority === "High"
                ? `${project.priority} priority`
                : null,
              project.strategicImportance === "Critical" || project.strategicImportance === "High"
                ? "Strategic"
                : null,
            ].filter(Boolean);
            const stage = project.stage ? PROJECT_STAGE_LABELS[project.stage] : project.status;
            return (
              <WorkspaceTableBodyRow key={project.id}>
                <WorkspaceTableBodyCell>
                  <Link
                    href={project360Href(project.id)}
                    className="block text-[14px] font-semibold text-carbon-blue hover:text-upcycle-orange"
                  >
                    {project.name}
                  </Link>
                  <p className="mt-0.5 text-[13px] text-carbon-blue/65">
                    {PROJECT_KIND_LABELS[project.kind]}
                  </p>
                </WorkspaceTableBodyCell>
                <WorkspaceTableBodyCell>
                  <p className="text-carbon-blue">{stage}</p>
                  {project.stage && project.status !== "Active" ? (
                    <p className="mt-0.5 text-[13px] text-carbon-blue/65">{project.status}</p>
                  ) : null}
                </WorkspaceTableBodyCell>
                <WorkspaceTableBodyCell>
                  <span className="inline-flex items-center gap-1.5 text-carbon-blue">
                    <HealthStatusIcon status={project.health} size="sm" />
                    {project.health}
                  </span>
                  {emphasis.length > 0 ? (
                    <p className="mt-0.5 text-[13px] text-carbon-blue/65">{emphasis.join(" · ")}</p>
                  ) : null}
                </WorkspaceTableBodyCell>
                <WorkspaceTableBodyCell className="text-carbon-blue">{project.owner}</WorkspaceTableBodyCell>
              </WorkspaceTableBodyRow>
            );
          })}
        </WorkspaceTableBody>
      </WorkspaceTable>
    </div>
  );
}
