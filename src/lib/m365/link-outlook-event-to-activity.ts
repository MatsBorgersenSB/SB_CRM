import "server-only";

import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import {
  getMailboxEventById,
  listMailboxEventsAround,
} from "@/lib/m365/calendar-events";
import {
  buildActivityPatchFromCalendarEvent,
  pickMatchingCalendarEvent,
} from "@/lib/m365/match-activity-calendar-event";
import { getServerSharePointServices } from "@/services/sharepoint/factory";

export async function linkMatchingOutlookEventToActivity(
  activity: Activity,
  companies: Company[],
): Promise<{ activity: Activity; linked: boolean; joinUrl?: string; webLink?: string }> {
  const events = await listMailboxEventsAround(activity.ActivityDate, 18);
  const match = pickMatchingCalendarEvent(activity, events, companies);
  if (!match) {
    return { activity, linked: false };
  }

  const detailed = (await getMailboxEventById(match.id)) ?? match;
  const patch = buildActivityPatchFromCalendarEvent(activity, detailed, companies);
  const { activities } = getServerSharePointServices();
  const updated = await activities.update(activity.ActivityID, patch);
  return {
    activity: updated,
    linked: true,
    joinUrl: updated.TeamsJoinUrl,
    webLink: updated.TeamsWebLink,
  };
}
