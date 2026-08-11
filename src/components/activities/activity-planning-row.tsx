"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Calendar, Clock, User } from "lucide-react";
import { ActivityTypeIcon } from "@/components/activities/activity-type-icon";
import { TaskAssigneeSelect } from "@/components/activities/task-assignee-select";
import { TaskShareControl } from "@/components/activities/task-share-control";
import {
  formatActivityTime,
  formatDuration,
  priorityBadgeClass,
  statusBadgeClass,
} from "@/lib/activity-workspace";
import {
  formatActivityDateTime,
  formatDueDate,
  isFollowUpOverdue,
} from "@/lib/activity-utils";
import type { Activity, ActionStatus } from "@/types/activity";
import type { M365ActivityTargets } from "@/types/activity";
import type { SharePointPerson } from "@/types/company";

type ActivityPlanningRowProps = {
  activity: Activity;
  onSelect?: (activity: Activity) => void;
  onStatusChange?: (activity: Activity, status: ActionStatus) => void;
  onAssigneeChange?: (activity: Activity, assignee: SharePointPerson) => void;
  onSharedWithChange?: (
    activity: Activity,
    sharedWith: SharePointPerson[],
  ) => void;
  assigneeOptions?: SharePointPerson[];
  currentUser?: SharePointPerson | null;
  compact?: boolean;
};

function M365ReadinessBadges({ targets }: { targets?: M365ActivityTargets }) {
  if (!targets) return null;
  const items: { key: keyof M365ActivityTargets; label: string }[] = [
    { key: "outlook", label: "Outlook" },
    { key: "teams", label: "Teams" },
    { key: "planner", label: "Planner" },
    { key: "onenote", label: "OneNote" },
  ];

  const active = items.filter((item) => targets[item.key]);
  if (active.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {active.map((item) => (
        <span
          key={item.key}
          className="border border-carbon-blue/10 bg-carbon-blue/[0.03] px-1.5 py-0.5 text-[9px] font-medium text-carbon-blue/45"
          title={`M365 ${item.label} ready`}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function ActivityPlanningRow({
  activity,
  onSelect,
  onStatusChange,
  onAssigneeChange,
  onSharedWithChange,
  assigneeOptions = [],
  currentUser = null,
  compact = false,
}: ActivityPlanningRowProps) {
  const overdue = isFollowUpOverdue(activity);
  const detailHref = `/activities/${activity.ActivityID}`;
  const isTask = activity.ActivityType === "Task";

  return (
    <article
      className={`group flex gap-3 border border-carbon-blue/10 bg-white p-3 transition-colors hover:border-carbon-blue/20 ${
        overdue ? "border-l-2 border-l-red-500" : ""
      }`}
    >
      <ActivityTypeIcon type={activity.ActivityType} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => onSelect?.(activity)}
            className="text-left"
          >
            <p className="text-xs font-semibold text-carbon-blue group-hover:text-upcycle-orange">
              {activity.Subject}
            </p>
            {activity.Summary && !compact ? (
              <p className="mt-0.5 line-clamp-1 text-[11px] text-carbon-blue/55">
                {activity.Summary}
              </p>
            ) : null}
          </button>
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${statusBadgeClass(activity.ActionStatus)}`}
            >
              {activity.ActionStatus === "Open" && !isTask
                ? "Planned"
                : activity.ActionStatus}
            </span>
            {activity.Priority ? (
              <span
                className={`text-[9px] font-semibold uppercase ${priorityBadgeClass(activity.Priority)}`}
              >
                {activity.Priority}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-carbon-blue/50">
          <span className="inline-flex items-center gap-1">
            <Calendar className="size-3" strokeWidth={2} />
            {isTask ? (
              <>Due {formatDueDate(activity.NextActionDate || activity.ActivityDate)}</>
            ) : (
              formatActivityDateTime(activity.ActivityDate)
            )}
          </span>
          {activity.DurationMinutes && !isTask ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" strokeWidth={2} />
              {formatDuration(activity.DurationMinutes)}
            </span>
          ) : null}
          {isTask && onAssigneeChange && assigneeOptions.length > 0 ? (
            <div className="min-w-[160px]">
              <TaskAssigneeSelect
                value={activity.ActivityOwner}
                onChange={(next) => onAssigneeChange(activity, next)}
                options={assigneeOptions}
                label="Assignee"
                compact
              />
            </div>
          ) : activity.ActivityOwner?.Title ? (
            <span className="inline-flex items-center gap-1">
              <User className="size-3" strokeWidth={2} />
              {activity.ActivityOwner.Title}
            </span>
          ) : null}
          {!isTask && activity.NextAction && activity.ActionRequired ? (
            <span className={overdue ? "font-semibold text-red-600" : ""}>
              Due {formatDueDate(activity.NextActionDate)} — {activity.NextAction}
            </span>
          ) : null}
        </div>

        {(!compact ||
          (isTask && onSharedWithChange && assigneeOptions.length > 0)) ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            {!compact ? <M365ReadinessBadges targets={activity.M365Targets} /> : <span />}
            <div className="flex items-center gap-2">
              {isTask && onSharedWithChange && assigneeOptions.length > 0 ? (
                <TaskShareControl
                  activity={activity}
                  options={assigneeOptions}
                  currentUser={currentUser}
                  onSharedWithChange={(sharedWith) =>
                    onSharedWithChange(activity, sharedWith)
                  }
                  compact
                />
              ) : null}
              {!compact && onStatusChange && activity.ActionStatus !== "Completed" ? (
                <>
                  {activity.ActionStatus !== "In Progress" ? (
                    <button
                      type="button"
                      onClick={() => onStatusChange(activity, "In Progress")}
                      className="text-[10px] font-semibold text-upcycle-orange hover:underline"
                    >
                      Start
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onStatusChange(activity, "Completed")}
                    className="text-[10px] font-semibold text-emerald-700 hover:underline"
                  >
                    Complete
                  </button>
                </>
              ) : null}
              {!compact ? (
                <Link
                  href={detailHref}
                  className="text-[10px] font-semibold text-carbon-blue/45 hover:text-upcycle-orange"
                >
                  Details →
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function ActivityWorkspaceSection({
  title,
  count,
  children,
  emptyMessage,
}: {
  title: string;
  count: number;
  children: ReactNode;
  emptyMessage?: string;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-carbon-blue/45">
        {title}
        <span className="font-mono text-carbon-blue/30">({count})</span>
      </h3>
      {count === 0 && emptyMessage ? (
        <p className="border border-dashed border-carbon-blue/12 bg-carbon-blue/[0.02] px-4 py-6 text-center text-[11px] text-carbon-blue/45">
          {emptyMessage}
        </p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </section>
  );
}
