"use client";

import Link from "next/link";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { ActivityTimeline } from "@/components/activities/activity-timeline";
import { isFollowUpOpen } from "@/lib/activity-utils";

type ActivityContextPanelProps = {
  activity: Activity;
  companies: Company[];
  pipelines: PipelineRow[];
  allActivities: Activity[];
};

export function ActivityContextPanel({
  activity,
  companies,
  pipelines,
  allActivities,
}: ActivityContextPanelProps) {
  const company = companies.find(
    (c) => c.Title === activity.Company?.Title,
  );
  const deal = pipelines.find((p) => p.id === activity.Deal?.Title);

  const relatedActivities = allActivities
    .filter((a) => a.ActivityID !== activity.ActivityID)
    .filter((a) => {
      if (activity.Company?.Title && a.Company?.Title === activity.Company.Title) {
        return true;
      }
      if (activity.Contact?.Title && a.Contact?.Title === activity.Contact.Title) {
        return true;
      }
      if (activity.Deal?.Title && a.Deal?.Title === activity.Deal.Title) return true;
      return false;
    })
    .slice(0, 5);

  const upcoming = allActivities.filter(isFollowUpOpen).slice(0, 4);

  return (
    <aside className="flex flex-col gap-3">
      <ContextBlock title="Related Company">
        {activity.Company?.Title ? (
          <Link
            href="/companies"
            className="text-sm font-semibold text-carbon-blue hover:text-upcycle-orange"
          >
            {activity.Company.Title}
          </Link>
        ) : (
          <p className="text-xs text-carbon-blue/45">—</p>
        )}
      </ContextBlock>

      <ContextBlock title="Related Contact">
        {activity.Contact?.Title ? (
          <Link
            href="/contacts"
            className="text-sm font-semibold text-carbon-blue hover:text-upcycle-orange"
          >
            {activity.Contact.Title}
          </Link>
        ) : (
          <p className="text-xs text-carbon-blue/45">—</p>
        )}
      </ContextBlock>

      <ContextBlock title="Related Deal">
        {deal ? (
          <>
            <p className="text-sm font-semibold text-carbon-blue">{deal.assetName}</p>
            <p className="font-mono text-[10px] text-upcycle-orange">{deal.id}</p>
          </>
        ) : activity.Deal?.Title ? (
          <p className="font-mono text-xs text-upcycle-orange">{activity.Deal.Title}</p>
        ) : (
          <p className="text-xs text-carbon-blue/45">—</p>
        )}
      </ContextBlock>

      <ContextBlock title="Recent Activities">
        {relatedActivities.length > 0 ? (
          <ActivityTimeline activities={relatedActivities} compact />
        ) : (
          <p className="text-xs text-carbon-blue/45">No related history.</p>
        )}
      </ContextBlock>

      <ContextBlock title="Upcoming Follow-Ups">
        {upcoming.length > 0 ? (
          <ul className="space-y-2">
            {upcoming.map((a) => (
              <li key={a.ActivityID}>
                <Link
                  href={`/activities/${a.ActivityID}`}
                  className="block text-xs text-carbon-blue/75 hover:text-upcycle-orange"
                >
                  {a.NextAction}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-carbon-blue/45">None scheduled.</p>
        )}
      </ContextBlock>
    </aside>
  );
}

function ContextBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-carbon-blue/10 bg-white p-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
        {title}
      </h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}
