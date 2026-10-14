"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { WorkspaceDocumentRow, WorkspaceDocumentSortKey } from "@/lib/workspace-documents-data";
import { DOCUMENT_SORT_COLUMNS } from "@/lib/workspace-documents-table";
import { splitSmartDocDisplayName } from "@/lib/smartdoc-identity";
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
 * Four columns: the document (title first, code second), its type, what it
 * relates to, when it was added. Origin appears only when we know it.
 * Fits the viewport without horizontal scroll.
 */
export function WorkspaceDocumentsBrowseTable({
  rows,
  sortKey,
  sortDir,
  onSort,
  onDelete,
}: {
  rows: WorkspaceDocumentRow[];
  sortKey: WorkspaceDocumentSortKey;
  sortDir: "asc" | "desc";
  onSort: (column: WorkspaceDocumentSortKey) => void;
  onDelete?: (row: WorkspaceDocumentRow) => void;
}) {
  return (
    <div className="w-full">
      <WorkspaceTable>
        <colgroup>
          <col className={onDelete ? "w-[38%]" : "w-[42%]"} />
          <col className="w-[15%]" />
          <col className={onDelete ? "w-[24%]" : "w-[28%]"} />
          <col className="w-[15%]" />
          {onDelete ? <col className="w-[8%]" /> : null}
        </colgroup>
        <WorkspaceTableHead>
          <WorkspaceTableHeadRow>
            {DOCUMENT_SORT_COLUMNS.map((column) => (
              <SortableHeadCell
                key={column.key}
                label={column.label}
                column={column.key}
                active={sortKey === column.key}
                direction={sortDir}
                onSort={onSort}
                align={column.key === "modifiedAt" ? "right" : "left"}
              />
            ))}
            {onDelete ? (
              <WorkspaceTableHeadCell align="right">
                <span className="sr-only">Actions</span>
              </WorkspaceTableHeadCell>
            ) : null}
          </WorkspaceTableHeadRow>
        </WorkspaceTableHead>
        <WorkspaceTableBody>
          {rows.map((row) => {
            const { title, code } = splitSmartDocDisplayName(row.name);
            const meta = [code, row.docCategory, row.counterparty].filter(Boolean);
            return (
              <WorkspaceTableBodyRow key={row.id}>
                <WorkspaceTableBodyCell>
                  <Link
                    href={row.href}
                    className="block truncate text-[14px] font-semibold text-carbon-blue hover:text-upcycle-orange"
                    title={row.name}
                  >
                    {title}
                  </Link>
                  <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                    {row.origin !== "unknown" ? (
                      <OriginBadge origin={row.origin} label={row.originLabel} />
                    ) : null}
                    <p className="truncate text-[13px] text-carbon-blue/65">{meta.join(" · ")}</p>
                  </div>
                </WorkspaceTableBodyCell>
                <WorkspaceTableBodyCell className="text-carbon-blue">{row.docType}</WorkspaceTableBodyCell>
                <WorkspaceTableBodyCell className="truncate text-carbon-blue">
                  {row.relatedObjectHref ? (
                    <Link href={row.relatedObjectHref} className="hover:text-upcycle-orange">
                      {row.relatedObjectLabel}
                    </Link>
                  ) : (
                    row.relatedObjectLabel
                  )}
                </WorkspaceTableBodyCell>
                <WorkspaceTableBodyCell className="whitespace-nowrap text-right tabular-nums text-carbon-blue/70">
                  {row.modifiedLabel}
                </WorkspaceTableBodyCell>
                {onDelete ? (
                  <WorkspaceTableBodyCell className="text-right">
                    {row.statusKind === "activity_link" ? null : (
                      <button
                        type="button"
                        onClick={() => onDelete(row)}
                        className="text-[13px] font-semibold text-thermal-red hover:underline"
                      >
                        Delete
                      </button>
                    )}
                  </WorkspaceTableBodyCell>
                ) : null}
              </WorkspaceTableBodyRow>
            );
          })}
        </WorkspaceTableBody>
      </WorkspaceTable>
    </div>
  );
}

function SortableHeadCell({
  label,
  column,
  active,
  direction,
  onSort,
  align = "left",
}: {
  label: string;
  column: WorkspaceDocumentSortKey;
  active: boolean;
  direction: "asc" | "desc";
  onSort: (column: WorkspaceDocumentSortKey) => void;
  align?: "left" | "right";
}) {
  const Icon = direction === "asc" ? ChevronUp : ChevronDown;

  return (
    <WorkspaceTableHeadCell align={align}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 transition-colors hover:text-carbon-blue ${
          active ? "text-carbon-blue" : "text-carbon-blue/75"
        } ${align === "right" ? "ml-auto" : ""}`}
      >
        <span>{label}</span>
        {active ? <Icon className="size-3 shrink-0" strokeWidth={2} /> : null}
      </button>
    </WorkspaceTableHeadCell>
  );
}

/** Shown only for known origins — an unknown origin is a data gap, not a label. */
function OriginBadge({
  origin,
  label,
}: {
  origin: Exclude<WorkspaceDocumentRow["origin"], "unknown">;
  label: string;
}) {
  const styles = {
    standard_bio: "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-700",
    external: "border-sky-500/25 bg-sky-500/[0.06] text-sky-700",
  } as const;

  return (
    <span
      className={`inline-flex shrink-0 border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${styles[origin]}`}
      title={`Origin: ${label}`}
    >
      {origin === "standard_bio" ? "Ours" : "External"}
    </span>
  );
}
