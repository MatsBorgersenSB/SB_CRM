import "server-only";

import { randomBytes } from "crypto";
import {
  getAccessTokenForIntegration,
  getActiveM365AccessToken,
  graphRequest,
} from "@/lib/m365-client";
import { getSessionAzureOid } from "@/lib/m365/session-graph-user";
import { listActivities } from "@/lib/activity-store";
import type { Activity, MeetingSlotOption } from "@/types/activity";

export type SuggestedSlotResult = {
  slots: MeetingSlotOption[];
  source: "graph" | "fallback";
  checkedAttendees: string[];
};

type GraphFindMeetingTimesResponse = {
  meetingTimeSuggestions?: Array<{
    confidence?: number;
    organizerAvailability?: string;
    meetingTimeSlot?: {
      start?: { dateTime?: string; timeZone?: string };
      end?: { dateTime?: string; timeZone?: string };
    };
  }>;
  emptySuggestionsReason?: string;
};

function wallClockUtc(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.replace(/Z$/, "");
  return date.toISOString().replace(/\.\d{3}Z$/, "");
}

function normalizeGraphUtcIso(raw?: string): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const withZone =
    /Z$/i.test(trimmed) || /[+-]\d{2}:\d{2}$/.test(trimmed)
      ? trimmed
      : `${trimmed}Z`;
  const parsed = new Date(withZone);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function generateProposalToken(): string {
  return randomBytes(18).toString("base64url");
}

/**
 * Generates 3 sensible business-hour slots across the next business days
 * when Graph is offline or returns no suggestions.
 */
export function buildFallbackBusinessSlots(
  durationMinutes = 45,
  count = 3,
): MeetingSlotOption[] {
  const durationMs = Math.max(15, durationMinutes) * 60_000;
  const slots: MeetingSlotOption[] = [];
  const candidateHoursUtc = [9, 13, 10, 14];
  const cursor = new Date();
  cursor.setUTCMinutes(0, 0, 0);
  cursor.setUTCDate(cursor.getUTCDate() + 1);

  let dayStep = 0;
  while (slots.length < count && dayStep < 14) {
    const day = new Date(cursor.getTime() + dayStep * 86_400_000);
    const dow = day.getUTCDay();
    dayStep += 1;
    if (dow === 0 || dow === 6) continue;

    const hour = candidateHoursUtc[slots.length % candidateHoursUtc.length] ?? 9;
    const start = new Date(
      Date.UTC(
        day.getUTCFullYear(),
        day.getUTCMonth(),
        day.getUTCDate(),
        hour,
        0,
        0,
      ),
    );
    const end = new Date(start.getTime() + durationMs);
    slots.push({
      id: `slot-${slots.length + 1}`,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
    });
  }

  return slots;
}

/**
 * Uses Microsoft Graph `POST /me/findMeetingTimes` to find conflict-free
 * slots across the signed-in organizer and internal colleague emails.
 */
