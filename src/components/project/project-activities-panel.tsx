"use client";

import Link from "next/link";
import type { Activity } from "@/types/activity";

function ActivityBucket({
  title,
  activities,
  tone,
}: {
  title: string;
  activities: Activity[];
  tone: string;
}) {
  return (
    <div className={`border p-3 ${tone}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
        {title} · {activities.length}
      </p>
      {activities.length === 0 ? (
        <p className="mt-2 text-[12px] text-carbon-blue/40">None</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {activities.slice(0, 5).map((activity) => (
            <li key={activity.ActivityID}>
              <Link
                href={`/activities/${activity.ActivityID}`}
                className="text-[13px] font-medium text-carbon-blue hover:text-upcycle-orange"
              >
                {activity.Subject || activity.ActivityType}
              </Link>
              <p className="text-[11px] text-carbon-blue/45">{activity.ActionStatus}</p>
            </li>
          ))}
          {activities.length > 5 ? (
            <li className="text-[11px] text-carbon-blue/40">+{activities.length - 5} more</li>
          ) : null}
        </ul>
      )}
    </div>
  );
}

export function ProjectActivitiesPanel({
  open,
  blocked,
  waiting,
  completed,
}: {
  open: Activity[];
  blocked: Activity[];
  waiting: Activity[];
  completed: Activity[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <ActivityBucket
        title="Open"
        activities={open}
        tone="border-carbon-blue/10 bg-white"
      />
      <ActivityBucket
        title="Blocked"
        activities={blocked}
        tone="border-red-200/60 bg-red-50/40"
      />
      <ActivityBucket
        title="Waiting"
        activities={waiting}
        tone="border-amber-200/60 bg-amber-50/40"
      />
      <ActivityBucket
        title="Completed"
        activities={completed}
        tone="border-emerald-200/60 bg-emerald-50/30"
      />
    </div>
  );
}
