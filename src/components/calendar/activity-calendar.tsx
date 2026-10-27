"use client";

import { formatDate, formatShortDate, formatTime } from "@/lib/regional-format-preference";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { COMPANY_SECTOR_PRESETS } from "@/lib/company-sectors";
import { SmartAssistResolutionCard } from "@/components/smartassist/SmartAssistResolutionCard";
import type { SmartAssistResolution } from "@/lib/smartassist/omniOrchestrator";
import { cn } from "@/lib/cn";
import {
  FLOATING_ACTIVITIES,
  SMART_ACTIVITY_TYPES,
  TIME_BOUND_ACTIVITIES,
  isAllDayActivityType,
  smartActivityLabel,
  type SmartActivityType,
} from "@/types/activity";
import {
  CALENDAR_QUERY,
  activityDateKey,
  addDays,
  coversDay,
  dateKey,
  daysInRange,
  endOfDay,
  formatDealAmount,
  sectorBorderClass,
  startOfDay,
  startOfWeek,
  visibleRange,
  type CalendarActivity,
  type CalendarSectorFilter,
  type CalendarView,
} from "@/types/calendar-activity";

const HOUR_START = 7;
const HOUR_END = 19;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, index) => HOUR_START + index);
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const inputClass =
  "mt-1 w-full border border-border bg-white px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary/40";

