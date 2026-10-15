import { NextResponse } from "next/server";
import { resolveActivityAttendeeEmails } from "@/lib/activity-attendees";
import {
  outlookMeetingComposeHref,
  teamsMeetingComposeHref,
} from "@/lib/compose-actions";
import { createTeamsCalendarEvent } from "@/lib/m365/create-teams-event";
import { linkMatchingOutlookEventToActivity } from "@/lib/m365/link-outlook-event-to-activity";
import { readLiveCompanies } from "@/lib/prisma-data";
import { sharePointErrorResponse } from "@/services/sharepoint/server/api-utils";
import { getServerSharePointServices } from "@/services/sharepoint/factory";
import { inferM365Targets } from "@/lib/activity-workspace";

function meetingEndIso(startIso: string, durationMinutes: number | undefined): string {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return startIso;
  return new Date(start.getTime() + Math.max(durationMinutes ?? 60, 15) * 60_000).toISOString();
}

function bodyToPlain(body: string): string {
  return body
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();
}

/**
 * POST /api/activities/[id]/schedule-teams
 *
 * Creates a Teams online meeting on the user's calendar when Graph allows it,
 * writes the join link back onto the activity, and always returns a URL to open.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const extra = (await request.json().catch(() => ({}))) as {
      title?: string;
      body?: string;
    };

    const { activities } = getServerSharePointServices();
    const activity = await activities.getById(id);
    const companies = await readLiveCompanies();

    const existing = await linkMatchingOutlookEventToActivity(activity, companies);
    if (existing.linked) {
      return NextResponse.json({
        activity: existing.activity,
        createdOnGraph: false,
        linkedExisting: true,
        attendeeCount: resolveActivityAttendeeEmails(existing.activity, companies).length,
        openUrl: existing.webLink || existing.joinUrl,
        teamsComposeUrl: existing.joinUrl,
      });
    }

    const attendees = resolveActivityAttendeeEmails(activity, companies);
    const title = extra.title?.trim() || activity.Subject;
    const body = extra.body?.trim() || activity.ActivityDescription || activity.Summary || title;
    const startIso = activity.ActivityDate;
    const endIso = meetingEndIso(startIso, activity.DurationMinutes);

    const created = await createTeamsCalendarEvent({
      subject: title,
      body,
      startIso,
      endIso,
      attendeeEmails: attendees,
    });

    const fallbackOutlook = outlookMeetingComposeHref(attendees, title, bodyToPlain(body), {
      startTime: startIso,
      endTime: endIso,
      location: "Microsoft Teams Meeting",
    });
    const fallbackTeams = teamsMeetingComposeHref(title, bodyToPlain(body), {
      attendees,
      startTime: startIso,
      endTime: endIso,
    });

    const updated = await activities.update(id, {
      ActivityType: "Teams Meeting",
      M365Targets: {
        ...inferM365Targets("Teams Meeting"),
        ...(activity.M365Targets ?? {}),
        outlook: true,
        teams: true,
      },
      TeamsScheduled: true,
      TeamsEventId: created?.eventId || activity.TeamsEventId,
      TeamsJoinUrl: created?.joinUrl || activity.TeamsJoinUrl,
      TeamsWebLink: created?.webLink || activity.TeamsWebLink,
    });

    return NextResponse.json({
      activity: updated,
      createdOnGraph: Boolean(created?.eventId),
      attendeeCount: attendees.length,
      openUrl: created?.webLink || created?.joinUrl || fallbackOutlook,
      teamsComposeUrl: fallbackTeams,
    });
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}
