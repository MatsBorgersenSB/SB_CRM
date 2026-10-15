import "server-only";

import { getActiveM365AccessToken, graphRequest } from "@/lib/m365-client";
import { getSessionAzureOid } from "@/lib/m365/session-graph-user";

export type CreatedTeamsCalendarEvent = {
  eventId: string;
  webLink: string | null;
  joinUrl: string | null;
};

function wallClockUtc(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.replace(/Z$/, "");
  return date.toISOString().replace(/\.\d{3}Z$/, "");
}

/**
 * Create an Outlook calendar event that is a Teams online meeting, with attendees.
 * Requires delegated Calendars.ReadWrite on the signed-in mailbox.
 */
export async function createTeamsCalendarEvent(input: {
  subject: string;
  body: string;
  startIso: string;
  endIso: string;
  attendeeEmails: string[];
}): Promise<CreatedTeamsCalendarEvent | null> {
  const oid = await getSessionAzureOid().catch(() => undefined);
  const token = await getActiveM365AccessToken(oid);
  if (!token?.accessToken) return null;

  const attendees = input.attendeeEmails
    .map((address) => address.trim().toLowerCase())
    .filter((address) => address.includes("@"))
    .map((address) => ({
      emailAddress: { address },
      type: "required" as const,
    }));

  try {
    const created = await graphRequest<{
      id?: string;
      webLink?: string;
      onlineMeetingUrl?: string;
      onlineMeeting?: { joinUrl?: string };
    }>(token.accessToken, "/me/events", {
      method: "POST",
      body: JSON.stringify({
        subject: input.subject,
        body: {
          contentType: "HTML",
          content: input.body.replace(/\n/g, "<br/>"),
        },
        start: { dateTime: wallClockUtc(input.startIso), timeZone: "UTC" },
        end: { dateTime: wallClockUtc(input.endIso), timeZone: "UTC" },
        attendees,
        isOnlineMeeting: true,
        onlineMeetingProvider: "teamsForBusiness",
      }),
    });

    if (!created?.id) return null;
    return {
      eventId: created.id,
      webLink: created.webLink?.trim() || null,
      joinUrl:
        created.onlineMeeting?.joinUrl?.trim() || created.onlineMeetingUrl?.trim() || null,
    };
  } catch (error) {
    console.warn(
      "[create-teams-event] Graph calendar create failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
