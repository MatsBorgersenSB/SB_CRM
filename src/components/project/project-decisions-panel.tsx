"use client";

import { formatDate as formatRegionalDate } from "@/lib/regional-format-preference";
import type { ProjectDecision } from "@/types/project";

function formatDate(value: string): string {
  return formatRegionalDate(new Date(value));
}

export function ProjectDecisionsPanel({ decisions }: { decisions: ProjectDecision[] }) {
  if (decisions.length === 0) {
    return <p className="text-sm text-carbon-blue/65">No decisions logged yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {decisions.map((decision) => (
        <article
          key={decision.id}
          className="border border-carbon-blue/10 bg-white px-4 py-3"
        >
          <p className="text-sm leading-relaxed text-carbon-blue/80">{decision.decision}</p>
          <p className="mt-2 text-[13px] text-carbon-blue/65">
            {formatDate(decision.date)} · {decision.owner}
          </p>
        </article>
      ))}
    </div>
  );
}
