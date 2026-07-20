"use client";

import type { ProjectRisk } from "@/types/project";
import { SeverityIcon } from "@/components/ui/smartcrm-icon";

function severityKey(severity: ProjectRisk["severity"]): "urgent" | "needs_attention" | "healthy" {
  if (severity === "critical") return "urgent";
  if (severity === "warning") return "needs_attention";
  return "healthy";
}

export function ProjectRisksPanel({ risks }: { risks: ProjectRisk[] }) {
  if (risks.length === 0) {
    return <p className="text-sm text-carbon-blue/45">No risks recorded.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-carbon-blue/10 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            <th className="px-2 py-2 font-semibold">Risk</th>
            <th className="px-2 py-2 font-semibold">Impact</th>
            <th className="px-2 py-2 font-semibold">Recommended Action</th>
          </tr>
        </thead>
        <tbody>
          {risks.map((risk) => (
            <tr key={risk.id} className="border-b border-carbon-blue/5 align-top">
              <td className="px-2 py-2.5">
                <span className="inline-flex items-start gap-1.5 font-medium text-carbon-blue">
                  <SeverityIcon severity={severityKey(risk.severity)} size="xs" className="mt-0.5" />
                  {risk.risk}
                </span>
              </td>
              <td className="px-2 py-2.5 text-carbon-blue/70">{risk.impact}</td>
              <td className="px-2 py-2.5 text-carbon-blue/75">{risk.recommendedAction}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
