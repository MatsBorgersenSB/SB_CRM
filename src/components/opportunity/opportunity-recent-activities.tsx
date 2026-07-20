"use client";

import Link from "next/link";
import type { Activity } from "@/types/activity";
import { ActivityTypeIcon } from "@/components/activities/activity-type-icon";
import { formatActivityDateTime } from "@/lib/activity-utils";
import { buildRelationshipMemory } from "@/lib/relationship-memory";

export function OpportunityRecentActivities({
  activities,
  dealId,
}: {
  activities: Activity[];
  dealId: string;
}) {
  const recent = [...activities]
    .sort(
      (a, b) =>
        new Date(b.ActivityDate).getTime() - new Date(a.ActivityDate).getTime(),
    )
    .slice(0, 5);

  if (recent.length === 0) {
    return (
      <p className="text-[11px] text-carbon-blue/45">
        No activities logged yet — record your first customer interaction.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {recent.map((activity) => {
        const memory = buildRelationshipMemory(activity);
        return (
          <li key={activity.ActivityID}>
            <Link
              href={`/activities/${activity.ActivityID}`}
              className="flex items-start gap-2.5 rounded-lg border border-carbon-blue/10 px-3 py-2 transition-colors hover:border-upcycle-orange/20 hover:bg-upcycle-orange/[0.02]"
            >
              <ActivityTypeIcon type={activity.ActivityType} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-carbon-blue">
                  {activity.Subject}
                </p>
                <p className="mt-0.5 line-clamp-1 text-[10px] text-carbon-blue/50">
                  {memory.summary}
                </p>
                <p className="mt-0.5 text-[9px] text-carbon-blue/35">
                  {formatActivityDateTime(activity.ActivityDate)}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
      <Link
        href={`/deals/${encodeURIComponent(dealId)}?tab=activities`}
        className="inline-block text-[10px] font-semibold text-upcycle-orange hover:underline"
      >
        Open full activity workspace →
      </Link>
    </ul>
  );
}
