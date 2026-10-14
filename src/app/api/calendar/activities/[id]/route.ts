import { NextResponse } from "next/server";
import { completeCalendarActivity } from "@/lib/calendar-activities-query";

export const dynamic = "force-dynamic";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const activity = await completeCalendarActivity(id);
    if (!activity) {
      return NextResponse.json({ error: "Activity not found." }, { status: 404 });
    }
    return NextResponse.json(activity);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Activity could not be completed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
