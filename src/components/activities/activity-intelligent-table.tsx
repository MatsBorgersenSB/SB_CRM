"use client";

import Link from "next/link";
import { TaskShareControl } from "@/components/activities/task-share-control";
import type { ActivityIntelligentRow } from "@/lib/activity-mission-control";
import { EDITORIAL_EMPTY } from "@/lib/editorial-design-system";
import { WORKSPACE_PANEL_SURFACE } from "@/lib/workspace-design-system";
import type { Activity } from "@/types/activity";
import type { SharePointPerson } from "@/types/company";
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
  overdue: "border-thermal-red/30 bg-thermal-red/[0.06] text-thermal-red",
  due_today: "border-upcycle-orange/30 bg-upcycle-orange/[0.06] text-upcycle-orange",
  attention: "border-upcycle-orange/25 bg-upcycle-orange/[0.05] text-upcycle-orange",
  on_track: "border-carbon-blue/12 bg-carbon-blue/[0.02] text-carbon-blue/45",
} as const;

export function ActivityIntelligentTable({
  rows,
  primaryFocusActivityId,
  onOpen,
  embedded = false,
  assigneeOptions = [],
  currentUser = null,
  onSharedWithChange,
}: {
  rows: ActivityIntelligentRow[];
  primaryFocusActivityId?: string | null;
  onOpen?: (activityId: string) => void;
  /** When true, omit outer panel — parent provides the shell */
  embedded?: boolean;
  assigneeOptions?: SharePointPerson[];
  currentUser?: SharePointPerson | null;
  onSharedWithChange?: (
    activity: Activity,
    sharedWith: SharePointPerson[],
  ) => void | Promise<void>;
}) {
  if (rows.length === 0) {
    return (
      <p className={`px-6 py-12 text-center ${EDITORIAL_EMPTY}`}>
        No activities match this filter.
      </p>
    );
  }

  const table = (
    <div className="overflow-x-auto">
      <WorkspaceTable className="min-w-[960px]">
          <colgroup>
            <col className="w-[20%]" />
            <col className="w-[22%]" />
            <col className="w-[20%]" />
            <col className="w-[18%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
          </colgroup>
          <WorkspaceTableHead>
            <WorkspaceTableHeadRow>
              <WorkspaceTableHeadCell>Activity</WorkspaceTableHeadCell>
              <WorkspaceTableHeadCell>Attention</WorkspaceTableHeadCell>
              <WorkspaceTableHeadCell>Blocking progress</WorkspaceTableHeadCell>
              <WorkspaceTableHeadCell>Next step</WorkspaceTableHeadCell>
              <WorkspaceTableHeadCell align="right">Due</WorkspaceTableHeadCell>
              <WorkspaceTableHeadCell>Share</WorkspaceTableHeadCell>
            </WorkspaceTableHeadRow>
          </WorkspaceTableHead>
          <WorkspaceTableBody>
            {rows.map((row) => (
              <ActivityIntelligentTableRow
                key={row.id}
                row={row}
                primaryFocusActivityId={primaryFocusActivityId}
                onOpen={onOpen}
                assigneeOptions={assigneeOptions}
                currentUser={currentUser}
                onSharedWithChange={onSharedWithChange}
              />
            ))}
          </WorkspaceTableBody>
        </WorkspaceTable>
      </div>
  );

  if (embedded) return table;

  return <div className={`${WORKSPACE_PANEL_SURFACE} overflow-hidden p-0`}>{table}</div>;
}

