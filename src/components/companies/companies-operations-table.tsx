"use client";

import Link from "next/link";
import type { CompanyOperationsRow } from "@/lib/company-operations-data";
import type { CompanyListColumnVisibility } from "@/lib/company-list-columns";
import { CompanyTypeBadges } from "@/components/companies/company-type-badges";
import { CompanyOwnerSelect } from "@/components/companies/company-owner-select";
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
import type { Company, SharePointPerson } from "@/types/company";
import type { StandardBioUserRecord } from "@/types/user-access";

/**
 * Companies list — five decision columns, plus optional fields from Columns.
 * Company · Posture · What matters · [Industry/Sector] · Pipeline · Owner
 */
export function CompaniesOperationsTable({
  rows,
  companies,
  columnVisibility,
  assignableUsers = [],
  canReassignOwner = false,
  savingOwnerId = null,
  onOwnerChange,
}: {
  rows: CompanyOperationsRow[];
  companies: Company[];
  columnVisibility: CompanyListColumnVisibility;
  assignableUsers?: StandardBioUserRecord[];
  canReassignOwner?: boolean;
  savingOwnerId?: string | null;
  onOwnerChange?: (companyId: string, owner: SharePointPerson) => void;
}) {
  const showIndustrySector = columnVisibility.industrySector;

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
        <col className={showIndustrySector ? "w-[18%]" : "w-[22%]"} />
        <col className={showIndustrySector ? "w-[12%]" : "w-[14%]"} />
        <col className={showIndustrySector ? "w-[28%]" : "w-[36%]"} />
        {showIndustrySector ? <col className="w-[14%]" /> : null}
        <col className={showIndustrySector ? "w-[13%]" : "w-[13%]"} />
        <col className={showIndustrySector ? "w-[15%]" : "w-[15%]"} />
      </colgroup>
      <WorkspaceTableHead>
        <WorkspaceTableHeadRow>
          <WorkspaceTableHeadCell>Company</WorkspaceTableHeadCell>
          <WorkspaceTableHeadCell>Relationship</WorkspaceTableHeadCell>
          <WorkspaceTableHeadCell>What matters</WorkspaceTableHeadCell>
          {showIndustrySector ? (
            <WorkspaceTableHeadCell>Industry / Sector</WorkspaceTableHeadCell>
          ) : null}
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
                className="line-clamp-2 break-words font-semibold text-carbon-blue hover:text-upcycle-orange"
                title={row.companyName}
              >
                {row.companyName}
              </Link>
              {row.locationLabel && row.locationLabel !== "—" ? (
                <span
                  className="block truncate text-[12px] text-carbon-blue/65"
                  title={row.locationLabel}
                >
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
            {showIndustrySector ? (
              <WorkspaceTableBodyCell>
                <IndustrySectorCell industry={row.industry} sectors={row.sectors} />
              </WorkspaceTableBodyCell>
            ) : null}
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
              {canReassignOwner && onOwnerChange ? (
                <CompanyOwnerSelect
                  appearance="inline"
                  label={`Owner for ${row.companyName}`}
                  companies={companies}
                  assignableUsers={assignableUsers}
                  extraUsers={row.accountOwner ? [row.accountOwner] : []}
                  value={row.accountOwner}
                  disabled={savingOwnerId === row.companyId}
                  onChange={(owner) => onOwnerChange(row.companyId, owner)}
                />
              ) : row.ownerQueueHref && row.ownerLabel ? (
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

function IndustrySectorCell({
  industry,
  sectors,
}: {
  industry: string;
  sectors: string[];
}) {
  const sectorsLabel = sectors.length > 0 ? sectors.join(", ") : "";
  if (!industry && !sectorsLabel) {
    return <span className="text-carbon-blue/45">—</span>;
  }

  return (
    <div className="min-w-0">
      {industry ? (
        <span className="block truncate text-carbon-blue" title={industry}>
          {industry}
        </span>
      ) : null}
      {sectorsLabel ? (
        <span
          className={`block truncate text-[12px] text-carbon-blue/65 ${industry ? "" : "text-carbon-blue"}`}
          title={sectorsLabel}
        >
          {sectorsLabel}
        </span>
      ) : null}
    </div>
  );
}
