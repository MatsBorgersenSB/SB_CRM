import { COMPANY_SECTOR_PRESETS } from "@/lib/company-sectors";
import type { SmartActivityType } from "@/types/activity";

export type CalendarSector = (typeof COMPANY_SECTOR_PRESETS)[number];

/** Lightweight calendar row. Company and opportunity are name and amount only. */
/** Where, link, who runs it, why we go. Stored on `Activity.aiContext` for tradeshows and seminars. */
export type CalendarEventDetails = {
  location: string | null;
  website: string | null;
  organizer: string | null;
  objective: string | null;
  themes: string[];
};

export type CalendarActivity = {
  id: string;
  title: string;
  type: SmartActivityType;
  startDate: string | null;
  endDate: string | null;
  isAiProposed: boolean;
  completedAt: string | null;
  event: CalendarEventDetails | null;
  companyId: string | null;
  opportunityId: string | null;
  company: {
    id: string;
    name: string;
    sectorTag: CalendarSector | null;
  } | null;
  opportunity: {
    id: string;
    title: string;
    amount: number | null;
    currency: string | null;
  } | null;
};

/** Focus changes do not refetch. The visible range is the only query key. */
export const CALENDAR_QUERY = { revalidateOnFocus: false } as const;

export type CalendarView = "month" | "week" | "day";

export type CalendarSectorFilter = "all" | CalendarSector;

const SECTOR_BORDER: Record<CalendarSector, string> = {
  "Timber & Forestry": "border-l-[3px] border-l-[#1B4332]",
  "Municipal & Sludge": "border-l-[3px] border-l-[#1E293B]",
  "Energy & Utilities": "border-l-[3px] border-l-[#B45309]",
};

export function sectorBorderClass(sector: CalendarSector | null): string {
  if (!sector) return "border-l-[3px] border-l-carbon-blue/20";
  return SECTOR_BORDER[sector];
}

export function formatDealAmount(amount: number, currency: string | null): string {
  const code = (currency ?? "").toUpperCase();
  const symbol =
    code === "EUR" ? "€" : code === "USD" ? "$" : code === "GBP" ? "£" : code ? `${code} ` : "";
  const absolute = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  const compact =
    absolute >= 1_000_000_000
      ? `${trimAmount(absolute / 1_000_000_000)}B`
      : absolute >= 1_000_000
        ? `${trimAmount(absolute / 1_000_000)}M`
        : absolute >= 1_000
          ? `${Math.round(absolute / 1_000)}k`
          : `${Math.round(absolute)}`;
  return `${sign}${symbol}${compact}`;
}

function trimAmount(value: number): string {
  const fixed = value >= 10 ? value.toFixed(0) : value.toFixed(1);
  return fixed.replace(/\.0$/, "");
}

export function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function startOfWeek(date: Date): Date {
  const start = startOfDay(date);
  const weekday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - weekday);
  return start;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function visibleRange(view: CalendarView, anchor: Date): { start: Date; end: Date } {
  if (view === "day") return { start: startOfDay(anchor), end: endOfDay(anchor) };
  if (view === "week") {
    const start = startOfWeek(anchor);
    return { start, end: endOfDay(addDays(start, 6)) };
  }
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfWeek(first);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const end = endOfDay(addDays(startOfWeek(last), 6));
  return { start, end };
}

export function daysInRange(start: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, index) => addDays(start, index));
}

export function activityDateKey(value: string | null): string {
  if (!value) return "";
  return dateKey(new Date(value));
}

export function coversDay(activity: CalendarActivity, day: Date): boolean {
  const key = dateKey(day);
  const start = activityDateKey(activity.startDate);
  if (!start) return false;
  const end = activityDateKey(activity.endDate) || start;
  return key >= start && key <= end;
}