function ActivityIntelligentTableRow({
  row,
  primaryFocusActivityId,
  onOpen,
  assigneeOptions = [],
  currentUser = null,
  onSharedWithChange,
}: {
  row: ActivityIntelligentRow;
  primaryFocusActivityId?: string | null;
  onOpen?: (activityId: string) => void;
  assigneeOptions?: SharePointPerson[];
  currentUser?: SharePointPerson | null;
  onSharedWithChange?: (
    activity: Activity,
    sharedWith: SharePointPerson[],
  ) => void | Promise<void>;
}) {
  const isPrimaryFocus = primaryFocusActivityId === row.id;
  const href = `/activities/${row.activity.ActivityID}`;
  const attention = attentionMeta(row);
  const isTask = row.activity.ActivityType === "Task";
  const sharedCount = row.activity.SharedWith?.length ?? 0;

  return (
    <WorkspaceTableBodyRow
      className={`cursor-pointer ${
        isPrimaryFocus
          ? "border-l-[3px] border-l-upcycle-orange/70 bg-upcycle-orange/[0.04]"
          : row.priority === "urgent"
            ? "bg-thermal-red/[0.02]"
            : row.requiresAttention
              ? "bg-carbon-blue/[0.015]"
              : undefined
      }`}
      onClick={() => onOpen?.(row.activity.ActivityID)}
    >
      <WorkspaceTableBodyCell>
        {isPrimaryFocus ? (
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-upcycle-orange">
            Primary focus
          </p>
        ) : null}
        <Link
          href={href}
          onClick={(event) => event.stopPropagation()}
          className="block text-[13px] font-semibold leading-snug text-carbon-blue hover:text-upcycle-orange"
        >
          {row.headline}
        </Link>
        <p className="mt-1 truncate text-[11px] text-carbon-blue/45">
          {[
            row.companyLabel,
            row.dealLabel !== "—" ? row.dealLabel : null,
            row.activity.ActivityType,
            row.activity.ActivityOwner?.Title
              ? `Assignee: ${row.activity.ActivityOwner.Title}`
              : null,
            sharedCount > 0 ? `Shared: ${sharedCount}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </WorkspaceTableBodyCell>

      <WorkspaceTableBodyCell>
        <span
          className={`inline-flex border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ATTENTION_STYLES[attention.tone]}`}
        >
          {attention.label}
        </span>
        <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-carbon-blue/65">
          {row.whyItMatters}
        </p>
      </WorkspaceTableBodyCell>

      <WorkspaceTableBodyCell>
        <p className="line-clamp-2 text-[12px] leading-relaxed text-carbon-blue/70">
          {row.blockingProgress}
        </p>
      </WorkspaceTableBodyCell>

      <WorkspaceTableBodyCell>
        <p className="line-clamp-2 text-[12px] font-medium leading-relaxed text-carbon-blue/85">
          {row.recommendedAction}
        </p>
      </WorkspaceTableBodyCell>

      <WorkspaceTableBodyCell className="text-right align-top">
        <DueLabel row={row} />
      </WorkspaceTableBodyCell>

      <WorkspaceTableBodyCell className="align-top overflow-visible">
        {isTask && onSharedWithChange && assigneeOptions.length > 0 ? (
          <div onClick={(event) => event.stopPropagation()}>
            <TaskShareControl
              activity={row.activity}
              options={assigneeOptions}
              currentUser={currentUser}
              onSharedWithChange={(sharedWith) =>
                onSharedWithChange(row.activity, sharedWith)
              }
              compact
            />
          </div>
        ) : (
          <span className="text-[11px] text-carbon-blue/35">—</span>
        )}
      </WorkspaceTableBodyCell>
    </WorkspaceTableBodyRow>
  );
}

function DueLabel({ row }: { row: ActivityIntelligentRow }) {
  const label = row.timingLabel ?? "—";
  const className =
    row.priority === "urgent"
      ? "text-thermal-red font-semibold"
      : row.priority === "high"
        ? "text-upcycle-orange font-medium"
        : "text-carbon-blue/50";

  return <span className={`text-[12px] tabular-nums ${className}`}>{label}</span>;
}

function attentionMeta(row: ActivityIntelligentRow): {
  label: string;
  tone: keyof typeof ATTENTION_STYLES;
} {
  if (row.timingLabel === "Overdue") {
    return { label: "Overdue", tone: "overdue" };
  }
  if (row.timingLabel === "Due today") {
    return { label: "Due today", tone: "due_today" };
  }
  if (row.requiresAttention) {
    return { label: "Attention", tone: "attention" };
  }
  return { label: "On track", tone: "on_track" };
}
