import type { ActivityIntelligentRow } from "@/lib/activity-mission-control";
import type { Activity } from "@/types/activity";

export type ActivityScheduleViewMode = "list" | "calendar" | "gantt";

export type ActivityScheduleItem = {
  row: ActivityIntelligentRow;
  /** Inclusive start of day for placement */
  start: Date;
  /** Exclusive end of day (or end after duration) */
  end: Date;
  dayKey: string;
  isOverdue: boolean;
  isUnscheduled: boolean;
};

function parseDate(value: string): Date {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(normalized);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function toDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export function formatShortDay(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * Schedule anchor: open follow-up due date first, else activity date.
 */
export function resolveActivityScheduleDate(activity: Activity): Date | null {
  const due = activity.NextActionDate?.trim();
  if (due) {
    const parsed = parseDate(due);
    if (!Number.isNaN(parsed.getTime())) return startOfDay(parsed);
  }

  const occurred = activity.ActivityDate?.trim();
  if (occurred) {
    const parsed = parseDate(occurred);
    if (!Number.isNaN(parsed.getTime())) return startOfDay(parsed);
  }

  return null;
}

function resolveEndDate(activity: Activity, start: Date): Date {
  const minutes = activity.DurationMinutes;
  if (minutes && minutes > 0) {
    const spanDays = Math.max(1, Math.ceil(minutes / (60 * 8)));
    return addDays(start, spanDays);
  }
  return addDays(start, 1);
}

export function toActivityScheduleItem(
  row: ActivityIntelligentRow,
): ActivityScheduleItem {
  const start = resolveActivityScheduleDate(row.activity);
  if (!start) {
    const fallback = startOfDay(new Date());
    return {
      row,
      start: fallback,
      end: addDays(fallback, 1),
      dayKey: toDayKey(fallback),
      isOverdue: row.timingLabel === "Overdue",
      isUnscheduled: true,
    };
  }

  return {
    row,
    start,
    end: resolveEndDate(row.activity, start),
    dayKey: toDayKey(start),
    isOverdue: row.timingLabel === "Overdue",
    isUnscheduled: false,
  };
}

export function buildActivityScheduleItems(
  rows: ActivityIntelligentRow[],
): ActivityScheduleItem[] {
  return rows
    .map(toActivityScheduleItem)
    .sort((a, b) => {
      if (a.isUnscheduled !== b.isUnscheduled) {
        return a.isUnscheduled ? 1 : -1;
      }
      const byStart = a.start.getTime() - b.start.getTime();
      if (byStart !== 0) return byStart;
      return a.row.headline.localeCompare(b.row.headline);
    });
}

/** Chronological dated items only — for prev/next task navigation. */
export function orderedScheduledItems(
  rows: ActivityIntelligentRow[],
): ActivityScheduleItem[] {
  return buildActivityScheduleItems(rows).filter((item) => !item.isUnscheduled);
}

export function groupScheduleItemsByDay(
  items: ActivityScheduleItem[],
): Map<string, ActivityScheduleItem[]> {
  const map = new Map<string, ActivityScheduleItem[]>();
  for (const item of items) {
    if (item.isUnscheduled) continue;
    const list = map.get(item.dayKey) ?? [];
    list.push(item);
    map.set(item.dayKey, list);
  }
  return map;
}

/** Monday-start month grid including leading/trailing days. */
export function buildMonthGrid(anchor: Date): Date[] {
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const weekday = (firstOfMonth.getDay() + 6) % 7; // Mon=0
  const gridStart = addDays(firstOfMonth, -weekday);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

export function buildGanttRange(
  items: ActivityScheduleItem[],
  weekCount = 6,
): { start: Date; days: Date[] } {
  const today = startOfDay(new Date());
  const scheduled = items.filter((item) => !item.isUnscheduled);

  let start = addDays(today, -7);
  if (scheduled.length > 0) {
    const earliest = scheduled.reduce(
      (min, item) => (item.start < min ? item.start : min),
      scheduled[0].start,
    );
    const candidate = addDays(earliest, -3);
    if (candidate < start) start = candidate;
  }

  // Align to Monday
  const weekday = (start.getDay() + 6) % 7;
  start = addDays(start, -weekday);

  const days = Array.from({ length: weekCount * 7 }, (_, index) =>
    addDays(start, index),
  );
  return { start, days };
}

export function ganttBarStyle(
  item: ActivityScheduleItem,
  rangeStart: Date,
  dayCount: number,
): { leftPct: number; widthPct: number } | null {
  const rangeEnd = addDays(rangeStart, dayCount);
  const barStart = item.start < rangeStart ? rangeStart : item.start;
  const barEnd = item.end > rangeEnd ? rangeEnd : item.end;
  if (barEnd <= rangeStart || barStart >= rangeEnd) return null;

  const msPerDay = 86_400_000;
  const startOffset =
    (startOfDay(barStart).getTime() - rangeStart.getTime()) / msPerDay;
  const durationDays = Math.max(
    1,
    (startOfDay(barEnd).getTime() - startOfDay(barStart).getTime()) / msPerDay,
  );

  return {
    leftPct: (startOffset / dayCount) * 100,
    widthPct: (durationDays / dayCount) * 100,
  };
}
