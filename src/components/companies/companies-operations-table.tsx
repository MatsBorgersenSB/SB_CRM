"use client";

import Link from "next/link";
import type { CompanyOperationsRow } from "@/lib/company-operations-data";
import { CompanyTypeBadges } from "@/components/companies/company-type-badges";
import { RelationshipHealthBadge } from "@/components/relationship/relationship-health-display";
import { SeverityIcon } from "@/components/ui/smartcrm-icon";
import {
  WorkspaceTable,
  WorkspaceTableBody,
  WorkspaceTableBodyCell,
  WorkspaceTableBodyRow,
  WorkspaceTableHead,
  WorkspaceTableHeadCell,
  WorkspaceTableHeadRow,
} from "@/components/ui/workspace-table";

export function CompaniesOperationsTable({ rows }: { rows: CompanyOperationsRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-carbon-blue/45">
        No companies match this filter. Try another view or broaden your search.
      </p>
    );
  }

  return (
    <WorkspaceTable>
      <colgroup>
        <col className="w-[16%]" />
        <col className="w-[14%]" />
        <col className="w-[10%]" />
        <col className="w-[10%]" />
        <col className="w-[10%]" />
        <col className="w-[9%]" />
        <col className="w-[10%]" />
        <col className="w-[10%]" />
        <col className="w-[11%]" />
      </colgroup>
      <WorkspaceTableHead>
        <WorkspaceTableHeadRow>
          <WorkspaceTableHeadCell>Company</WorkspaceTableHeadCell>
          <WorkspaceTableHeadCell>Company Type</WorkspaceTableHeadCell>
          <WorkspaceTableHeadCell>Owner</WorkspaceTableHeadCell>
          <WorkspaceTableHeadCell>Location</WorkspaceTableHeadCell>
          <WorkspaceTableHeadCell>Health</WorkspaceTableHeadCell>
          <WorkspaceTableHeadCell align="right">Open Opportunities</WorkspaceTableHeadCell>
          <WorkspaceTableHeadCell align="right">Pipeline Value</WorkspaceTableHeadCell>
          <WorkspaceTableHeadCell>Last Contact</WorkspaceTableHeadCell>
          <WorkspaceTableHeadCell>Attention</WorkspaceTableHeadCell>
        </WorkspaceTableHeadRow>
      </WorkspaceTableHead>
      <WorkspaceTableBody>
        {rows.map((row) => (
          <WorkspaceTableBodyRow key={row.companyId}>
            <WorkspaceTableBodyCell>
              <Link
                href={row.companyHref}
                className="block truncate font-semibold text-carbon-blue hover:text-upcycle-orange"
              >
                {row.companyName}
              </Link>
            </WorkspaceTableBodyCell>
            <WorkspaceTableBodyCell>
              <CompanyTypeBadges types={row.companyTypes} size="sm" />
            </WorkspaceTableBodyCell>
            <WorkspaceTableBodyCell>
              {row.ownerQueueHref && row.ownerLabel ? (
                <Link
                  href={row.ownerQueueHref}
                  className="block truncate text-carbon-blue/75 hover:text-upcycle-orange"
                >
                  {row.ownerLabel}
                </Link>
              ) : (
                <span className="text-carbon-blue/35">—</span>
              )}
            </WorkspaceTableBodyCell>
            <WorkspaceTableBodyCell className="truncate text-carbon-blue/70">
              {row.locationLabel}
            </WorkspaceTableBodyCell>
            <WorkspaceTableBodyCell>
              <div className="flex flex-col gap-1">
                <RelationshipHealthBadge status={row.healthStatus} />
                <span className="text-[10px] tabular-nums text-carbon-blue/45">{row.healthScore}/100</span>
              </div>
            </WorkspaceTableBodyCell>
            <WorkspaceTableBodyCell className="text-right">
              {row.openOpportunities > 0 ? (
                <Link
                  href={row.opportunitiesHref}
                  className="font-semibold tabular-nums text-carbon-blue hover:text-upcycle-orange"
                >
                  {row.openOpportunities}
                </Link>
              ) : (
                <span className="tabular-nums text-carbon-blue/35">0</span>
              )}
            </WorkspaceTableBodyCell>
            <WorkspaceTableBodyCell className="text-right font-semibold tabular-nums text-carbon-blue">
              {row.pipelineValueLabel}
            </WorkspaceTableBodyCell>
            <WorkspaceTableBodyCell className="text-carbon-blue/70">{row.lastContactLabel}</WorkspaceTableBodyCell>
            <WorkspaceTableBodyCell>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <SeverityIcon severity={row.attentionSeverity} size="sm" />
                <span className="truncate text-carbon-blue/70">{row.attentionLabel}</span>
              </span>
            </WorkspaceTableBodyCell>
          </WorkspaceTableBodyRow>
        ))}
      </WorkspaceTableBody>
    </WorkspaceTable>
  );
}
