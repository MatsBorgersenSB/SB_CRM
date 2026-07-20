"use client";

import type { ActivityIntelligence } from "@/lib/activity-utils";
import { formatDueDate } from "@/lib/activity-utils";

type ActivityIntelligenceProps = {
  intelligence: ActivityIntelligence;
};

export function ActivityIntelligencePanel({ intelligence }: ActivityIntelligenceProps) {
  const hasOverdue = intelligence.overdueFollowUps > 0;

  return (
    <div className="dashboard-card flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Open follow-ups
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-carbon-blue">
            {intelligence.openFollowUps}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Overdue
          </p>
          <p
            className={`mt-1 text-2xl font-semibold tabular-nums ${
              hasOverdue ? "text-red-600" : "text-carbon-blue"
            }`}
          >
            {intelligence.overdueFollowUps}
          </p>
        </div>
      </div>

      {intelligence.upcomingActions.length > 0 ? (
        <div className="min-w-0 flex-1 sm:max-w-md sm:border-l sm:border-carbon-blue/8 sm:pl-6">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Next due
          </p>
          <ul className="mt-2 space-y-2">
            {intelligence.upcomingActions.slice(0, 2).map((activity) => (
              <li
                key={activity.ActivityID}
                className="flex items-start justify-between gap-3 text-xs"
              >
                <span className="truncate text-carbon-blue/80">{activity.NextAction}</span>
                <span className="shrink-0 font-mono text-[10px] text-carbon-blue/45">
                  {formatDueDate(activity.NextActionDate)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