export async function suggestMutualMeetingSlots(input: {
  durationMinutes?: number;
  attendeeEmails?: string[];
  maxCandidates?: number;
  horizonDays?: number;
}): Promise<SuggestedSlotResult> {
  const durationMinutes = Math.max(15, Math.min(240, input.durationMinutes ?? 45));
  const maxCandidates = Math.max(2, Math.min(6, input.maxCandidates ?? 3));
  const horizonDays = Math.max(2, Math.min(21, input.horizonDays ?? 7));

  const cleanEmails = Array.from(
    new Set(
      (input.attendeeEmails ?? [])
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes("@")),
    ),
  );

  const oid = await getSessionAzureOid().catch(() => undefined);
  const token = await getActiveM365AccessToken(oid);

  if (!token?.accessToken) {
    return {
      slots: buildFallbackBusinessSlots(durationMinutes, maxCandidates),
      source: "fallback",
      checkedAttendees: cleanEmails,
    };
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() + 2 * 60 * 60_000);
  const windowEnd = new Date(now.getTime() + horizonDays * 86_400_000);

  const isoDuration =
    durationMinutes % 60 === 0
      ? `PT${durationMinutes / 60}H`
      : `PT${durationMinutes}M`;

  try {
    const response = await graphRequest<GraphFindMeetingTimesResponse>(
      token.accessToken,
      "/me/findMeetingTimes",
      {
        method: "POST",
        headers: {
          Prefer: 'outlook.timezone="UTC"',
        },
        body: JSON.stringify({
          attendees: cleanEmails.map((address) => ({
            type: "required",
            emailAddress: { address },
          })),
          timeConstraint: {
            activityDomain: "work",
            timeSlots: [
              {
                start: {
                  dateTime: wallClockUtc(windowStart.toISOString()),
                  timeZone: "UTC",
                },
                end: {
                  dateTime: wallClockUtc(windowEnd.toISOString()),
                  timeZone: "UTC",
                },
              },
            ],
          },
          meetingDuration: isoDuration,
          maxCandidates: maxCandidates * 2,
          isOrganizerOptional: false,
          minimumAttendeePercentage: 100,
        }),
      },
    );

    const parsed: MeetingSlotOption[] = [];
    for (const item of response.meetingTimeSuggestions ?? []) {
      const startIso = normalizeGraphUtcIso(item.meetingTimeSlot?.start?.dateTime);
      const endIso = normalizeGraphUtcIso(item.meetingTimeSlot?.end?.dateTime);
      if (!startIso || !endIso) continue;
      parsed.push({
        id: `slot-${parsed.length + 1}`,
        startIso,
        endIso,
        confidence:
          typeof item.confidence === "number" ? Math.round(item.confidence) : 100,
      });
      if (parsed.length >= maxCandidates) break;
    }

    if (parsed.length > 0) {
      return {
        slots: parsed,
        source: "graph",
        checkedAttendees: cleanEmails,
      };
    }
  } catch (error) {
    console.warn(
      "[meeting-slot-scheduler] findMeetingTimes failed, using fallback slots:",
      error instanceof Error ? error.message : error,
    );
  }

  return {
    slots: buildFallbackBusinessSlots(durationMinutes, maxCandidates),
    source: "fallback",
    checkedAttendees: cleanEmails,
  };
}

/**
 * Resolve an M365 access token either from a specific integrationId or active session.
 */
export async function resolveOrganizerAccessToken(
  integrationId?: string | null,
): Promise<{ accessToken: string; integrationId: string } | null> {
  if (integrationId?.trim()) {
    const accessToken = await getAccessTokenForIntegration(integrationId.trim());
    if (accessToken) {
      return { accessToken, integrationId: integrationId.trim() };
    }
  }
  const oid = await getSessionAzureOid().catch(() => undefined);
  return getActiveM365AccessToken(oid);
}

/**
 * Places a tentative `[Hold] ...` event on the organizer's Outlook calendar
 * so proposed windows are protected until the client chooses one.
 */
