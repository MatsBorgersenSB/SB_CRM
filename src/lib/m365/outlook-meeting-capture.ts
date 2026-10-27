import "server-only";

import { auth } from "@/lib/auth";
import {
  createActivityRecord,
  listActivities,
  updateActivityRecord,
} from "@/lib/activity-store";
import { inferM365Targets } from "@/lib/activity-workspace";
import {
  getMailboxEventById,
  graphEventEndMs,
  graphEventStartMs,
  type GraphCalendarEvent,
} from "@/lib/m365/calendar-events";
import { buildActivityPatchFromCalendarEvent } from "@/lib/m365/match-activity-calendar-event";
import { getSessionAzureOid } from "@/lib/m365/session-graph-user";
import { toGraphRestMessageId } from "@/lib/m365/outlook-selection";
import { getActiveM365AccessToken, graphRequest } from "@/lib/m365-client";
import { readLiveCompanies } from "@/lib/prisma-data";
import { STANDARD_BIO_USERS } from "@/types/bio-user";
import type { Activity } from "@/types/activity";
import type { SharePointPerson } from "@/types/company";

export type OutlookMeetingSeed = {
  externalMessageId: string;
  conversationId?: string;
  subject?: string;
};

export type SavedMeetingSummary = {
  activityId: string;
  subject: string;
  startDate: string;
  activityType: string;
};

/** Strip "Accepted:" / "Godtatt:" style prefixes so the invite subject can be matched. */
function stripResponsePrefix(subject: string): string {
  return subject
    .replace(
      /^\s*(?:(?:re|fw|fwd|sv|vs)\s*:\s*)*(?:accepted|declined|tentative(?:ly accepted)?|updated invitation|updated|canceled|cancelled|invitation|godtatt|avsl[åa]tt|forel[øo]pig(?:\s+godtatt)?|oppdatert|avlyst|invitasjon)\s*:\s*/i,
      "",
    )
    .trim();
}

async function getGraphToken() {
  const oid = await getSessionAzureOid().catch(() => undefined);
  return getActiveM365AccessToken(oid);
}

/**
 * Is this open Outlook mail a meeting invite / response, and which calendar event is it about?
 * Graph is the source of truth — never guess from the subject alone when Graph can answer.
 */
export async function resolveMeetingEventForMessage(
  seed: OutlookMeetingSeed,
): Promise<{ isMeeting: boolean; event: GraphCalendarEvent | null }> {
  const messageId = toGraphRestMessageId(seed.externalMessageId);
  if (!messageId) return { isMeeting: false, event: null };

  const token = await getGraphToken();
  if (!token?.accessToken) return { isMeeting: false, event: null };

  let eventId: string | null = null;
  let isMeeting = false;
  try {
    const message = await graphRequest<{
      meetingMessageType?: string | null;
      event?: { id?: string } | null;
    }>(
      token.accessToken,
      `/me/messages/${encodeURIComponent(messageId)}?$select=id,subject,meetingMessageType&$expand=microsoft.graph.eventMessage/event`,
    );
    isMeeting = Boolean(message?.meetingMessageType && message.meetingMessageType !== "none");
    eventId = message?.event?.id?.trim() || null;
  } catch (error) {
    console.warn(
      "[outlook-meeting-capture] message lookup failed:",
      error instanceof Error ? error.message : error,
    );
  }

  if (!isMeeting && !eventId) return { isMeeting: false, event: null };

  if (eventId) {
    const event = await getMailboxEventById(eventId);
    if (event) return { isMeeting: true, event };
  }

  // Fallback: find the calendar item by subject around now.
  const wanted = stripResponsePrefix(seed.subject ?? "").toLowerCase();
  if (!wanted) return { isMeeting: true, event: null };
  try {
    const start = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
    const end = new Date(Date.now() + 180 * 24 * 3600_000).toISOString();
    const payload = await graphRequest<{ value?: GraphCalendarEvent[] }>(
      token.accessToken,
      `/me/calendarView?startDateTime=${encodeURIComponent(start)}&endDateTime=${encodeURIComponent(end)}` +
        `&$select=id,subject&$top=200&$orderby=start/dateTime`,
      { headers: { Prefer: 'outlook.timezone="UTC"' } },
    );
    const match = (payload.value ?? []).find(
      (row) => (row.subject ?? "").trim().toLowerCase() === wanted,
    );
    if (match?.id) {
      const event = await getMailboxEventById(match.id);
      if (event) return { isMeeting: true, event };
    }
  } catch (error) {
    console.warn(
      "[outlook-meeting-capture] calendar fallback failed:",
      error instanceof Error ? error.message : error,
    );
  }
  return { isMeeting: true, event: null };
}

