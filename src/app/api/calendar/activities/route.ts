import { NextResponse } from "next/server";
import { listCalendarActivities } from "@/lib/calendar-activities-query";

export const dynamic = "force-dynamic";

/**
 * Calendar read model over the single activity store.
 * Activities are created through POST /api/activities; there is no second write path.
 */
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
