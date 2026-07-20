"use client";

import Link from "next/link";
import type { Activity } from "@/types/activity";
import {
  formatDueDate,
  isFollowUpOpen,
  isFollowUpOverdue,
} from "@/lib/activity-utils";

export function OpportunityOpenCommitments({
  activities,
  dealId,
}: {
  activities: Activity[];
  dealId: string;
}) {
  const open = activities
    .filter(isFollowUpOpen)
    .sort((a, b) => {
      const aOverdue = isFollowUpOverdue(a) ? 0 : 1;
      const bOverdue = isFollowUpOverdue(b) ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      return (a.NextActionDate || "").localeCompare(b.NextActionDate || "");
    });

  if (open.length === 0) {
    return (
      <p className="text-[11px] text-carbon-blue/45">
        No open commitments on this opportunity.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {open.slice(0, 6).map((activity) => {
        const overdue = isFollowUpOverdue(activity);
        return (
          <li key={activity.ActivityID}>
            <Link
              href={`/activities/${activity.ActivityID}`}
              className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors hover:bg-carbon-blue/[0.02] ${
                overdue ? "border-red-500/25 bg-red-500/[0.03]" : "border-carbon-blue/10"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium text-carbon-blue">
                  {activity.NextAction || activity.Subject}
                </p>
                <p className="text-[10px] text-carbon-blue/45">{activity.Subject}</p>
              </div>
              <div className="shrink-0 text-right">
                {activity.NextActionDate ? (
                  <p
                    className={`text-[10px] font-medium ${
                      overdue ? "text-red-700" : "text-carbon-blue/50"
                    }`}
                  >
                    {overdue ? "Overdue · " : "Due "}
                    {formatDueDate(activity.NextActionDate)}
                  </p>
                ) : null}
                {overdue ? (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-red-600">
                    Action required
                  </span>
                ) : null}
              </div>
            </Link>
          </li>
        );
      })}
      {open.length > 6 ? (
        <Link
          href={`/deals/${encodeURIComponent(dealId)}?tab=activities`}
          className="inline-block text-[10px] font-semibold text-upcycle-orange hover:underline"
        >
          View all {open.length} commitments →
        </Link>
      ) : null}
    </ul>
  );
}
