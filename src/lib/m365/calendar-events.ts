import "server-only";

import { getActiveM365AccessToken, graphRequest } from "@/lib/m365-client";
import { getSessionAzureOid } from "@/lib/m365/session-graph-user";

export type GraphCalendarEvent = {
  id: string;
  subject?: string;
  webLink?: string;
  isOnlineMeeting?: boolean;
  onlineMeetingUrl?: string;
  onlineMeeting?: { joinUrl?: string };
  bodyPreview?: string;
  body?: { content?: string };
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  location?: { displayName?: string };
  attendees?: Array<{
    emailAddress?: { address?: string; name?: string };
    type?: string;
  }>;
};

function graphDateMs(point?: { dateTime?: string; timeZone?: string }): number {
  const raw = point?.dateTime?.trim();
  if (!raw) return Number.NaN;
  const withZone = /Z$/i.test(raw) || /[+-]\d{2}:\d{2}$/.test(raw) ? raw : `${raw}Z`;
  const date = new Date(withZone);
  return date.getTime();
}

export function graphEventStartMs(event: GraphCalendarEvent): number {
  return graphDateMs(event.start);
}

export function graphEventEndMs(event: GraphCalendarEvent): number {
  return graphDateMs(event.end);
}

export function extractTeamsJoinUrl(event: GraphCalendarEvent): string | null {
  const direct =
    event.onlineMeeting?.joinUrl?.trim() || event.onlineMeetingUrl?.trim() || "";
  if (direct) return direct;
  const blob = `${event.body?.content ?? ""} ${event.bodyPreview ?? ""}`;
  const match = blob.match(/https:\/\/teams\.microsoft\.com\/[^\s"'<>\\]+/i);
  return match?.[0]?.replace(/&amp;/g, "&") ?? null;
}

export function graphEventAttendees(
  event: GraphCalendarEvent,
): Array<{ email: string; name: string }> {
  const rows: Array<{ email: string; name: string }> = [];
  const seen = new Set<string>();
  for (const attendee of event.attendees ?? []) {
    const email = attendee.emailAddress?.address?.trim().toLowerCase() ?? "";
    if (!email.includes("@") || seen.has(email)) continue;
    seen.add(email);
    rows.push({
      email,
      name: attendee.emailAddress?.name?.trim() || email,
    });
  }
  return rows;
}

/**
 * Calendar items on the signed-in mailbox around a moment.
 * Uses Calendars.Read (already granted).
 */
export async function listMailboxEventsAround(
  aroundIso: string,
  windowHours = 12,
): Promise<GraphCalendarEvent[]> {
  const around = new Date(aroundIso);
  if (Number.isNaN(around.getTime())) return [];

  const oid = await getSessionAzureOid().catch(() => undefined);
  const token = await getActiveM365AccessToken(oid);
  if (!token?.accessToken) return [];

  const pad = Math.max(1, windowHours) * 60 * 60 * 1000;
  const start = new Date(around.getTime() - pad).toISOString();
  const end = new Date(around.getTime() + pad).toISOString();
  const select = [
    "id",
    "subject",
    "start",
    "end",
    "webLink",
    "isOnlineMeeting",
    "onlineMeeting",
    "onlineMeetingUrl",
    "attendees",
    "location",
    "bodyPreview",
  ].join(",");
  const path =
    `/me/calendarView?startDateTime=${encodeURIComponent(start)}` +
    `&endDateTime=${encodeURIComponent(end)}` +
    `&$select=${select}&$top=50&$orderby=start/dateTime`;

  try {
    const payload = await graphRequest<{ value?: GraphCalendarEvent[] }>(
      token.accessToken,
      path,
      { headers: { Prefer: 'outlook.timezone="UTC"' } },
    );
    return (payload.value ?? []).filter((row) => Boolean(row?.id));
  } catch (error) {
    console.warn(
      "[calendar-events] calendarView failed:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

export async function getMailboxEventById(
  eventId: string,
): Promise<GraphCalendarEvent | null> {
  const id = eventId.trim();
  if (!id) return null;
  const oid = await getSessionAzureOid().catch(() => undefined);
  const token = await getActiveM365AccessToken(oid);
  if (!token?.accessToken) return null;
  try {
    return await graphRequest<GraphCalendarEvent>(
      token.accessToken,
      `/me/events/${encodeURIComponent(id)}?$select=id,subject,start,end,webLink,isOnlineMeeting,onlineMeeting,onlineMeetingUrl,attendees,location,bodyPreview,body`,
      { headers: { Prefer: 'outlook.timezone="UTC"' } },
    );
  } catch (error) {
    console.warn(
      "[calendar-events] get event failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
