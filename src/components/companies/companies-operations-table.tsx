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
      <p className="text-sm text-carbon-blue/65">
        No companies match this filter. Try another view or broaden your search.
      </p>
    );
  }

  return (
    <WorkspaceTable>
      <colgroup>
        <col className="w-[22%]" />
        <col className="w-[14%]" />
        <col className="w-[36%]" />
        <col className="w-[13%]" />
        <col className="w-[15%]" />
      </colgroup>
      <WorkspaceTableHead>
        <WorkspaceTableHeadRow>
          <WorkspaceTableHeadCell>Company</WorkspaceTableHeadCell>
          <WorkspaceTableHeadCell>Relationship</WorkspaceTableHeadCell>
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
                <span className="block truncate text-[12px] text-carbon-blue/65">
                  {row.locationLabel}
                </span>
              ) : null}
            </WorkspaceTableBodyCell>
            <WorkspaceTableBodyCell>
              <CompanyTypeBadges types={row.companyTypes} size="sm" compact />
            </WorkspaceTableBodyCell>
            <WorkspaceTableBodyCell>
              {row.attentionLabel ? (
                <span className="flex min-w-0 max-w-full items-start gap-1.5" title={row.attentionLabel}>
                  <SeverityIcon severity={row.attentionSeverity} size="sm" className="mt-0.5 shrink-0" />
                  <span className="line-clamp-2 text-carbon-blue">{row.attentionLabel}</span>
                </span>
              ) : null}
            </WorkspaceTableBodyCell>
            <WorkspaceTableBodyCell className="text-right">
              {row.openOpportunities > 0 ? (
                <Link
                  href={row.opportunitiesHref}
                  className="block font-semibold tabular-nums text-carbon-blue hover:text-upcycle-orange"
                >
                  {row.pipelineValueLabel}
                  <span className="block text-[13px] font-normal text-carbon-blue/65">
                    {row.openOpportunities} open
                  </span>
                </Link>
              ) : null}
            </WorkspaceTableBodyCell>
            <WorkspaceTableBodyCell>
              {row.ownerQueueHref && row.ownerLabel ? (
                <Link
                  href={row.ownerQueueHref}
                  className="block truncate text-carbon-blue hover:text-upcycle-orange"
                  title={row.ownerLabel}
                >
                  {row.ownerLabel}
                </Link>
              ) : (
                <span className="text-carbon-blue/65">Unassigned</span>
              )}
            </WorkspaceTableBodyCell>
          </WorkspaceTableBodyRow>
        ))}
      </WorkspaceTableBody>
    </WorkspaceTable>
  );
}
