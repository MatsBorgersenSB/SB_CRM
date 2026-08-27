import type { GrowthEvent } from "@/types/growth-intelligence";

const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

/** Last moment the event can still be treated as current. */
export function eventEndDate(event: Pick<GrowthEvent, "dateLabel" | "endsOn">): Date | null {
  if (event.endsOn) {
    const explicit = new Date(`${event.endsOn}T23:59:59.000Z`);
    if (!Number.isNaN(explicit.getTime())) return explicit;
  }

  const match = event.dateLabel.trim().match(/^([A-Za-z]{3,9})\s+(\d{4})$/);
  if (!match) return null;
  const month = MONTH_INDEX[match[1].slice(0, 3).toLowerCase()];
  const year = Number(match[2]);
  if (month === undefined || !Number.isFinite(year)) return null;
  return new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
}

export function isEventPast(
  event: Pick<GrowthEvent, "dateLabel" | "endsOn">,
  now: Date = new Date(),
): boolean {
  const end = eventEndDate(event);
  if (!end) return false;
  return end.getTime() < now.getTime();
}

export function isEventUpcoming(
  event: Pick<GrowthEvent, "dateLabel" | "endsOn">,
  now: Date = new Date(),
): boolean {
  return !isEventPast(event, now);
}
