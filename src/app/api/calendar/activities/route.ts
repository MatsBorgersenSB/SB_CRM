import { NextResponse } from "next/server";
import {
  createCalendarActivity,
  listCalendarActivities,
} from "@/lib/calendar-activities-query";
import { SMART_ACTIVITY_TYPES, type SmartActivityType } from "@/types/activity";

export const dynamic = "force-dynamic";

function parseRange(request: Request): { start: Date; end: Date } | { error: string } {
  const url = new URL(request.url);
  const startRaw = url.searchParams.get("startDate");
  const endRaw = url.searchParams.get("endDate");
  if (!startRaw || !endRaw) {
    return { error: "startDate and endDate are required." };
  }
  const start = new Date(startRaw);
  const end = new Date(endRaw);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return { error: "startDate and endDate must be a valid range." };
  }
  return { start, end };
}

export async function GET(request: Request) {
  const range = parseRange(request);
  if ("error" in range) {
    return NextResponse.json({ error: range.error }, { status: 400 });
  }

  try {
    const activities = await listCalendarActivities(range.start, range.end);
    return NextResponse.json({ activities });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calendar query failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type CreateBody = {
  type?: string;
  title?: string;
  startDate?: string;
  endDate?: string | null;
  companyCode?: string | null;
  opportunityCode?: string | null;
  event?: {
    location?: string | null;
    website?: string | null;
    organizer?: string | null;
    objective?: string | null;
    themes?: unknown;
  } | null;
  isAiProposed?: boolean;
};

function cleanText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 500) : null;
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreateBody;
  if (!body.type || !(SMART_ACTIVITY_TYPES as readonly string[]).includes(body.type)) {
    return NextResponse.json({ error: "A known activity type is required." }, { status: 400 });
  }
  if (!body.startDate) {
    return NextResponse.json({ error: "startDate is required." }, { status: 400 });
  }
  const startDate = new Date(body.startDate);
  const endDate = body.endDate ? new Date(body.endDate) : null;
  if (Number.isNaN(startDate.getTime()) || (endDate && Number.isNaN(endDate.getTime()))) {
    return NextResponse.json({ error: "Dates must be valid." }, { status: 400 });
  }

  try {
    const activity = await createCalendarActivity({
      type: body.type as SmartActivityType,
      title: body.title?.trim() ?? "",
      startDate,
      endDate,
      companyCode: body.companyCode?.trim() || null,
      opportunityCode: body.opportunityCode?.trim() || null,
      isAiProposed: body.isAiProposed === true,
      event: body.event
        ? {
            location: cleanText(body.event.location),
            website: cleanText(body.event.website),
            organizer: cleanText(body.event.organizer),
            objective: cleanText(body.event.objective),
            themes: Array.isArray(body.event.themes)
              ? body.event.themes
                  .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
                  .map((t) => t.trim().slice(0, 80))
                  .slice(0, 5)
              : [],
          }
        : null,
    });
    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Activity could not be planned.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
