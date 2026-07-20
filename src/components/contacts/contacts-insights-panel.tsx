"use client";

import type { ContactOperationsSummary } from "@/lib/contact-operations-data";
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

export function ContactsInsightsPanel({ summary }: { summary: ContactOperationsSummary }) {
  return (
    <WorkspacePanel
      title="Insights"
      collapsible
      defaultCollapsed
      count={summary.totalContacts}
    >
      <p className="mb-3 text-[11px] text-carbon-blue/50">
        Relationship statistics — useful context, not the primary workspace.
      </p>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <InsightMetric label="Total Contacts" value={summary.totalContacts} />
        <InsightMetric
          label="No Recent Activity"
          value={summary.noRecentActivityCount}
          accent={summary.noRecentActivityCount > 0}
        />
        <InsightMetric
          label="Missing Email"
          value={summary.missingEmailCount}
          accent={summary.missingEmailCount > 0}
        />
        <InsightMetric
          label="Missing Phone"
          value={summary.missingPhoneCount}
          accent={summary.missingPhoneCount > 0}
        />
      </div>
      <div className="mt-4 grid gap-4 border-t border-carbon-blue/8 pt-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            By Status
          </p>
          <ul className="space-y-1">
            {summary.byStatus.map((entry) => (
              <li
                key={entry.status}
                className="flex items-center justify-between text-[11px] text-carbon-blue/65"
              >
                <span>{entry.status}</span>
                <span className="font-semibold tabular-nums text-carbon-blue">{entry.count}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            By Relationship
          </p>
          <ul className="space-y-1">
            {summary.byRelationship.map((entry) => (
              <li
                key={entry.level}
                className="flex items-center justify-between text-[11px] text-carbon-blue/65"
              >
                <span>{entry.level}</span>
                <span className="font-semibold tabular-nums text-carbon-blue">{entry.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </WorkspacePanel>
  );
}
