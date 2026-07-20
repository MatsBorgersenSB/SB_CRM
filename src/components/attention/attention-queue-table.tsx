"use client";

import Link from "next/link";
import { resolveAttentionActions } from "@/lib/attention-action-resolver";
import type { AttentionItem } from "@/types/attention-item";
import {
  ATTENTION_SEVERITY_LABELS,
  sortAttentionItems,
} from "@/types/attention-item";
import { AttentionActionButtons } from "@/components/attention/attention-action-buttons";
import { ObjectTypeIcon, SeverityIcon } from "@/components/ui/smartcrm-icon";
import {
  WorkspaceTable,
  WorkspaceTableBody,
  WorkspaceTableBodyCell,
  WorkspaceTableBodyRow,
  WorkspaceTableHead,
  WorkspaceTableHeadCell,
  WorkspaceTableHeadRow,
} from "@/components/ui/workspace-table";

function formatDueDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Table-based attention queue — standard across all SmartCRM workspaces.
 */
export function AttentionQueueTable({
  items,
  emptyMessage = "No open attention items — this account is on track.",
  onDraftEmail,
}: {
  items: AttentionItem[];
  emptyMessage?: string;
  onDraftEmail?: (item: AttentionItem) => void;
}) {
  const sorted = sortAttentionItems(items);

  if (sorted.length === 0) {
    return <p className="text-sm text-carbon-blue/45">{emptyMessage}</p>;
  }

  return (
    <WorkspaceTable>
      <colgroup>
        <col className="w-[8%]" />
        <col className="w-[14%]" />
        <col className="w-[26%]" />
        <col className="w-[18%]" />
        <col className="w-[11%]" />
        <col className="w-[11%]" />
        <col className="w-[12%]" />
      </colgroup>
      <WorkspaceTableHead>
        <WorkspaceTableHeadRow>
          <WorkspaceTableHeadCell>Status</WorkspaceTableHeadCell>
          <WorkspaceTableHeadCell>Object</WorkspaceTableHeadCell>
          <WorkspaceTableHeadCell>Attention Item</WorkspaceTableHeadCell>
          <WorkspaceTableHeadCell>Recommended Action</WorkspaceTableHeadCell>
          <WorkspaceTableHeadCell>Due Date</WorkspaceTableHeadCell>
          <WorkspaceTableHeadCell>Owner</WorkspaceTableHeadCell>
          <WorkspaceTableHeadCell>Execute Action</WorkspaceTableHeadCell>
        </WorkspaceTableHeadRow>
      </WorkspaceTableHead>
      <WorkspaceTableBody>
        {sorted.map((item) => {
          const actions = resolveAttentionActions(item);

          return (
            <WorkspaceTableBodyRow key={item.id}>
              <WorkspaceTableBodyCell>
                <span className="inline-flex items-center gap-1.5">
                  <SeverityIcon severity={item.severity} size="sm" />
                  <span className="sr-only">{ATTENTION_SEVERITY_LABELS[item.severity]}</span>
                </span>
              </WorkspaceTableBodyCell>
              <WorkspaceTableBodyCell>
                <div className="flex min-w-0 items-center gap-1.5">
                  <ObjectTypeIcon objectType={item.objectType} />
                  <Link
                    href={item.href}
                    className="truncate font-semibold text-carbon-blue hover:text-upcycle-orange"
                  >
                    {item.sourceObjectName}
                  </Link>
                </div>
              </WorkspaceTableBodyCell>
              <WorkspaceTableBodyCell>
                <p className="line-clamp-2 text-carbon-blue/70">{item.recommendation}</p>
              </WorkspaceTableBodyCell>
              <WorkspaceTableBodyCell>
                <p className="truncate font-medium text-carbon-blue">{item.suggestedAiAction}</p>
              </WorkspaceTableBodyCell>
              <WorkspaceTableBodyCell className="tabular-nums text-carbon-blue/65">
                {formatDueDate(item.dueDate)}
              </WorkspaceTableBodyCell>
              <WorkspaceTableBodyCell className="truncate text-carbon-blue/65">
                {item.ownerLabel ?? "—"}
              </WorkspaceTableBodyCell>
              <WorkspaceTableBodyCell>
                <AttentionActionButtons
                  actions={actions}
                  attentionItem={item}
                  onDraftEmail={onDraftEmail}
                  compact
                />
              </WorkspaceTableBodyCell>
            </WorkspaceTableBodyRow>
          );
        })}
      </WorkspaceTableBody>
    </WorkspaceTable>
  );
}
