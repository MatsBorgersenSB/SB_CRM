"use client";

import type { Activity } from "@/types/activity";
import { ActivityCard } from "@/components/activities/activity-card";
import { groupActivitiesByDate } from "@/lib/activity-utils";

type ActivityTimelineProps = {
  activities: Activity[];
  onSelect?: (activity: Activity) => void;
  compact?: boolean;
  emptyMessage?: string;
  /** Relationship Memory rail — vertical timeline connector */
  showRail?: boolean;
};

export function ActivityTimeline({
  activities,
  onSelect,
  compact = false,
  emptyMessage = "No activities recorded yet.",
  showRail = true,
}: ActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center border border-dashed border-carbon-blue/15 bg-carbon-blue/[0.02] px-6 py-10 text-center">
        <p className="text-xs text-carbon-blue/50">{emptyMessage}</p>
        <p className="mt-1 max-w-sm text-[11px] text-carbon-blue/40">
          The timeline becomes the memory of every relationship.
        </p>
      </div>
    );
  }

  const groups = groupActivitiesByDate(activities);

  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <section key={group.label}>
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-carbon-blue/40">
            {group.label}
          </h3>
          <div className="flex flex-col">
            {group.activities.map((activity, index) => (
              <ActivityCard
                key={activity.ActivityID}
                activity={activity}
                onSelect={onSelect}
                compact={compact}
                showRail={showRail && !compact}
                isLastInGroup={index === group.activities.length - 1}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** @deprecated Use ActivityTimeline */
export function InteractionStream({
  interactions,
  onSelect,
}: {
  interactions: Activity[];
  onSelect?: (activity: Activity) => void;
}) {
  return (
    <ActivityTimeline
      activities={interactions}
      onSelect={onSelect}
      compact
      showRail={false}
      emptyMessage="No interactions recorded for this contact."
    />
  );
}
