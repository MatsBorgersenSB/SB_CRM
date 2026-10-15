import { NextResponse } from "next/server";
import { activityAlreadyOnTeams } from "@/lib/activity-attendees";
import { linkMatchingOutlookEventToActivity } from "@/lib/m365/link-outlook-event-to-activity";
import { readLiveCompanies } from "@/lib/prisma-data";
import { sharePointErrorResponse } from "@/services/sharepoint/server/api-utils";
import { getServerSharePointServices } from "@/services/sharepoint/factory";

/**
 * POST /api/activities/[id]/sync-outlook
 *
 * Finds the Outlook/Teams calendar event that is already this activity
 * (same time, overlapping title / people) and writes join URL + attendees back.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const { activities } = getServerSharePointServices();
    const activity = await activities.getById(id);
    if (
      activity.TeamsJoinUrl &&
      activity.TeamsEventId &&
      activityAlreadyOnTeams(activity)
    ) {
      return NextResponse.json({
        activity,
        linked: true,
        alreadyLinked: true,
        joinUrl: activity.TeamsJoinUrl,
        webLink: activity.TeamsWebLink,
      });
    }

    const companies = await readLiveCompanies();
    const result = await linkMatchingOutlookEventToActivity(activity, companies);
    return NextResponse.json({
      activity: result.activity,
      linked: result.linked,
      alreadyLinked: false,
      joinUrl: result.joinUrl,
      webLink: result.webLink,
    });
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}
