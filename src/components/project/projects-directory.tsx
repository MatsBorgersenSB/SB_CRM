"use client";

import Link from "next/link";
import type { Project } from "@/types/project";
import { PROJECT_KIND_LABELS } from "@/types/project";
import { project360Href } from "@/types/relationship-navigation";
import { HealthStatusIcon, SmartCRMIcon } from "@/components/ui/smartcrm-icon";

function formatKind(kind: Project["kind"]): string {
  return PROJECT_KIND_LABELS[kind];
}

export function ProjectsDirectory({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return (
      <p className="border border-carbon-blue/10 bg-white p-6 text-sm text-carbon-blue/50">
        No projects yet. Projects are coordinated efforts toward a defined outcome — not task lists.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto border border-carbon-blue/10 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-carbon-blue/10 bg-carbon-blue/[0.02] text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            <th className="px-4 py-3 font-semibold">Project</th>
            <th className="px-4 py-3 font-semibold">Type</th>
            <th className="px-4 py-3 font-semibold">Owner</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Priority</th>
            <th className="px-4 py-3 font-semibold">Health</th>
            <th className="px-4 py-3 font-semibold">Strategic Importance</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr
              key={project.id}
              className="border-b border-carbon-blue/5 transition-colors hover:bg-upcycle-orange/[0.03]"
            >
              <td className="px-4 py-3">
                <Link
                  href={project360Href(project.id)}
                  className="inline-flex items-center gap-2 font-medium text-carbon-blue hover:text-upcycle-orange"
                >
                  <SmartCRMIcon name="project" size="sm" />
                  {project.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-carbon-blue/60">{formatKind(project.kind)}</td>
              <td className="px-4 py-3 text-carbon-blue/70">{project.owner}</td>
              <td className="px-4 py-3 text-carbon-blue/70">{project.status}</td>
              <td className="px-4 py-3 text-carbon-blue/70">{project.priority}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1.5 text-carbon-blue/75">
                  <HealthStatusIcon status={project.health} size="xs" />
                  {project.health}
                </span>
              </td>
              <td className="px-4 py-3 text-carbon-blue/70">{project.strategicImportance}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
