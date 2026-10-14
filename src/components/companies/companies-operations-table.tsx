"use client";

import Link from "next/link";
import type { CompanyOperationsRow } from "@/lib/company-operations-data";
import { CompanyTypeBadges } from "@/components/companies/company-type-badges";
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

/**
 * Companies list — five columns, one decision per row.
 * Company · Posture · What matters · Pipeline · Owner
 * Health, location and last touch live on the Company 360; the sentence carries the signal here.
 */
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
        <col className="w-[22%]" />
        <col className="w-[16%]" />
        <col className="w-[38%]" />
        <col className="w-[12%]" />
        <col className="w-[12%]" />
      </colgroup>
      <WorkspaceTableHead>
        <WorkspaceTableHeadRow>
          <WorkspaceTableHeadCell>Company</WorkspaceTableHeadCell>
          <WorkspaceTableHeadCell>Posture</WorkspaceTableHeadCell>
          <WorkspaceTableHeadCell>What matters</WorkspaceTableHeadCell>
          <WorkspaceTableHeadCell align="right">Pipeline</WorkspaceTableHeadCell>
          <WorkspaceTableHeadCell>Owner</WorkspaceTableHeadCell>
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
              {row.locationLabel && row.locationLabel !== "—" ? (
                <span className="block truncate text-[11px] text-carbon-blue/45">
                  {row.locationLabel}
                </span>
              ) : null}
            </WorkspaceTableBodyCell>
            <WorkspaceTableBodyCell>
              <CompanyTypeBadges types={row.companyTypes} size="sm" />
            </WorkspaceTableBodyCell>
            <WorkspaceTableBodyCell>
              {row.attentionLabel ? (
                <span className="inline-flex min-w-0 max-w-full items-center gap-1.5" title={row.attentionLabel}>
                  <SeverityIcon severity={row.attentionSeverity} size="sm" />
                  <span className="truncate text-carbon-blue/80">{row.attentionLabel}</span>
                </span>
              ) : (
                <span className="text-carbon-blue/35">—</span>
              )}
            </WorkspaceTableBodyCell>
            <WorkspaceTableBodyCell className="text-right">
              {row.openOpportunities > 0 ? (
                <Link
                  href={row.opportunitiesHref}
                  className="block font-semibold tabular-nums text-carbon-blue hover:text-upcycle-orange"
                >
                  {row.pipelineValueLabel}
                  <span className="block text-[11px] font-normal text-carbon-blue/45">
                    {row.openOpportunities} open
                  </span>
                </Link>
              ) : (
                <span className="text-carbon-blue/35">—</span>
              )}
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
          </WorkspaceTableBodyRow>
        ))}
      </WorkspaceTableBody>
    </WorkspaceTable>
  );
}
