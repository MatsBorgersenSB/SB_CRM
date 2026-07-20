"use client";

import type { ProjectMilestone } from "@/types/project";

function milestoneTone(status: ProjectMilestone["status"]): string {
  if (status === "Complete") return "text-emerald-700";
  if (status === "Blocked") return "text-red-700";
  if (status === "In Progress") return "text-upcycle-orange";
  return "text-carbon-blue/55";
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ProjectMilestonesPanel({ milestones }: { milestones: ProjectMilestone[] }) {
  if (milestones.length === 0) {
    return <p className="text-sm text-carbon-blue/45">No milestones defined.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-carbon-blue/10 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            <th className="px-2 py-2 font-semibold">Milestone</th>
            <th className="px-2 py-2 font-semibold">Owner</th>
            <th className="px-2 py-2 font-semibold">Status</th>
            <th className="px-2 py-2 font-semibold">Target Date</th>
          </tr>
        </thead>
        <tbody>
          {milestones.map((milestone) => (
            <tr key={milestone.id} className="border-b border-carbon-blue/5">
              <td className="px-2 py-2.5 font-medium text-carbon-blue">{milestone.title}</td>
              <td className="px-2 py-2.5 text-carbon-blue/70">{milestone.owner}</td>
              <td className={`px-2 py-2.5 font-medium ${milestoneTone(milestone.status)}`}>
                {milestone.status}
              </td>
              <td className="px-2 py-2.5 text-carbon-blue/60">{formatDate(milestone.targetDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
