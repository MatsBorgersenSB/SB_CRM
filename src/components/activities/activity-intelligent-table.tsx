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

/** Attention as one coloured dot in front of the blocker; the title names it. */
const ATTENTION_DOT = {
  overdue: "bg-thermal-red",
  due_today: "bg-upcycle-orange",
  attention: "bg-upcycle-orange",
  on_track: "bg-emerald-500",
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
    <div className="w-full">
      <WorkspaceTable>
          <colgroup>
            <col className="w-[30%]" />
            <col className="w-[26%]" />
            <col className="w-[24%]" />
            <col className="w-[11%]" />
            <col className="w-[9%]" />
          </colgroup>
          <WorkspaceTableHead>
            <WorkspaceTableHeadRow>
              <WorkspaceTableHeadCell>Activity</WorkspaceTableHeadCell>
              <WorkspaceTableHeadCell>What&apos;s blocking</WorkspaceTableHeadCell>
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
        <Link
          href={href}
          onClick={(event) => event.stopPropagation()}
          className="block text-[14px] font-semibold leading-snug text-carbon-blue hover:text-upcycle-orange"
        >
          {row.headline}
        </Link>
        <p className="mt-1 truncate text-[13px] text-carbon-blue/65">
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
        <div className="flex items-start gap-2">
          <span
            className={`mt-[7px] size-2 shrink-0 rounded-full ${ATTENTION_DOT[attention.tone]}`}
            title={attention.label}
            aria-label={attention.label}
            role="img"
          />
          <p className="line-clamp-2 text-[13px] leading-relaxed text-carbon-blue">
            {row.blockingProgress}
          </p>
        </div>
      </WorkspaceTableBodyCell>

      <WorkspaceTableBodyCell>
        <p className="line-clamp-2 text-[13px] leading-relaxed text-carbon-blue">
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
        ) : null}
      </WorkspaceTableBodyCell>
    </WorkspaceTableBodyRow>
  );
}

function DueLabel({ row }: { row: ActivityIntelligentRow }) {
  if (!row.timingLabel) return null;
  const className =
    row.priority === "urgent"
      ? "text-thermal-red font-semibold"
      : row.priority === "high"
        ? "text-upcycle-orange font-medium"
        : "text-carbon-blue/70";

  return <span className={`text-[13px] tabular-nums ${className}`}>{row.timingLabel}</span>;
}

function attentionMeta(row: ActivityIntelligentRow): {
  label: string;
  tone: keyof typeof ATTENTION_DOT;
} {
  if (row.timingLabel === "Overdue") {
    return { label: "Overdue", tone: "overdue" };
  }
  if (row.timingLabel === "Due today") {
    return { label: "Due today", tone: "due_today" };
  }
  if (row.requiresAttention) {
    return { label: "Needs attention", tone: "attention" };
  }
  return { label: "On track", tone: "on_track" };
}
