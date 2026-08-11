"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import type { ActivityIntelligentRow } from "@/lib/activity-mission-control";
import {
  addDays,
  buildActivityScheduleItems,
  buildGanttRange,
  formatShortDay,
  ganttBarStyle,
  startOfDay,
  toDayKey,
  type ActivityScheduleItem,
} from "@/lib/activity-schedule-views";
import { EDITORIAL_EMPTY } from "@/lib/editorial-design-system";

function barTone(item: ActivityScheduleItem): string {
  if (item.isOverdue || item.row.priority === "urgent") {
    return "bg-thermal-red/80";
  }
  if (item.row.requiresAttention || item.row.priority === "high") {
    return "bg-upcycle-orange/85";
  }
  if (item.row.activity.ActivityType === "Task") {
    return "bg-carbon-blue/75";
  }
  return "bg-carbon-blue/45";
}

export function ActivityGanttView({
  rows,
  primaryFocusActivityId,
  onOpen,
}: {
  rows: ActivityIntelligentRow[];
  primaryFocusActivityId?: string | null;
  onOpen?: (activityId: string) => void;
}) {
  const [rangeOffsetWeeks, setRangeOffsetWeeks] = useState(0);

  const items = useMemo(() => buildActivityScheduleItems(rows), [rows]);

  const { days } = useMemo(() => {
    const base = buildGanttRange(items, 6);
    return {
      days: base.days.map((day) => addDays(day, rangeOffsetWeeks * 7)),
    };
  }, [items, rangeOffsetWeeks]);

  const rangeStart = days[0] ?? startOfDay(new Date());
  const todayKey = toDayKey(startOfDay(new Date()));
  const unscheduled = items.filter((item) => item.isUnscheduled);
  const scheduled = items.filter((item) => !item.isUnscheduled);

  if (rows.length === 0) {
    return (
      <p className={`px-6 py-12 text-center ${EDITORIAL_EMPTY}`}>
        No activities match this filter.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium text-carbon-blue/45">Gantt</p>
          <h3 className="text-[15px] font-semibold text-carbon-blue">
            {formatShortDay(days[0]!)} – {formatShortDay(days[days.length - 1]!)}
          </h3>
        </div>
        <div className="flex items-center border border-carbon-blue/10">
          <button
            type="button"
            aria-label="Previous weeks"
            onClick={() => setRangeOffsetWeeks((value) => value - 2)}
            className="px-2 py-1.5 text-carbon-blue/55 hover:text-upcycle-orange"
          >
            <ChevronLeft className="size-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => setRangeOffsetWeeks(0)}
            className="border-x border-carbon-blue/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/60 hover:text-upcycle-orange"
          >
            This window
          </button>
          <button
            type="button"
            aria-label="Next weeks"
            onClick={() => setRangeOffsetWeeks((value) => value + 2)}
            className="px-2 py-1.5 text-carbon-blue/55 hover:text-upcycle-orange"
          >
            <ChevronRight className="size-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border border-carbon-blue/10">
        <div className="min-w-[960px]">
          <div className="grid grid-cols-[220px_1fr] border-b border-carbon-blue/10 bg-carbon-blue/[0.02]">
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              Activity
            </div>
            <div
              className="grid"
              style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
            >
              {days.map((day) => {
                const key = toDayKey(day);
                const isMonday = day.getDay() === 1;
                const isToday = key === todayKey;
                return (
                  <div
                    key={key}
                    className={`border-l border-carbon-blue/8 px-0.5 py-2 text-center ${
                      isToday ? "bg-upcycle-orange/[0.08]" : ""
                    }`}
                  >
                    {isMonday || isToday ? (
                      <p
                        className={`text-[9px] font-semibold uppercase tracking-wide ${
                          isToday ? "text-upcycle-orange" : "text-carbon-blue/45"
                        }`}
                      >
                        {formatShortDay(day)}
                      </p>
                    ) : (
                      <p className="text-[9px] text-carbon-blue/25">{day.getDate()}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {scheduled.length === 0 ? (
            <p className={`px-4 py-10 text-center ${EDITORIAL_EMPTY}`}>
              No dated activities in this filter. Set a due date to place work on the timeline.
            </p>
          ) : (
            scheduled.map((item) => {
              const style = ganttBarStyle(item, rangeStart, days.length);
              return (
                <div
                  key={item.row.id}
                  className={`grid grid-cols-[220px_1fr] border-b border-carbon-blue/8 ${
                    primaryFocusActivityId === item.row.id
                      ? "bg-upcycle-orange/[0.03]"
                      : "bg-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onOpen?.(item.row.activity.ActivityID)}
                    className="truncate px-3 py-2.5 text-left text-[12px] font-medium text-carbon-blue hover:text-upcycle-orange"
                    title={item.row.headline}
                  >
                    {item.row.headline}
                    <span className="mt-0.5 block truncate text-[10px] font-normal text-carbon-blue/40">
                      {[
                        item.row.activity.ActivityType,
                        item.row.activity.ActivityOwner?.Title,
                        item.row.timingLabel,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </button>
                  <div className="relative py-2.5 pr-2">
                    <div
                      className="pointer-events-none absolute inset-y-0 left-0 right-0 grid"
                      style={{
                        gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
                      }}
                    >
                      {days.map((day) => (
                        <div
                          key={toDayKey(day)}
                          className={`border-l border-carbon-blue/6 ${
                            toDayKey(day) === todayKey
                              ? "bg-upcycle-orange/[0.05]"
                              : ""
                          }`}
                        />
                      ))}
                    </div>
                    {style ? (
                      <button
                        type="button"
                        onClick={() => onOpen?.(item.row.activity.ActivityID)}
                        className={`absolute top-1/2 h-6 -translate-y-1/2 rounded-sm px-2 text-left text-[10px] font-semibold text-white shadow-sm ${barTone(item)}`}
                        style={{
                          left: `calc(${style.leftPct}% + 2px)`,
                          width: `max(24px, calc(${style.widthPct}% - 4px))`,
                        }}
                        title={item.row.headline}
                      >
                        <span className="block truncate">{item.row.headline}</span>
                      </button>
                    ) : (
                      <p className="relative px-2 text-[10px] text-carbon-blue/35">
                        Outside this window
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {unscheduled.length > 0 ? (
        <div className="border border-dashed border-carbon-blue/15 bg-carbon-blue/[0.02] px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
            No date ({unscheduled.length})
          </p>
          <ul className="mt-2 space-y-1">
            {unscheduled.map((item) => (
              <li key={item.row.id}>
                <button
                  type="button"
                  onClick={() => onOpen?.(item.row.activity.ActivityID)}
                  className="text-[12px] font-medium text-carbon-blue hover:text-upcycle-orange"
                >
                  {item.row.headline}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-[10px] text-carbon-blue/40">
        Bars use due date (tasks) or scheduled date. Duration stretches the bar when set;
        otherwise one day.
      </p>
    </div>
  );
}
