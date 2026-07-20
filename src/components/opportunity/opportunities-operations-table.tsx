"use client";

import Link from "next/link";
import type { OpportunityOperationsRow } from "@/lib/opportunity-operations-data";
import {
  SmartAssistCategoryBadge,
  SmartAssistConfidenceLabel,
} from "@/components/smartassist/smartassist-intelligence-display";
import {
  WorkspaceTable,
  WorkspaceTableBody,
  WorkspaceTableBodyCell,
  WorkspaceTableBodyRow,
  WorkspaceTableHead,
  WorkspaceTableHeadCell,
  WorkspaceTableHeadRow,
} from "@/components/ui/workspace-table";

const ATTENTION_STYLES = {
  HIGH: "border-thermal-red/30 bg-thermal-red/[0.06] text-thermal-red",
  MEDIUM: "border-upcycle-orange/30 bg-upcycle-orange/[0.06] text-upcycle-orange",
  LOW: "border-carbon-blue/15 bg-carbon-blue/[0.04] text-carbon-blue/65",
  HOLD: "border-carbon-blue/12 bg-carbon-blue/[0.02] text-carbon-blue/45",
} as const;

export function OpportunitiesOperationsTable({
  rows,
  primaryFocusDealId,
}: {
  rows: OpportunityOperationsRow[];
  primaryFocusDealId?: string | null;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-carbon-blue/45">
        No opportunities match this filter. Try another view or broaden your search.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <WorkspaceTable className="min-w-[920px]">
        <colgroup>
          <col className="w-[16%]" />
          <col className="w-[10%]" />
          <col className="w-[20%]" />
          <col className="w-[20%]" />
          <col className="w-[8%]" />
          <col className="w-[10%]" />
          <col className="w-[16%]" />
        </colgroup>
        <WorkspaceTableHead>
          <WorkspaceTableHeadRow>
            <WorkspaceTableHeadCell>Opportunity</WorkspaceTableHeadCell>
            <WorkspaceTableHeadCell>Attention</WorkspaceTableHeadCell>
            <WorkspaceTableHeadCell>Client objective</WorkspaceTableHeadCell>
            <WorkspaceTableHeadCell>Biggest unknown</WorkspaceTableHeadCell>
            <WorkspaceTableHeadCell align="right">Gaps</WorkspaceTableHeadCell>
            <WorkspaceTableHeadCell>Category</WorkspaceTableHeadCell>
            <WorkspaceTableHeadCell>Next step</WorkspaceTableHeadCell>
          </WorkspaceTableHeadRow>
        </WorkspaceTableHead>
        <WorkspaceTableBody>
          {rows.map((row) => {
            const isPrimaryFocus = primaryFocusDealId === row.dealId;
            return (
            <WorkspaceTableBodyRow
              key={row.dealId}
              className={
                isPrimaryFocus
                  ? "border-l-[3px] border-l-upcycle-orange/60 bg-upcycle-orange/[0.03]"
                  : row.needsAttention
                    ? "bg-carbon-blue/[0.015]"
                    : undefined
              }
            >
              <WorkspaceTableBodyCell>
                {isPrimaryFocus ? (
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-upcycle-orange/80">
                    Primary focus
                  </p>
                ) : null}
                <Link
                  href={row.dealHref}
                  className="block font-semibold text-carbon-blue hover:text-upcycle-orange"
                >
                  {row.dealName}
                </Link>
                <p className="mt-0.5 truncate text-[11px] text-carbon-blue/45">
                  {[row.companyName, row.dealId].filter(Boolean).join(" · ")}
                </p>
              </WorkspaceTableBodyCell>
              <WorkspaceTableBodyCell>
                <span
                  className={`inline-flex border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ATTENTION_STYLES[row.recommendedAttention]}`}
                >
                  {row.recommendedAttention}
                </span>
                <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-carbon-blue/55">
                  {row.attentionReason}
                </p>
              </WorkspaceTableBodyCell>
              <WorkspaceTableBodyCell className="max-w-[14rem]">
                <div className="flex flex-wrap items-center gap-1.5">
                  <SmartAssistCategoryBadge category={row.clientObjectiveCategory} />
                  <SmartAssistConfidenceLabel confidence={row.clientObjectiveConfidence} />
                </div>
                <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-carbon-blue/75">
                  {row.clientObjective}
                </p>
              </WorkspaceTableBodyCell>
              <WorkspaceTableBodyCell className="max-w-[14rem]">
                <div className="mb-1">
                  <SmartAssistCategoryBadge category={row.biggestUnknownCategory} />
                </div>
                <p className="line-clamp-2 text-[12px] leading-relaxed text-carbon-blue/70">
                  {row.biggestUnknown}
                </p>
              </WorkspaceTableBodyCell>
              <WorkspaceTableBodyCell className="text-right tabular-nums font-semibold text-carbon-blue">
                {row.validationGapsCount}
              </WorkspaceTableBodyCell>
              <WorkspaceTableBodyCell>
                <InsightCategorySummary row={row} />
              </WorkspaceTableBodyCell>
              <WorkspaceTableBodyCell className="max-w-[12rem]">
                <p className="line-clamp-2 text-[12px] leading-relaxed text-carbon-blue/70">
                  {row.nextStep}
                </p>
              </WorkspaceTableBodyCell>
            </WorkspaceTableBodyRow>
            );
          })}
        </WorkspaceTableBody>
      </WorkspaceTable>
    </div>
  );
}

function InsightCategorySummary({ row }: { row: OpportunityOperationsRow }) {
  const categories = new Set([
    row.clientObjectiveCategory,
    row.biggestUnknownCategory,
  ]);

  if (row.validationGapsCount > 0) categories.add("missing_critical");

  const ordered = (["missing_critical", "unknown", "assumed", "known"] as const).filter((item) =>
    categories.has(item),
  );

  return (
    <div className="flex flex-col gap-1">
      {ordered.slice(0, 2).map((category) => (
        <SmartAssistCategoryBadge key={category} category={category} />
      ))}
    </div>
  );
}
