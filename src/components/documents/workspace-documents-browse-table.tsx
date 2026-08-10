"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { WorkspaceDocumentRow, WorkspaceDocumentSortKey } from "@/lib/workspace-documents-data";
import { DOCUMENT_SORT_COLUMNS } from "@/lib/workspace-documents-table";
import {
  WorkspaceTable,
  WorkspaceTableBody,
  WorkspaceTableBodyCell,
  WorkspaceTableBodyRow,
  WorkspaceTableHead,
  WorkspaceTableHeadCell,
  WorkspaceTableHeadRow,
} from "@/components/ui/workspace-table";

export function WorkspaceDocumentsBrowseTable({
  rows,
  sortKey,
  sortDir,
  onSort,
}: {
  rows: WorkspaceDocumentRow[];
  sortKey: WorkspaceDocumentSortKey;
  sortDir: "asc" | "desc";
  onSort: (column: WorkspaceDocumentSortKey) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <WorkspaceTable className="min-w-[920px]">
        <colgroup>
          <col className="w-[24%]" />
          <col className="w-[14%]" />
          <col className="w-[8%]" />
          <col className="w-[12%]" />
          <col className="w-[26%]" />
          <col className="w-[12%]" />
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
          </WorkspaceTableHeadRow>
        </WorkspaceTableHead>
        <WorkspaceTableBody>
          {rows.map((row) => (
            <WorkspaceTableBodyRow key={row.id}>
              <WorkspaceTableBodyCell>
                <Link
                  href={row.href}
                  className="block truncate font-semibold text-carbon-blue hover:text-upcycle-orange"
                >
                  {row.name}
                </Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <OriginBadge origin={row.origin} label={row.originLabel} />
                  <p className="truncate text-[10px] text-carbon-blue/40">{row.docCategory}</p>
                  {row.counterparty ? (
                    <p className="truncate text-[10px] text-carbon-blue/40">
                      · {row.counterparty}
                    </p>
                  ) : null}
                </div>
              </WorkspaceTableBodyCell>
              <WorkspaceTableBodyCell className="text-carbon-blue/70">{row.docType}</WorkspaceTableBodyCell>
              <WorkspaceTableBodyCell className="tabular-nums text-carbon-blue/70">
                {row.version}
              </WorkspaceTableBodyCell>
              <WorkspaceTableBodyCell>
                <StatusBadge statusKind={row.statusKind} label={row.status} />
              </WorkspaceTableBodyCell>
              <WorkspaceTableBodyCell className="truncate text-carbon-blue/70">
                {row.relatedObjectHref ? (
                  <Link href={row.relatedObjectHref} className="hover:text-upcycle-orange">
                    {row.relatedObjectLabel}
                  </Link>
                ) : (
                  row.relatedObjectLabel
                )}
              </WorkspaceTableBodyCell>
              <WorkspaceTableBodyCell className="text-right tabular-nums text-carbon-blue/70">
                {row.modifiedLabel}
              </WorkspaceTableBodyCell>
            </WorkspaceTableBodyRow>
          ))}
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
          active ? "text-carbon-blue" : "text-carbon-blue/45"
        } ${align === "right" ? "ml-auto" : ""}`}
      >
        <span>{label}</span>
        {active ? <Icon className="size-3 shrink-0" strokeWidth={2} /> : null}
      </button>
    </WorkspaceTableHeadCell>
  );
}

function OriginBadge({
  origin,
  label,
}: {
  origin: WorkspaceDocumentRow["origin"];
  label: string;
}) {
  const styles = {
    standard_bio: "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-700",
    external: "border-sky-500/25 bg-sky-500/[0.06] text-sky-700",
    unknown: "border-carbon-blue/12 bg-carbon-blue/[0.03] text-carbon-blue/55",
  } as const;

  return (
    <span
      className={`inline-flex shrink-0 border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${styles[origin]}`}
      title={label}
    >
      {origin === "standard_bio" ? "Ours" : origin === "external" ? "External" : "Unknown"}
    </span>
  );
}

function StatusBadge({
  statusKind,
  label,
}: {
  statusKind: WorkspaceDocumentRow["statusKind"];
  label: string;
}) {
  const styles = {
    in_set: "border-sky-500/25 bg-sky-500/[0.06] text-sky-700",
    library: "border-carbon-blue/12 bg-carbon-blue/[0.03] text-carbon-blue/60",
    activity_link: "border-upcycle-orange/25 bg-upcycle-orange/[0.06] text-upcycle-orange",
    company: "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-700",
  } as const;

  return (
    <span
      className={`inline-flex max-w-full truncate border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[statusKind]}`}
      title={label}
    >
      {label}
    </span>
  );
}
