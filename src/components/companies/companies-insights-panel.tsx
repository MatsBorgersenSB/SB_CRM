"use client";

import { CompanyClassificationReport } from "@/components/companies/company-classification-report";
import type { CompanyOperationsSummary } from "@/lib/company-operations-data";
import { WorkspacePanel } from "@/components/ui/smartcrm-icon";

function InsightMetric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="border border-carbon-blue/10 bg-carbon-blue/[0.02] px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/50">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold tabular-nums ${
          accent ? "text-upcycle-orange" : "text-carbon-blue"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function CompaniesInsightsPanel({ summary }: { summary: CompanyOperationsSummary }) {
  return (
    <WorkspacePanel
      title="Insights"
      collapsible
      defaultCollapsed
      count={summary.totalCompanies}
    >
      <p className="mb-3 text-[11px] text-carbon-blue/50">
        Portfolio statistics — useful context, not the primary workspace.
      </p>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <InsightMetric label="Total Companies" value={summary.totalCompanies} />
        <InsightMetric
          label="Companies Needing Attention"
          value={summary.needsAttentionCount}
          accent={summary.needsAttentionCount > 0}
        />
        <InsightMetric
          label="Companies With No Recent Activity"
          value={summary.noRecentActivityCount}
          accent={summary.noRecentActivityCount > 0}
        />
        <InsightMetric
          label="Total Open Opportunities"
          value={summary.totalOpenOpportunities}
        />
      </div>
      <div className="mt-4 border-t border-carbon-blue/8 pt-4">
        <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          Classification
        </p>
        <CompanyClassificationReport report={summary.classification} />
      </div>
    </WorkspacePanel>
  );
}
