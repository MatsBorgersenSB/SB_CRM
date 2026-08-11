"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ActivityIntelligentRow } from "@/lib/activity-mission-control";
import {
  buildActivityScheduleItems,
  buildMonthGrid,
  formatMonthLabel,
  formatShortDay,
  groupScheduleItemsByDay,
  orderedScheduledItems,
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
  focusedActivityId,
  onFocusedActivityIdChange,
  onOpen,
}: {
  rows: ActivityIntelligentRow[];
  primaryFocusActivityId?: string | null;
  focusedActivityId?: string | null;
  onFocusedActivityIdChange?: (activityId: string) => void;
  onOpen?: (activityId: string) => void;
}) {
  const items = useMemo(() => buildActivityScheduleItems(rows), [rows]);
  const scheduled = useMemo(() => orderedScheduledItems(rows), [rows]);
  const byDay = useMemo(() => groupScheduleItemsByDay(items), [items]);

  const focusedItem =
    scheduled.find((item) => item.row.id === focusedActivityId) ??
    scheduled[0] ??
    null;

  const [anchor, setAnchor] = useState(() =>
    focusedItem ? startOfDay(focusedItem.start) : startOfDay(new Date()),
  );

  useEffect(() => {
    if (!focusedActivityId) return;
    const item = scheduled.find((entry) => entry.row.id === focusedActivityId);
    if (item) setAnchor(startOfDay(item.start));
  }, [focusedActivityId, scheduled]);

  const grid = useMemo(() => buildMonthGrid(anchor), [anchor]);
  const todayKey = toDayKey(startOfDay(new Date()));
  const month = anchor.getMonth();
  const unscheduled = items.filter((item) => item.isUnscheduled);
  const focusIndex = focusedItem
    ? scheduled.findIndex((item) => item.row.id === focusedItem.row.id)
    : -1;

  if (rows.length === 0) {
    return (
      <p className={`px-6 py-12 text-center ${EDITORIAL_EMPTY}`}>
        No activities match this filter.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-carbon-blue/45">Calendar</p>
          <h3 className="text-[15px] font-semibold text-carbon-blue">
            {formatMonthLabel(anchor)}
          </h3>
          {focusedItem ? (
            <p className="mt-0.5 truncate text-[12px] text-carbon-blue/55">
              Task {focusIndex + 1} of {scheduled.length}
              <span className="mx-1.5 text-carbon-blue/25">·</span>
              {formatShortDay(focusedItem.start)}
              <span className="mx-1.5 text-carbon-blue/25">·</span>
              {focusedItem.row.headline}
            </p>
          ) : (
            <p className="mt-0.5 text-[12px] text-carbon-blue/45">
              No dated tasks in this filter
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            const today = startOfDay(new Date());
            setAnchor(today);
            if (scheduled.length === 0 || !onFocusedActivityIdChange) return;
            const nearest =
              scheduled.find((item) => item.start.getTime() >= today.getTime()) ??
              scheduled[scheduled.length - 1]!;
            onFocusedActivityIdChange(nearest.row.id);
          }}
          className="self-start border border-carbon-blue/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/60 hover:border-upcycle-orange/30 hover:text-upcycle-orange"
        >
          Today
        </button>
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
                    {visible.map((item) => {
                      const isFocused = focusedItem?.row.id === item.row.id;
                      return (
                        <button
                          key={item.row.id}
                          type="button"
                          onClick={() => {
                            onFocusedActivityIdChange?.(item.row.id);
                            onOpen?.(item.row.activity.ActivityID);
                          }}
                          className={`block w-full truncate border px-1.5 py-0.5 text-left text-[10px] font-medium leading-snug ${barTone(item)} ${
                            isFocused
                              ? "ring-2 ring-upcycle-orange"
                              : primaryFocusActivityId === item.row.id
                                ? "ring-1 ring-upcycle-orange/50"
                                : ""
                          }`}
                          title={item.row.headline}
                        >
                          {item.row.headline}
                        </button>
                      );
                    })}
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
        Use the arrows next to Showing to jump task by task. Calendar follows the selected task.
      </p>
    </div>
  );
}

/** Compact prev/next control for the filter transparency bar. */
export function ActivityScheduleJumpControl({
  index,
  total,
  label,
  onPrevious,
  onNext,
}: {
  index: number;
  total: number;
  label?: string;
  onPrevious: () => void;
  onNext: () => void;
}) {
  if (total <= 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center border border-carbon-blue/10">
        <button
          type="button"
          aria-label="Previous task"
          disabled={index <= 0}
          onClick={onPrevious}
          className="px-1.5 py-1 text-carbon-blue/55 hover:text-upcycle-orange disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft className="size-3.5" strokeWidth={2} />
        </button>
        <span className="border-x border-carbon-blue/10 px-2 py-1 text-[10px] font-semibold tabular-nums text-carbon-blue/70">
          {index + 1}/{total}
        </span>
        <button
          type="button"
          aria-label="Next task"
          disabled={index < 0 || index >= total - 1}
          onClick={onNext}
          className="px-1.5 py-1 text-carbon-blue/55 hover:text-upcycle-orange disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronRight className="size-3.5" strokeWidth={2} />
        </button>
      </div>
      {label ? (
        <span className="hidden max-w-[180px] truncate text-[11px] text-carbon-blue/50 sm:inline">
          {label}
        </span>
      ) : null}
    </div>
  );
}