export async function createTentativeHoldEvent(input: {
  accessToken: string;
  subject: string;
  startIso: string;
  endIso: string;
  bodyText: string;
}): Promise<string | null> {
  try {
    const created = await graphRequest<{ id?: string }>(
      input.accessToken,
      "/me/events",
      {
        method: "POST",
        body: JSON.stringify({
          subject: `[Hold] ${input.subject}`,
          body: {
            contentType: "HTML",
            content: input.bodyText.replace(/\n/g, "<br/>"),
          },
          start: { dateTime: wallClockUtc(input.startIso), timeZone: "UTC" },
          end: { dateTime: wallClockUtc(input.endIso), timeZone: "UTC" },
          showAs: "tentative",
          isReminderOn: false,
          categories: ["SmartCRM"],
        }),
      },
    );
    return created?.id?.trim() || null;
  } catch (error) {
    console.warn(
      "[meeting-slot-scheduler] Could not create tentative hold:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * Deletes tentative hold events from the organizer's Outlook calendar.
 */
export async function deleteTentativeHoldEvents(
  accessToken: string,
  holdEventIds: Array<string | null | undefined>,
): Promise<void> {
  const ids = Array.from(
    new Set(
      holdEventIds
        .map((id) => id?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  );
  await Promise.all(
    ids.map(async (eventId) => {
      try {
        await graphRequest<unknown>(
          accessToken,
          `/me/events/${encodeURIComponent(eventId)}`,
          { method: "DELETE" },
        );
      } catch (error) {
        console.warn(
          `[meeting-slot-scheduler] Hold delete failed for ${eventId}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }),
  );
}

/**
 * Books the confirmed Microsoft Teams meeting on the organizer's calendar.
 */
export async function createConfirmedTeamsMeetingWithToken(input: {
  accessToken: string;
  subject: string;
  bodyHtml: string;
  startIso: string;
  endIso: string;
  attendeeEmails: string[];
}): Promise<{
  eventId: string;
  webLink: string | null;
  joinUrl: string | null;
} | null> {
  const attendees = Array.from(
    new Set(
      input.attendeeEmails
        .map((a) => a.trim().toLowerCase())
        .filter((a) => a.includes("@")),
    ),
  ).map((address) => ({
    emailAddress: { address },
    type: "required" as const,
  }));

  try {
    const created = await graphRequest<{
      id?: string;
      webLink?: string;
      onlineMeetingUrl?: string;
      onlineMeeting?: { joinUrl?: string };
    }>(input.accessToken, "/me/events", {
      method: "POST",
      body: JSON.stringify({
        subject: input.subject,
        body: {
          contentType: "HTML",
          content: input.bodyHtml,
        },
        start: { dateTime: wallClockUtc(input.startIso), timeZone: "UTC" },
        end: { dateTime: wallClockUtc(input.endIso), timeZone: "UTC" },
        attendees,
        isOnlineMeeting: true,
        onlineMeetingProvider: "teamsForBusiness",
        categories: ["SmartCRM"],
      }),
    });

    if (!created?.id) return null;
    return {
      eventId: created.id,
      webLink: created.webLink?.trim() || null,
      joinUrl:
        created.onlineMeeting?.joinUrl?.trim() ||
        created.onlineMeetingUrl?.trim() ||
        null,
    };
  } catch (error) {
    console.warn(
      "[meeting-slot-scheduler] Confirmed Teams event creation failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export function formatSlotLabelCet(slot: MeetingSlotOption): string {
  const start = new Date(slot.startIso);
  const end = new Date(slot.endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return slot.startIso;
  }
  const dateFmt = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/Copenhagen",
  });
  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Copenhagen",
  });
  return `${dateFmt.format(start)} · ${timeFmt.format(start)}–${timeFmt.format(end)} CET`;
}

export function buildSlotProposalEmailHtml(input: {
  recipientName?: string | null;
  subject: string;
  agendaText?: string | null;
  organizerName: string;
  durationMinutes: number;
  baseUrl: string;
  token: string;
  slots: MeetingSlotOption[];
}): string {
  const greeting = input.recipientName?.trim()
    ? `Hi ${input.recipientName.trim()},`
    : "Hello,";
  const agenda = input.agendaText?.trim()
    ? `<p style="margin:0 0 14px 0;color:#1b2a38;font-size:14px;line-height:1.5;">${input.agendaText
        .trim()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br/>")}</p>`
    : "";

  const base = input.baseUrl.replace(/\/$/, "");
  const allSlotsUrl = `${base}/meet/${encodeURIComponent(input.token)}`;

  const slotButtons = input.slots
    .map((slot) => {
      const href = `${allSlotsUrl}?slot=${encodeURIComponent(slot.id)}`;
      const label = formatSlotLabelCet(slot);
      return `<div style="margin:0 0 8px 0;">
        <a href="${href}" style="display:inline-block;padding:10px 16px;background-color:#132535;color:#ffffff;text-decoration:none;font-family:Segoe UI,Arial,sans-serif;font-size:13px;font-weight:600;border-left:3px solid #e86c2c;">
          ${label} &nbsp;&rarr;
        </a>
      </div>`;
    })
    .join("\n");

  return `<div style="font-family:Segoe UI,Arial,sans-serif;color:#132535;max-width:600px;">
  <p style="margin:0 0 12px 0;font-size:14px;line-height:1.5;">${greeting}</p>
  <p style="margin:0 0 12px 0;font-size:14px;line-height:1.5;">
    I would like to schedule <strong>${input.subject
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")}</strong> (${input.durationMinutes} min Microsoft Teams meeting).
  </p>
  ${agenda}
  <p style="margin:0 0 10px 0;font-size:13px;font-weight:600;color:#132535;">
    Click any time below to confirm instantly (auto-sends the Teams invite):
  </p>
  <div style="margin:0 0 14px 0;">
    ${slotButtons}
  </div>
  <p style="margin:0 0 16px 0;font-size:12px;color:#526475;">
    Need another time or want to view in your local timezone?
    <a href="${allSlotsUrl}" style="color:#e86c2c;text-decoration:underline;">Open time selector</a>
  </p>
  <p style="margin:0;font-size:14px;line-height:1.5;">
    Best regards,<br/>
    <strong>${input.organizerName.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</strong><br/>
    Standard Bio
  </p>
</div>`;
}

export async function findActivityByProposalToken(
  token: string,
): Promise<Activity | null> {
  const clean = token.trim();
  if (!clean) return null;
  const activities = await listActivities();
  return (
    activities.find((activity) => activity.SlotProposal?.token === clean) ?? null
  );
}
