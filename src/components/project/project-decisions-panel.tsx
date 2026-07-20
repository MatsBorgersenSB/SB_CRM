"use client";

import type { ProjectDecision } from "@/types/project";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ProjectDecisionsPanel({ decisions }: { decisions: ProjectDecision[] }) {
  if (decisions.length === 0) {
    return <p className="text-sm text-carbon-blue/45">No decisions logged yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {decisions.map((decision) => (
        <article
          key={decision.id}
          className="border border-carbon-blue/10 bg-white px-4 py-3"
        >
          <p className="text-sm leading-relaxed text-carbon-blue/80">{decision.decision}</p>
          <p className="mt-2 text-[12px] text-carbon-blue/45">
            {formatDate(decision.date)} · {decision.owner}
          </p>
        </article>
      ))}
    </div>
  );
}
