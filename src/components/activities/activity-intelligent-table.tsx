"use client";

import Link from "next/link";
import { TaskAssigneeSelect } from "@/components/activities/task-assignee-select";
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
  onAssigneeChange,
  onToggleComplete,
}: {
  rows: ActivityIntelligentRow[];
  primaryFocusActivityId?: string | null;
  onOpen?: (activityId: string) => void;
  /** When true, omit outer panel — parent provides the shell */
  embedded?: boolean;
  assigneeOptions?: SharePointPerson[];
  onAssigneeChange?: (
    activity: Activity,
    assignee: SharePointPerson,
  ) => void | Promise<void>;
  onToggleComplete?: (activity: Activity, completed: boolean) => void | Promise<void>;
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
            <col className="w-[28%]" />
            <col className="w-[24%]" />
            <col className="w-[22%]" />
            <col className="w-[10%]" />
            <col className="w-[16%]" />
          </colgroup>
          <WorkspaceTableHead>
            <WorkspaceTableHeadRow>
              <WorkspaceTableHeadCell>Activity</WorkspaceTableHeadCell>
              <WorkspaceTableHeadCell>What&apos;s blocking</WorkspaceTableHeadCell>
              <WorkspaceTableHeadCell>Next step</WorkspaceTableHeadCell>
              <WorkspaceTableHeadCell align="right">Due</WorkspaceTableHeadCell>
              <WorkspaceTableHeadCell>Assign</WorkspaceTableHeadCell>
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
                onAssigneeChange={onAssigneeChange}
                onToggleComplete={onToggleComplete}
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
  onAssigneeChange,
  onToggleComplete,
}: {
  row: ActivityIntelligentRow;
  primaryFocusActivityId?: string | null;
  onOpen?: (activityId: string) => void;
  assigneeOptions?: SharePointPerson[];
  onAssigneeChange?: (
    activity: Activity,
    assignee: SharePointPerson,
  ) => void | Promise<void>;
  onToggleComplete?: (activity: Activity, completed: boolean) => void | Promise<void>;
}) {
  const isPrimaryFocus = primaryFocusActivityId === row.id;
  const href = `/activities/${row.activity.ActivityID}`;
  const attention = attentionMeta(row);
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
        <div className="flex items-start gap-3">
          {onToggleComplete ? (
            <input
              type="checkbox"
              checked={row.isCompleted}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => void onToggleComplete(row.activity, event.target.checked)}
              aria-label={row.isCompleted ? "Mark as not done" : "Mark as done"}
              title={row.isCompleted ? "Done — click to reopen" : "Mark as done"}
              className="mt-[3px] size-4 shrink-0 cursor-pointer accent-emerald-600"
            />
          ) : null}
          <div className={`min-w-0 ${row.isCompleted ? "opacity-60" : ""}`}>
            <Link
              href={href}
              onClick={(event) => event.stopPropagation()}
              className={`block text-[14px] font-semibold leading-snug text-carbon-blue hover:text-upcycle-orange ${
                row.isCompleted ? "line-through" : ""
              }`}
            >
              {row.headline}
            </Link>
            <p className="mt-1 truncate text-[13px] text-carbon-blue/65">
              {[
                row.companyLabel,
                row.dealLabel !== "—" ? row.dealLabel : null,
                row.activity.ActivityType,
                sharedCount > 0 ? `Shared: ${sharedCount}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
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
        <div onClick={(event) => event.stopPropagation()}>
          {onAssigneeChange && assigneeOptions.length > 0 ? (
            <TaskAssigneeSelect
              value={row.activity.ActivityOwner}
              onChange={(next) => void onAssigneeChange(row.activity, next)}
              options={assigneeOptions}
              label="Assign to"
              compact
            />
          ) : row.activity.ActivityOwner?.Title ? (
            <span className="text-[12px] text-carbon-blue/70">
              {row.activity.ActivityOwner.Title}
            </span>
          ) : (
            <span className="text-[12px] text-carbon-blue/40">Unassigned</span>
          )}
        </div>
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
