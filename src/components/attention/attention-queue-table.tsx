"use client";

import { formatDate } from "@/lib/regional-format-preference";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { resolveAttentionActions } from "@/lib/attention-action-resolver";
import {
  dismissAttentionItem,
  filterDismissedAttentionItems,
} from "@/lib/attention-dismiss-store";
import type { AttentionItem } from "@/types/attention-item";
import {
  ATTENTION_SEVERITY_LABELS,
  sortAttentionItems,
} from "@/types/attention-item";
import { AttentionActionButtons } from "@/components/attention/attention-action-buttons";
import { AttentionIssueLink } from "@/components/attention/attention-issue-link";
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
  return formatDate(new Date(iso));
}

/**
 * Table-based attention queue — standard across all SmartCRM workspaces.
 */
export function AttentionQueueTable({
  items,
  emptyMessage = "No open attention items — this account is on track.",
  onDraftEmail,
  onVisibleCountChange,
  onItemDismissed,
}: {
  items: AttentionItem[];
  emptyMessage?: string;
  onDraftEmail?: (item: AttentionItem) => void;
  /** Fires when the visible (non-dismissed) count changes — keep panel badges honest. */
  onVisibleCountChange?: (count: number) => void;
  onItemDismissed?: (item: AttentionItem) => void;
}) {
  const [dismissTick, setDismissTick] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate client-only dismissal state after mount
  useEffect(() => setHydrated(true), []);

  const visible = useMemo(() => {
    void dismissTick;
    const sorted = sortAttentionItems(items);
    return hydrated ? filterDismissedAttentionItems(sorted) : sorted;
  }, [items, dismissTick, hydrated]);

  useEffect(() => {
    onVisibleCountChange?.(visible.length);
  }, [visible.length, onVisibleCountChange]);

  const handleNoAction = useCallback(
    (item: AttentionItem) => {
      dismissAttentionItem(item.id);
      setDismissTick((value) => value + 1);
      onItemDismissed?.(item);
    },
    [onItemDismissed],
  );

  if (visible.length === 0) {
    return <p className="text-sm text-carbon-blue/65">{emptyMessage}</p>;
  }

  return (
    <WorkspaceTable>
      <colgroup>
        <col className="w-[10%]" />
        <col className="w-[15%]" />
        <col className="w-[26%]" />
        <col className="w-[17%]" />
        <col className="w-[9%]" />
        <col className="w-[10%]" />
        <col className="w-[13%]" />
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
        {visible.map((item) => {
          const actions = resolveAttentionActions(item);

          return (
            <WorkspaceTableBodyRow key={item.id}>
              <WorkspaceTableBodyCell>
                <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-carbon-blue/80">
                  <SeverityIcon severity={item.severity} size="sm" />
                  <span className="truncate">{ATTENTION_SEVERITY_LABELS[item.severity]}</span>
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
                <AttentionIssueLink
                  item={item}
                  className="block line-clamp-2 text-[13px] leading-snug text-carbon-blue/80 underline-offset-2 hover:text-upcycle-orange hover:underline"
                >
                  {item.recommendation}
                </AttentionIssueLink>
              </WorkspaceTableBodyCell>
              <WorkspaceTableBodyCell>
                <AttentionIssueLink
                  item={item}
                  className="inline-flex max-w-full items-center gap-1 truncate text-[13px] font-semibold text-upcycle-orange underline-offset-2 hover:underline"
                >
                  <span className="truncate">{item.suggestedAiAction}</span>
                  <span aria-hidden className="shrink-0 text-xs">→</span>
                </AttentionIssueLink>
              </WorkspaceTableBodyCell>
              <WorkspaceTableBodyCell className="tabular-nums text-carbon-blue/65">
                {formatDueDate(item.dueDate)}
              </WorkspaceTableBodyCell>
              <WorkspaceTableBodyCell
                className={
                  item.ownerLabel
                    ? "truncate text-carbon-blue"
                    : "truncate text-carbon-blue/65"
                }
              >
                {item.ownerLabel ?? "Unassigned"}
              </WorkspaceTableBodyCell>
              <WorkspaceTableBodyCell className="overflow-visible">
                <AttentionActionButtons
                  actions={actions}
                  attentionItem={item}
                  onDraftEmail={onDraftEmail}
                  onNoAction={handleNoAction}
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
