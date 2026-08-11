"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import type { ActivityIntelligentRow } from "@/lib/activity-mission-control";
import {
  buildActivityScheduleItems,
  buildMonthGrid,
  formatMonthLabel,
  groupScheduleItemsByDay,
  startOfDay,
  toDayKey,
  type ActivityScheduleItem,
} from "@/lib/activity-schedule-views";
import { EDITORIAL_EMPTY } from "@/lib/editorial-design-system";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function barTone(item: ActivityScheduleItem): string {
  if (item.isOverdue || item.row.priority === "urgent") {
    return "border-thermal-red/30 bg-thermal-red/10 text-thermal-red";
  }
  if (item.row.requiresAttention || item.row.priority === "high") {
    return "border-upcycle-orange/30 bg-upcycle-orange/10 text-upcycle-orange";
  }
  if (item.row.activity.ActivityType === "Task") {
    return "border-carbon-blue/20 bg-carbon-blue/[0.06] text-carbon-blue";
  }
  return "border-carbon-blue/12 bg-white text-carbon-blue/75";
}

export function ActivityCalendarView({
  rows,
  primaryFocusActivityId,
  onOpen,
}: {
  rows: ActivityIntelligentRow[];
  primaryFocusActivityId?: string | null;
  onOpen?: (activityId: string) => void;
}) {
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));

  const items = useMemo(() => buildActivityScheduleItems(rows), [rows]);
  const byDay = useMemo(() => groupScheduleItemsByDay(items), [items]);
  const grid = useMemo(() => buildMonthGrid(anchor), [anchor]);
  const todayKey = toDayKey(startOfDay(new Date()));
  const month = anchor.getMonth();

  const unscheduled = items.filter((item) => item.isUnscheduled);

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
          <p className="text-[11px] font-medium text-carbon-blue/45">Calendar</p>
          <h3 className="text-[15px] font-semibold text-carbon-blue">
            {formatMonthLabel(anchor)}
          </h3>
        </div>
        <div className="flex items-center border border-carbon-blue/10">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() =>
              setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))
            }
            className="px-2 py-1.5 text-carbon-blue/55 hover:text-upcycle-orange"
          >
            <ChevronLeft className="size-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => setAnchor(startOfDay(new Date()))}
            className="border-x border-carbon-blue/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/60 hover:text-upcycle-orange"
          >
            Today
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() =>
              setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))
            }
            className="px-2 py-1.5 text-carbon-blue/55 hover:text-upcycle-orange"
          >
            <ChevronRight className="size-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-7 border-b border-carbon-blue/10">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40"
              >
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 border-l border-t border-carbon-blue/10">
            {grid.map((day) => {
              const key = toDayKey(day);
              const dayItems = byDay.get(key) ?? [];
              const inMonth = day.getMonth() === month;
              const isToday = key === todayKey;
              const visible = dayItems.slice(0, 3);
              const overflow = dayItems.length - visible.length;

              return (
                <div
                  key={key}
                  className={`min-h-[108px] border-b border-r border-carbon-blue/10 p-1.5 ${
                    inMonth ? "bg-white" : "bg-carbon-blue/[0.015]"
                  } ${isToday ? "bg-upcycle-orange/[0.04]" : ""}`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={`text-[11px] tabular-nums ${
                        isToday
                          ? "font-semibold text-upcycle-orange"
                          : inMonth
                            ? "text-carbon-blue/70"
                            : "text-carbon-blue/30"
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    {dayItems.length > 0 ? (
                      <span className="text-[9px] font-medium text-carbon-blue/35">
                        {dayItems.length}
                      </span>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    {visible.map((item) => (
                      <button
                        key={item.row.id}
                        type="button"
                        onClick={() => onOpen?.(item.row.activity.ActivityID)}
                        className={`block w-full truncate border px-1.5 py-0.5 text-left text-[10px] font-medium leading-snug ${barTone(item)} ${
                          primaryFocusActivityId === item.row.id
                            ? "ring-1 ring-upcycle-orange/50"
                            : ""
                        }`}
                        title={item.row.headline}
                      >
                        {item.row.headline}
                      </button>
                    ))}
                    {overflow > 0 ? (
                      <p className="px-1 text-[9px] text-carbon-blue/40">
                        +{overflow} more
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {unscheduled.length > 0 ? (
        <div className="border border-dashed border-carbon-blue/15 bg-carbon-blue/[0.02] px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
            No date ({unscheduled.length})
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {unscheduled.map((item) => (
              <button
                key={item.row.id}
                type="button"
                onClick={() => onOpen?.(item.row.activity.ActivityID)}
                className={`border px-2 py-1 text-[10px] font-medium ${barTone(item)}`}
              >
                {item.row.headline}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <p className="text-[10px] text-carbon-blue/40">
        Tasks place on due date; meetings and other activities use the scheduled date.
      </p>
    </div>
  );
}
