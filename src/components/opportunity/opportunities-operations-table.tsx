"use client";

import Link from "next/link";
import type { OpportunityOperationsRow } from "@/lib/opportunity-operations-data";
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
 * Attention level as a single coloured dot in front of the blocker text.
 * The colour is the signal; the title explains it on hover.
 */
const ATTENTION_DOT = {
  HIGH: { dot: "bg-thermal-red", title: "Needs attention now" },
  MEDIUM: { dot: "bg-upcycle-orange", title: "Worth a look this week" },
  LOW: { dot: "bg-emerald-500", title: "On track" },
  HOLD: { dot: "bg-carbon-blue/30", title: "On hold" },
} as const;

/**
 * Five columns, one question each: which deal, what is blocking it, what
 * happens next, what it is worth, who owns it. Fits the viewport without
 * horizontal scroll; no IDs, no engine labels.
 */
export function OpportunitiesOperationsTable({
  rows,
  primaryFocusDealId,
}: {
  rows: OpportunityOperationsRow[];
  primaryFocusDealId?: string | null;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-carbon-blue/65">
        No opportunities match this filter. Try another view or broaden your search.
      </p>
    );
  }

  return (
    <div className="w-full">
      <WorkspaceTable>
        <colgroup>
          <col className="w-[24%]" />
          <col className="w-[28%]" />
          <col className="w-[26%]" />
          <col className="w-[12%]" />
          <col className="w-[10%]" />
        </colgroup>
        <WorkspaceTableHead>
          <WorkspaceTableHeadRow>
            <WorkspaceTableHeadCell>Opportunity</WorkspaceTableHeadCell>
            <WorkspaceTableHeadCell>What&apos;s blocking</WorkspaceTableHeadCell>
            <WorkspaceTableHeadCell>Next step</WorkspaceTableHeadCell>
            <WorkspaceTableHeadCell align="right">Value</WorkspaceTableHeadCell>
            <WorkspaceTableHeadCell>Owner</WorkspaceTableHeadCell>
          </WorkspaceTableHeadRow>
        </WorkspaceTableHead>
        <WorkspaceTableBody>
          {rows.map((row) => {
            const isPrimaryFocus = primaryFocusDealId === row.dealId;
            const attention = ATTENTION_DOT[row.recommendedAttention];
            const moreQuestions = Math.max(0, row.validationGapsCount - 1);
            return (
              <WorkspaceTableBodyRow
                key={row.dealId}
                className={
                  isPrimaryFocus
                    ? "border-l-[3px] border-l-upcycle-orange/60 bg-upcycle-orange/[0.03]"
                    : undefined
                }
              >
                <WorkspaceTableBodyCell>
                  <Link
                    href={row.dealHref}
                    className="block text-[14px] font-semibold text-carbon-blue hover:text-upcycle-orange"
                  >
                    {row.dealName}
                  </Link>
                  <p className="mt-0.5 truncate text-[13px] text-carbon-blue/65">
                    {[row.companyName, row.stageLabel].filter(Boolean).join(" · ")}
                  </p>
                </WorkspaceTableBodyCell>

                <WorkspaceTableBodyCell>
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-[7px] size-2 shrink-0 rounded-full ${attention.dot}`}
                      title={attention.title}
                      aria-label={attention.title}
                      role="img"
                    />
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-[13px] leading-relaxed text-carbon-blue">
                        {row.biggestUnknown}
                      </p>
                      {moreQuestions > 0 ? (
                        <p className="mt-0.5 text-[13px] text-carbon-blue/65">
                          +{moreQuestions} more open question{moreQuestions === 1 ? "" : "s"}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </WorkspaceTableBodyCell>

                <WorkspaceTableBodyCell>
                  <p className="line-clamp-2 text-[13px] leading-relaxed text-carbon-blue">
                    {row.nextStep}
                  </p>
                </WorkspaceTableBodyCell>

                <WorkspaceTableBodyCell className="text-right">
                  <p className="tabular-nums text-[13px] font-semibold text-carbon-blue">
                    {row.valueLabel}
                  </p>
                  {row.expectedCloseDate ? (
                    <p className="mt-0.5 text-[13px] text-carbon-blue/65">{row.closeDateLabel}</p>
                  ) : null}
                </WorkspaceTableBodyCell>

                <WorkspaceTableBodyCell>
                  <span
                    className={
                      row.ownerLabel ? "text-carbon-blue" : "text-carbon-blue/65"
                    }
                  >
                    {row.ownerLabel ?? "Unassigned"}
                  </span>
                </WorkspaceTableBodyCell>
              </WorkspaceTableBodyRow>
            );
          })}
        </WorkspaceTableBody>
      </WorkspaceTable>
    </div>
  );
}