export async function findSavedMeetingActivity(input: {
  eventId?: string | null;
  externalMessageId?: string | null;
}): Promise<Activity | null> {
  const eventId = input.eventId?.trim();
  const messageId = input.externalMessageId?.trim();
  if (!eventId && !messageId) return null;
  const rows = await listActivities();
  return (
    rows.find(
      (row) =>
        (eventId && row.TeamsEventId === eventId) ||
        (messageId && row.OutlookMessageId === messageId),
    ) ?? null
  );
}

export function toSavedMeetingSummary(activity: Activity): SavedMeetingSummary {
  return {
    activityId: activity.ActivityID,
    subject: activity.Subject,
    startDate: activity.ActivityDate,
    activityType: activity.ActivityType,
  };
}

async function resolveSessionOwner(): Promise<SharePointPerson | null> {
  const session = await auth().catch(() => null);
  const name = session?.user?.name?.trim().toLowerCase() ?? "";
  const email = session?.user?.email?.trim().toLowerCase() ?? "";
  if (!name && !email) return null;
  const compactLocal = (email.split("@")[0] ?? "").replace(/[^a-z]/g, "");
  return (
    STANDARD_BIO_USERS.find((user) => {
      const title = user.Title.toLowerCase();
      if (name && title === name) return true;
      const compactTitle = title.replace(/[^a-z]/g, "");
      return Boolean(compactLocal && compactTitle === compactLocal);
    }) ?? null
  );
}

/**
 * Save the meeting behind an Outlook invite/response as a SmartCRM Activity.
 * Idempotent: the same calendar event or mail never produces a second activity.
 */
export async function saveOutlookMeetingAsActivity(input: {
  seed: OutlookMeetingSeed;
  event: GraphCalendarEvent;
  companyId: string;
  contactId?: string;
}): Promise<{ activity: Activity; created: boolean }> {
  const existing = await findSavedMeetingActivity({
    eventId: input.event.id,
    externalMessageId: input.seed.externalMessageId,
  });
  if (existing) return { activity: existing, created: false };

  const startMs = graphEventStartMs(input.event);
  if (!Number.isFinite(startMs)) {
    throw new Error("The meeting in Outlook has no start time.");
  }
  const endMs = graphEventEndMs(input.event);
  const durationMinutes =
    Number.isFinite(endMs) && endMs > startMs
      ? Math.max(15, Math.round((endMs - startMs) / 60_000))
      : 60;
  const subject =
    input.event.subject?.trim() || stripResponsePrefix(input.seed.subject ?? "") || "Meeting";
  const isTeams = Boolean(input.event.isOnlineMeeting || input.event.onlineMeeting?.joinUrl);
  const activityType = isTeams ? "Teams Meeting" : "Meeting";
  const owner = await resolveSessionOwner();

  const created = await createActivityRecord({
    ActivityType: activityType,
    ActivityDate: new Date(startMs).toISOString(),
    Subject: subject,
    ActivityDescription: "Saved from Outlook.",
    Summary: subject,
    ActionRequired: false,
    NextAction: "",
    NextActionDate: "",
    ActionStatus: startMs > Date.now() ? "Planned" : "Completed",
    ActionOutcome: "",
    DurationMinutes: durationMinutes,
    M365Targets: inferM365Targets(activityType),
    OutlookMessageId: input.seed.externalMessageId,
    OutlookConversationId: input.seed.conversationId,
    Company: { CompanyID: input.companyId },
    Contact: input.contactId ? { ContactID: input.contactId } : null,
    ActivityOwner: owner,
  });

  // Create drops calendar identifiers; write them (join link, attendees) back from the event.
  const companies = await readLiveCompanies();
  const patch = buildActivityPatchFromCalendarEvent(created, input.event, companies);
  const activity = await updateActivityRecord(created.ActivityID, patch);
  return { activity, created: true };
}