export function ActivityCalendar() {
  const [view, setView] = useState<CalendarView>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [sector, setSector] = useState<CalendarSectorFilter>("all");
  const [type, setType] = useState<SmartActivityType | "all">("all");
  const [activities, setActivities] = useState<CalendarActivity[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<string[]>([]);

  const range = useMemo(() => visibleRange(view, anchor), [view, anchor]);
  const rangeKey = `${range.start.toISOString()}|${range.end.toISOString()}`;

  useEffect(() => {
    const controller = new AbortController();
    const onFocus = () => {
      /* Refetch is intentionally disabled. */
    };
    if (CALENDAR_QUERY.revalidateOnFocus) {
      window.addEventListener("focus", onFocus);
    }
    setStatus("loading");
    const params = new URLSearchParams({
      startDate: range.start.toISOString(),
      endDate: range.end.toISOString(),
    });
    fetch(`/api/calendar/activities?${params}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Calendar request failed");
        return response.json() as Promise<{ activities: CalendarActivity[] }>;
      })
      .then((body) => {
        setActivities(body.activities);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
      });
    return () => {
      controller.abort();
      window.removeEventListener("focus", onFocus);
    };
  }, [rangeKey, range.start, range.end]);

  const matchesFilters = useCallback(
    (activity: CalendarActivity) => {
      if (activity.completedAt) return false;
      if (type !== "all" && activity.type !== type) return false;
      if (sector !== "all" && activity.company?.sectorTag !== sector) return false;
      return true;
    },
    [sector, type],
  );

  const floatingWindow = useMemo(() => {
    if (view === "week") return visibleRange("week", anchor);
    return { start: startOfDay(anchor), end: endOfDay(anchor) };
  }, [view, anchor]);

  const floating = useMemo(
    () =>
      activities.filter((activity) => {
        if (!(FLOATING_ACTIVITIES as readonly string[]).includes(activity.type)) return false;
        if (!matchesFilters(activity)) return false;
        const key = activityDateKey(activity.startDate);
        if (!key) return false;
        return key >= dateKey(floatingWindow.start) && key <= dateKey(floatingWindow.end);
      }),
    [activities, floatingWindow, matchesFilters],
  );

  const timed = useMemo(
    () =>
      activities.filter(
        (activity) =>
          (TIME_BOUND_ACTIVITIES as readonly string[]).includes(activity.type) &&
          matchesFilters(activity),
      ),
    [activities, matchesFilters],
  );

  const selected = activities.find((activity) => activity.id === selectedId) ?? null;

  const complete = useCallback(
    async (activity: CalendarActivity) => {
      if (pendingIds.includes(activity.id) || activity.completedAt) return;
      const previous = activities;
      const completedAt = new Date().toISOString();
      setPendingIds((current) => [...current, activity.id]);
      setActivities((current) =>
        current.map((item) => (item.id === activity.id ? { ...item, completedAt } : item)),
      );
      setSelectedId((current) => (current === activity.id ? null : current));
      try {
        const response = await fetch(`/api/calendar/activities/${activity.id}`, {
          method: "PATCH",
        });
        if (!response.ok) throw new Error("Complete failed");
      } catch {
        setActivities(previous);
        setSelectedId(activity.id);
      } finally {
        setPendingIds((current) => current.filter((id) => id !== activity.id));
      }
    },
    [activities, pendingIds],
  );

  const shift = (direction: -1 | 1) => {
    setAnchor((current) => {
      if (view === "day") return addDays(current, direction);
      if (view === "week") return addDays(current, direction * 7);
      return new Date(current.getFullYear(), current.getMonth() + direction, 1);
    });
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-3 px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex border border-border bg-white">
            {(["month", "week", "day"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={view === option}
                onClick={() => setView(option)}
                className={cn(
                  "px-3 py-1.5 text-xs capitalize",
                  view === option
                    ? "bg-foreground text-white"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => shift(-1)}
              className="border border-border bg-white p-1.5 text-foreground hover:bg-muted"
              aria-label="Previous"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setAnchor(new Date())}
              className="border border-border bg-white px-2.5 py-1.5 text-xs text-foreground hover:bg-muted"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => shift(1)}
              className="border border-border bg-white p-1.5 text-foreground hover:bg-muted"
              aria-label="Next"
            >
              <ChevronRight className="size-4" />
            </button>
            <p className="px-2 text-sm font-medium text-foreground">{periodLabel(view, anchor)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Sector
            <select
              value={sector}
              onChange={(event) => setSector(event.target.value as CalendarSectorFilter)}
              className={inputClass}
            >
              <option value="all">All</option>
              {COMPANY_SECTOR_PRESETS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Type
            <select
              value={type}
              onChange={(event) => setType(event.target.value as SmartActivityType | "all")}
              className={inputClass}
            >
              <option value="all">All</option>
              {SMART_ACTIVITY_TYPES.map((option) => (
                <option key={option} value={option}>
                  {smartActivityLabel(option)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <section aria-label="All-day and to-do">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          All-day / to-do
        </p>
        {floating.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {status === "loading" ? "Loading…" : "Nothing due in this view."}
          </p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {floating.map((activity) => (
              <div
                key={activity.id}
                className="inline-flex shrink-0 items-center gap-2 border border-border bg-white px-2.5 py-1.5 text-xs"
              >
                <input
                  type="checkbox"
                  aria-label={`Complete ${activity.title}`}
                  disabled={pendingIds.includes(activity.id)}
                  onChange={() => void complete(activity)}
                  className="size-3.5 accent-[#1B4332]"
                />
                <button
                  type="button"
                  onClick={() => setSelectedId(activity.id)}
                  className="text-left"
                >
                  <span className="font-medium text-foreground">{activity.title}</span>
                  <span className="ml-2 text-muted-foreground">
                    {smartActivityLabel(activity.type)}
                    {activity.company ? ` · ${activity.company.name}` : ""}
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="min-h-0 flex-1 overflow-auto border border-border bg-white">
        {status === "error" ? (
          <p className="p-4 text-sm text-foreground">The calendar could not load.</p>
        ) : view === "month" ? (
          <MonthGrid
            anchor={anchor}
            activities={timed}
            onSelectDay={setAnchor}
            onOpen={setSelectedId}
          />
        ) : (
          <TimeGrid
            days={
              view === "day"
                ? [startOfDay(anchor)]
                : daysInRange(startOfWeek(anchor), 7)
            }
            activities={timed}
            onOpen={setSelectedId}
          />
        )}
      </section>

      {selected ? (
        <ActivityDetail
          key={selected.id}
          activity={selected}
          pending={pendingIds.includes(selected.id)}
          onClose={() => setSelectedId(null)}
          onComplete={() => void complete(selected)}
        />
      ) : null}
    </div>
  );
}

function periodLabel(view: CalendarView, anchor: Date): string {
  if (view === "month") {
    return anchor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }
  if (view === "day") {
    return anchor.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "short",
    });
  }
  const start = startOfWeek(anchor);
  const end = addDays(start, 6);
  const startLabel = formatShortDate(start);
  const endLabel = formatDate(end);
  return `${startLabel} – ${endLabel}`;
}

function MonthGrid({
  anchor,
  activities,
  onSelectDay,
  onOpen,
}: {
  anchor: Date;
  activities: CalendarActivity[];
  onSelectDay: (day: Date) => void;
  onOpen: (id: string) => void;
}) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const days = daysInRange(startOfWeek(first), 42);
  const today = dateKey(new Date());
  const weeks = Array.from({ length: 6 }, (_, index) => days.slice(index * 7, index * 7 + 7));

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {WEEKDAYS.map((label) => (
          <div key={label} className="px-2 py-2">
            {label}
          </div>
        ))}
      </div>
      {weeks.map((week) => {
        const banners = activities
          .filter((activity) => isAllDayActivityType(activity.type))
          .map((activity) => ({ activity, span: spanForDays(activity, week) }))
          .filter((item): item is { activity: CalendarActivity; span: { start: number; span: number } } =>
            Boolean(item.span),
          );
        return (
          <div key={dateKey(week[0] ?? new Date())} className="border-b border-border">
            <div className="grid grid-cols-7">
              {week.map((day) => {
                const key = dateKey(day);
                const outside = day.getMonth() !== anchor.getMonth();
                return (
                  <div key={key} className={cn("px-1.5 pt-1.5", outside && "bg-muted/40")}>
                    <button
                      type="button"
                      onClick={() => onSelectDay(day)}
                      className={cn(
                        "inline-flex size-6 items-center justify-center text-xs",
                        key === today && "bg-foreground text-white",
                      )}
                    >
                      {day.getDate()}
                    </button>
                  </div>
                );
              })}
            </div>
            {banners.slice(0, 2).map(({ activity, span }) => (
              <div key={activity.id} className="grid grid-cols-7 px-1 pb-1">
                <div style={{ gridColumn: `${span.start + 1} / span ${span.span}` }}>
                  <EventButton activity={activity} onOpen={onOpen} banner />
                </div>
              </div>
            ))}
            <div className="grid grid-cols-7">
              {week.map((day) => {
                const key = dateKey(day);
                const blocks = activities.filter(
                  (activity) =>
                    !isAllDayActivityType(activity.type) && activityDateKey(activity.startDate) === key,
                );
                return (
                  <div key={key} className="flex min-h-16 flex-col gap-1 px-1 pb-1.5">
                    {blocks.slice(0, 2).map((activity) => (
                      <EventButton key={activity.id} activity={activity} onOpen={onOpen} />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TimeGrid({
  days,
  activities,
  onOpen,
}: {
  days: Date[];
  activities: CalendarActivity[];
  onOpen: (id: string) => void;
}) {
  const banners = activities.filter((activity) => isAllDayActivityType(activity.type));
  const blocks = activities.filter((activity) => !isAllDayActivityType(activity.type));
  const today = dateKey(new Date());

  return (
    <div className="min-w-[720px]">
      <div
        className="grid border-b border-border"
        style={{ gridTemplateColumns: `4rem repeat(${days.length}, minmax(0, 1fr))` }}
      >
        <div />
        {days.map((day) => (
          <div key={dateKey(day)} className="px-2 py-2 text-xs">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {WEEKDAYS[(day.getDay() + 6) % 7]}
            </p>
            <p className={cn("font-medium", dateKey(day) === today && "text-primary")}>
              {day.getDate()}
            </p>
          </div>
        ))}
      </div>
      {banners.map((activity) => {
        const span = spanForDays(activity, days);
        if (!span) return null;
        return (
          <div
            key={activity.id}
            className="grid border-b border-border/70"
            style={{ gridTemplateColumns: `4rem repeat(${days.length}, minmax(0, 1fr))` }}
          >
            <div />
            <div style={{ gridColumn: `${span.start + 2} / span ${span.span}` }} className="p-1">
              <EventButton activity={activity} onOpen={onOpen} banner />
            </div>
          </div>
        );
      })}
      <div
        className="grid"
        style={{ gridTemplateColumns: `4rem repeat(${days.length}, minmax(0, 1fr))` }}
      >
        <div>
          {HOURS.map((hour) => (
            <div key={hour} className="h-14 pr-2 text-right text-[11px] text-muted-foreground">
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        {days.map((day) => {
          const key = dateKey(day);
          const dayBlocks = blocks.filter((activity) => activityDateKey(activity.startDate) === key);
          return (
            <div key={key} className="relative border-l border-border/70" style={{ height: HOURS.length * 56 }}>
              {HOURS.map((hour) => (
                <div key={hour} className="h-14 border-b border-border/50" />
              ))}
              {dayBlocks.map((activity) => {
                const box = blockPosition(activity);
                return (
                  <div
                    key={activity.id}
                    className="absolute inset-x-1"
                    style={{ top: box.top, height: box.height }}
                  >
                    <EventButton activity={activity} onOpen={onOpen} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function spanForDays(
  activity: CalendarActivity,
  days: Date[],
): { start: number; span: number } | null {
  let start = -1;
  let end = -1;
  days.forEach((day, index) => {
    if (!coversDay(activity, day)) return;
    if (start === -1) start = index;
    end = index;
  });
  if (start === -1) return null;
  return { start, span: end - start + 1 };
}

function blockPosition(activity: CalendarActivity): { top: number; height: number } {
  const start = activity.startDate ? new Date(activity.startDate) : new Date();
  const fallbackEnd = new Date(start.getTime() + 60 * 60_000);
  const end = activity.endDate ? new Date(activity.endDate) : fallbackEnd;
  const gridStart = HOUR_START * 60;
  const gridSpan = (HOUR_END - HOUR_START) * 60;
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes =
    dateKey(end) === dateKey(start) ? end.getHours() * 60 + end.getMinutes() : HOUR_END * 60;
  const topMinutes = Math.min(Math.max(startMinutes, gridStart), gridStart + gridSpan - 30) - gridStart;
  const bottomMinutes = Math.max(endMinutes, startMinutes + 30);
  const heightMinutes = Math.min(gridSpan - topMinutes, Math.max(30, bottomMinutes - gridStart - topMinutes));
  const total = HOURS.length * 56;
  return {
    top: (topMinutes / gridSpan) * total,
    height: Math.max(28, (heightMinutes / gridSpan) * total),
  };
}

function EventButton({
  activity,
  onOpen,
  banner = false,
}: {
  activity: CalendarActivity;
  onOpen: (id: string) => void;
  banner?: boolean;
}) {
  const amount =
    activity.opportunity?.amount != null
      ? formatDealAmount(activity.opportunity.amount, activity.opportunity.currency)
      : null;
  return (
    <button
      type="button"
      onClick={() => onOpen(activity.id)}
      className={cn(
        "flex w-full items-start justify-between gap-2 border bg-white px-2 py-1 text-left text-[12px] leading-tight text-foreground",
        sectorBorderClass(activity.company?.sectorTag ?? null),
        activity.isAiProposed && "border-dashed opacity-80",
        banner && "bg-[#f7f7f8]",
      )}
    >
      <span className="min-w-0">
        <span className="block truncate font-medium">{activity.title}</span>
        {activity.company ? (
          <span className="block truncate text-muted-foreground">{activity.company.name}</span>
        ) : null}
      </span>
      {amount ? (
        <span className="shrink-0 border border-border bg-white px-1 py-0.5 text-[11px] font-semibold">
          {amount}
        </span>
      ) : null}
    </button>
  );
}

function ActivityDetail({
  activity,
  pending,
  onClose,
  onComplete,
}: {
  activity: CalendarActivity;
  pending: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [resolution, setResolution] = useState<SmartAssistResolution | null>(null);
  const [resolving, setResolving] = useState(false);
  const when = formatWhen(activity);
  const amount =
    activity.opportunity?.amount != null
      ? formatDealAmount(activity.opportunity.amount, activity.opportunity.currency)
      : null;

  return (
    <aside className="absolute inset-y-3 right-4 z-20 flex w-80 flex-col border border-border bg-white shadow-xl sm:right-6">
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {smartActivityLabel(activity.type)}
            {activity.isAiProposed ? " · Proposed" : ""}
          </p>
          <h2 className="text-sm font-semibold text-foreground">{activity.title}</h2>
        </div>
        <button type="button" onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
          Close
        </button>
      </header>
      <div className="flex flex-1 flex-col gap-3 px-4 py-3 text-sm text-foreground">
        <p>{when}</p>
        {activity.event ? (
          <div className="grid gap-1.5 border-l-2 border-border pl-3">
            {activity.event.location ? <p>{activity.event.location}</p> : null}
            {activity.event.organizer ? (
              <p className="text-muted-foreground">Organised by {activity.event.organizer}</p>
            ) : null}
            {activity.event.website ? (
              <a
                href={activity.event.website}
                target="_blank"
                rel="noreferrer"
                className="truncate text-xs text-upcycle-orange hover:underline"
              >
                Event page ↗
              </a>
            ) : null}
            {activity.event.objective ? (
              <p>
                <span className="text-muted-foreground">Why we go · </span>
                {activity.event.objective}
              </p>
            ) : null}
            {activity.event.themes.length ? (
              <p className="text-xs text-muted-foreground">{activity.event.themes.join(" · ")}</p>
            ) : null}
          </div>
        ) : null}
        {activity.event && !activity.company ? null : (
          <p>
            <span className="text-muted-foreground">Company · </span>
            {activity.company?.name ?? "No company linked"}
          </p>
        )}
        {activity.opportunity ? (
          <p>
            <span className="text-muted-foreground">Opportunity · </span>
            {activity.opportunity.title}
            {amount ? ` · ${amount}` : ""}
          </p>
        ) : null}
        {!activity.company && !activity.event && activity.title.trim() ? (
          resolution ? (
            <SmartAssistResolutionCard
              resolution={resolution}
              onDismiss={() => setResolution(null)}
            />
          ) : (
            <button
              type="button"
              disabled={resolving}
              onClick={() => {
                setResolving(true);
                void fetch("/api/smartassist/omni-resolve", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    taskDescription: activity.title,
                    dateLimit: activity.startDate ?? undefined,
                  }),
                })
                  .then(async (response) => {
                    if (!response.ok) throw new Error("resolve failed");
                    const payload = (await response.json()) as {
                      resolution?: SmartAssistResolution;
                    };
                    if (!payload.resolution) throw new Error("empty resolution");
                    setResolution(payload.resolution);
                  })
                  .catch(() => undefined)
                  .finally(() => setResolving(false));
              }}
              className="border border-border bg-white px-2.5 py-2 text-left text-xs font-medium"
            >
              {resolving ? "Looking through mail, files and Teams…" : "Ask SmartAssist what we already know"}
            </button>
          )
        ) : null}
      </div>
      <footer className="border-t border-border px-4 py-3">
        <button
          type="button"
          disabled={pending || Boolean(activity.completedAt)}
          onClick={onComplete}
          className="w-full bg-foreground px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          Complete
        </button>
      </footer>
    </aside>
  );
}

function formatWhen(activity: CalendarActivity): string {
  if (!activity.startDate) return "No date";
  const start = new Date(activity.startDate);
  if (isAllDayActivityType(activity.type)) {
    const end = activity.endDate ? new Date(activity.endDate) : start;
    const startLabel = formatShortDate(start);
    const endLabel = formatShortDate(end);
    return startLabel === endLabel ? `${startLabel} · all day` : `${startLabel} – ${endLabel} · all day`;
  }
  const time = formatTime(start);
  const day = start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return `${day} · ${time}`;
}
