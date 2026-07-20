import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Activity } from "@/types/activity";
import { ActivityTypeIcon } from "@/components/activities/activity-type-icon";
import { buildRelationshipMemory } from "@/lib/relationship-memory";
import { formatRelativeTime } from "@/lib/relative-time";

export function DashboardRecentActivity({
  activities,
}: {
  activities: Activity[];
}) {
  return (
    <section className="dashboard-card flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-carbon-blue/8 px-4 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-carbon-blue">Recent Activity</h2>
          <p className="mt-0.5 text-[11px] text-carbon-blue/45">Relationship memory at a glance</p>
        </div>
        <Link
          href="/activities"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-upcycle-orange"
        >
          Timeline
          <ArrowRight className="size-3" />
        </Link>
      </header>

      <ul className="flex-1 divide-y divide-carbon-blue/6">
        {activities.map((activity) => {
          const memory = buildRelationshipMemory(activity);

          return (
            <li key={activity.ActivityID}>
              <Link
                href={`/activities/${activity.ActivityID}`}
                className="group block px-4 py-3.5 transition-colors hover:bg-carbon-blue/[0.02]"
              >
                <div className="flex gap-3">
                  <ActivityTypeIcon type={activity.ActivityType} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-carbon-blue/50">
                        {activity.ActivityType}
                      </p>
                      <time className="shrink-0 text-[10px] text-carbon-blue/40">
                        {formatRelativeTime(activity.ActivityDate)}
                      </time>
                    </div>
                    {activity.Company?.Title ? (
                      <p className="mt-0.5 text-xs font-semibold text-carbon-blue group-hover:text-upcycle-orange">
                        {activity.Company.Title}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/70">
                      {memory.summary}
                    </p>
                    {memory.whatHappensNext ? (
                      <p className="mt-1.5 text-[10px] font-medium text-upcycle-orange">
                        Next: {memory.whatHappensNext}
                      </p>
                    ) : null}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
