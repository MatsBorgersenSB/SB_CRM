"use client";

import type { CompanyClassificationCount } from "@/lib/company-classification";
import { CompanyTypeIcon } from "@/components/companies/company-type-icon";

export function CompanyClassificationReport({
  report,
}: {
  report: CompanyClassificationCount[];
}) {
  if (report.length === 0) {
    return (
      <p className="text-[12px] text-carbon-blue/65">No company classifications recorded yet.</p>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {report.map((entry) => (
        <div
          key={entry.type}
          className="border border-carbon-blue/10 bg-carbon-blue/[0.02] px-3 py-2.5"
        >
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-carbon-blue/50">
            <CompanyTypeIcon icon={entry.icon} />
            {entry.label}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-carbon-blue">{entry.count}</p>
        </div>
      ))}
    </div>
  );
}
