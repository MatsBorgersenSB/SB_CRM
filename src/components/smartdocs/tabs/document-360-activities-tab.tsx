import Link from "next/link";
import type { Document360Snapshot } from "@/lib/document-360-data";
import { formatRelativeTime } from "@/lib/relative-time";
import { ActivityTypeIcon } from "@/components/activities/activity-type-icon";

export function Document360ActivitiesTab({ snapshot }: { snapshot: Document360Snapshot }) {
  const { activities, intelligence } = snapshot;

  return (
    <section className="dashboard-card">
      <header className="border-b border-carbon-blue/8 px-5 py-4">
        <h2 className="text-sm font-semibold text-carbon-blue">Activity references</h2>
        <p className="mt-0.5 text-[11px] text-carbon-blue/45">
          {intelligence.insights.usageFrequencyLabel} usage · {activities.length} linked activit
          {activities.length === 1 ? "y" : "ies"}
        </p>
      </header>
      {activities.length === 0 ? (
        <p className="px-5 py-8 text-sm text-carbon-blue/45">
          No activity references — this document has no tracked usage trail.
        </p>
      ) : (
        <ul className="divide-y divide-carbon-blue/6">
          {activities.map((activity) => (
            <li key={activity.ActivityID}>
              <Link
                href={`/activities/${activity.ActivityID}`}
                className="flex items-start gap-3 px-5 py-4 hover:bg-carbon-blue/[0.02]"
              >
                <ActivityTypeIcon type={activity.ActivityType} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-carbon-blue">{activity.Subject}</p>
                  <p className="mt-0.5 text-[10px] text-carbon-blue/45">
                    {activity.ActivityType} · {formatRelativeTime(activity.ActivityDate)}
                  </p>
                  {activity.Company?.Title ? (
                    <p className="mt-0.5 text-[10px] text-carbon-blue/40">
                      {activity.Company.Title}
                    </p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
