"use client";

import Link from "next/link";
import type { ActivityFocusItem } from "@/lib/activity-mission-control";
import type { Activity } from "@/types/activity";
import { EDITORIAL_BODY, EDITORIAL_BODY_MUTED, EDITORIAL_META } from "@/lib/editorial-design-system";

export function ActivityFocusCard({
  item,
  onOpen,
  prominent = false,
}: {
  item: ActivityFocusItem;
  onOpen?: (activityId: string) => void;
  prominent?: boolean;
}) {
  const { activity } = item;

  return (
    <article
      className={
        prominent
          ? "max-w-2xl"
          : item.priority === "urgent"
            ? "border-l-2 border-thermal-red/70 pl-4"
            : ""
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => onOpen?.(activity.ActivityID)}
            className={`text-left ${prominent ? "text-xl font-semibold tracking-tight text-carbon-blue" : "text-[14px] font-medium text-carbon-blue"}`}
          >
            {item.headline}
          </button>
          {item.timingLabel ? (
            <p
              className={`mt-1.5 ${EDITORIAL_META} ${
                item.priority === "urgent" ? "text-thermal-red/90" : ""
              }`}
            >
              {item.timingLabel}
            </p>
          ) : null}
          {prominent ? (
            <>
              <p className={`mt-4 ${EDITORIAL_BODY_MUTED}`}>{item.whyItMatters}</p>
              <p className={`mt-3 ${EDITORIAL_BODY}`}>{item.recommendedAction}</p>
              <Link
                href={`/activities/${activity.ActivityID}`}
                className="mt-4 inline-block text-[12px] font-medium text-upcycle-orange hover:text-upcycle-orange/80"
              >
                Open activity
              </Link>
            </>
          ) : (
            <>
              <p className={`mt-2 ${EDITORIAL_BODY_MUTED}`}>{item.recommendedAction}</p>
              <p className={`mt-1 ${EDITORIAL_META}`}>
                {[activity.Company?.Title, activity.Deal?.Title].filter(Boolean).join(" · ")}
              </p>
            </>
          )}
        </div>
        {!prominent ? (
          <Link
            href={`/activities/${activity.ActivityID}`}
            className="shrink-0 text-[12px] font-medium text-upcycle-orange hover:text-upcycle-orange/80"
          >
            Open
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export function ActivityHistoryRow({
  activity,
  expanded,
  onToggle,
}: {
  activity: Activity;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="border-b border-carbon-blue/8 py-3 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div className="min-w-0">
          <p className="text-[13px] text-carbon-blue/85">{activity.Subject}</p>
          <p className={`mt-0.5 ${EDITORIAL_META}`}>
            {[activity.Company?.Title, activity.ActivityType].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className={`shrink-0 ${EDITORIAL_META}`}>
          {new Date(activity.ActivityDate).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
          })}
        </span>
      </button>
      {expanded ? (
        <div className="mt-2 pl-0">
          <p className={EDITORIAL_BODY_MUTED}>
            {activity.Summary?.trim() || activity.ActivityDescription?.trim() || "Completed activity."}
          </p>
          <Link
            href={`/activities/${activity.ActivityID}`}
            className="mt-2 inline-block text-[12px] font-medium text-upcycle-orange hover:text-upcycle-orange/80"
          >
            View details
          </Link>
        </div>
      ) : null}
    </li>
  );
}
