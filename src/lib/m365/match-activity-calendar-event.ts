import type { Activity, ActivityStakeholder, UpdateActivityInput } from "@/types/activity";
import type { Company } from "@/types/company";
import { isInternalEmail } from "@/lib/domain-rules";
import { inferM365Targets } from "@/lib/activity-workspace";
import {
  extractTeamsJoinUrl,
  graphEventAttendees,
  graphEventEndMs,
  graphEventStartMs,
  type GraphCalendarEvent,
} from "@/lib/m365/calendar-events";
import { getContactDisplayName } from "@/types/contact";

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[—–]/g, " ")
    .replace(/\b(standard bio|teams meeting|microsoft teams|meeting)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function similarToken(left: string, right: string): boolean {
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;
  if (left.length < 6 || right.length < 6) return false;
  if (Math.abs(left.length - right.length) > 2) return false;
  let i = 0;
  let j = 0;
  let misses = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      i += 1;
      j += 1;
      continue;
    }
    misses += 1;
    if (misses > 2) return false;
    if (left.length > right.length) i += 1;
    else if (right.length > left.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return misses + (left.length - i) + (right.length - j) <= 2;
}

function titlesOverlap(activityTitle: string, eventTitle: string, companyName?: string): boolean {
  const left = normalizeTitle(activityTitle);
  const right = normalizeTitle(eventTitle);
  if (!left || !right) return false;
  if (left.includes(right) || right.includes(left)) return true;
  const leftTokens = left.split(" ").filter((token) => token.length > 2);
  const rightTokens = right.split(" ").filter((token) => token.length > 2);
  const companyTokens = normalizeTitle(companyName ?? "")
    .split(" ")
    .filter((token) => token.length > 2);
  for (const token of leftTokens) {
    if (rightTokens.some((other) => similarToken(token, other))) return true;
    if (companyTokens.some((other) => similarToken(token, other))) return true;
  }
  return companyTokens.some((token) => rightTokens.some((other) => similarToken(token, other)));
}

function contactByEmail(companies: Company[], email: string) {
  const normalized = email.trim().toLowerCase();
  for (const company of companies) {
    const match = company.contacts.find(
      (contact) => contact.Email?.trim().toLowerCase() === normalized,
    );
    if (match) return { company, contact: match };
  }
  return null;
}

function clockFromRaw(dateTime?: string): { day: string; minutes: number } | null {
  const match = dateTime?.trim().match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;
  return {
    day: match[1],
    minutes: Number(match[2]) * 60 + Number(match[3]),
  };
}

function clockFromDate(date: Date, utc: boolean): { day: string; minutes: number } {
  const pad = (value: number) => String(value).padStart(2, "0");
  if (utc) {
    return {
      day: date.toISOString().slice(0, 10),
      minutes: date.getUTCHours() * 60 + date.getUTCMinutes(),
    };
  }
  return {
    day: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    minutes: date.getHours() * 60 + date.getMinutes(),
  };
}

function timeScore(activity: Activity, event: GraphCalendarEvent): number {
  const activityStart = new Date(activity.ActivityDate);
  const eventStartMs = graphEventStartMs(event);
  if (!Number.isNaN(activityStart.getTime()) && Number.isFinite(eventStartMs)) {
    const deltaMinutes = Math.abs(activityStart.getTime() - eventStartMs) / 60_000;
    if (deltaMinutes <= 30) return 50;
    if (deltaMinutes <= 90) return 35;
  }

  const eventClock = clockFromRaw(event.start?.dateTime);
  if (eventClock && !Number.isNaN(activityStart.getTime())) {
    for (const activityClock of [
      clockFromDate(activityStart, false),
      clockFromDate(activityStart, true),
    ]) {
      if (activityClock.day !== eventClock.day) continue;
      const delta = Math.abs(activityClock.minutes - eventClock.minutes);
      if (delta <= 30) return 50;
      if (delta <= 90) return 35;
    }
  }

  if (!Number.isNaN(activityStart.getTime()) && Number.isFinite(eventStartMs)) {
    const deltaMinutes = Math.abs(activityStart.getTime() - eventStartMs) / 60_000;
    if (deltaMinutes <= 240) return 15;
  }
  return 0;
}

export function scoreActivityCalendarMatch(
  activity: Activity,
  event: GraphCalendarEvent,
  companies: Company[],
): number {
  const timed = timeScore(activity, event);
  if (timed === 0) return 0;
  let score = timed;

  if (titlesOverlap(activity.Subject, event.subject ?? "", activity.Company?.Title)) {
    score += 40;
  }

  const attendees = graphEventAttendees(event);
  const company =
    companies.find((row) => row.Title === activity.Company?.Title) ?? null;
  const companyEmails = new Set(
    (company?.contacts ?? [])
      .map((contact) => contact.Email?.trim().toLowerCase())
      .filter((email): email is string => Boolean(email)),
  );
  if (attendees.some((row) => companyEmails.has(row.email))) score += 25;

  return score;
}

export function pickMatchingCalendarEvent(
  activity: Activity,
  events: GraphCalendarEvent[],
  companies: Company[],
): GraphCalendarEvent | null {
  let best: { event: GraphCalendarEvent; score: number } | null = null;
  for (const event of events) {
    const score = scoreActivityCalendarMatch(activity, event, companies);
    if (score < 70) continue;
    if (!best || score > best.score) best = { event, score };
  }
  return best?.event ?? null;
}

export function buildActivityPatchFromCalendarEvent(
  activity: Activity,
  event: GraphCalendarEvent,
  companies: Company[],
): UpdateActivityInput {
  const joinUrl = extractTeamsJoinUrl(event);
  const isTeams = Boolean(joinUrl || event.isOnlineMeeting);
  const attendees = graphEventAttendees(event);
  const preferredCompany =
    companies.find((row) => row.Title === activity.Company?.Title) ?? null;
  const searchOrder = preferredCompany
    ? [preferredCompany, ...companies.filter((row) => row !== preferredCompany)]
    : companies;

  const linked = [...(activity.LinkedContacts ?? [])];
  const stakeholders: ActivityStakeholder[] = [...(activity.Stakeholders ?? [])];
  const seenNames = new Set(
    [...linked.map((row) => row.Title.trim().toLowerCase()), ...stakeholders.map((row) => row.name.trim().toLowerCase())].filter(
      Boolean,
    ),
  );
  const seenIds = new Set(
    stakeholders.map((row) => row.contactId?.trim().toLowerCase()).filter(Boolean) as string[],
  );

  let primary = activity.Contact;

  for (const attendee of attendees) {
    if (isInternalEmail(attendee.email)) continue;
    const matched = contactByEmail(searchOrder, attendee.email);
    const name = matched
      ? matched.contact.Title.trim() || getContactDisplayName(matched.contact)
      : attendee.name;
    const contactId = matched?.contact.ContactID;
    const nameKey = name.trim().toLowerCase();
    const idKey = contactId?.trim().toLowerCase();
    if ((idKey && seenIds.has(idKey)) || (nameKey && seenNames.has(nameKey))) continue;
    if (idKey) seenIds.add(idKey);
    if (nameKey) seenNames.add(nameKey);
    linked.push({ Id: linked.length, Title: name });
    stakeholders.push({
      name,
      role: matched?.contact.JobTitle?.trim() || "Meeting attendee",
      contactId,
    });
    if (matched && !primary?.Title) {
      primary = { Id: matched.contact.id, Title: name };
    }
  }

  const startMs = graphEventStartMs(event);
  const endMs = graphEventEndMs(event);
  const duration =
    Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs
      ? Math.max(15, Math.round((endMs - startMs) / 60_000))
      : activity.DurationMinutes;

  return {
    ActivityType: isTeams ? "Teams Meeting" : activity.ActivityType,
    M365Targets: {
      ...inferM365Targets(isTeams ? "Teams Meeting" : activity.ActivityType),
      ...(activity.M365Targets ?? {}),
      outlook: true,
      ...(isTeams ? { teams: true } : {}),
    },
    TeamsScheduled: true,
    TeamsEventId: event.id,
    TeamsJoinUrl: joinUrl || activity.TeamsJoinUrl,
    TeamsWebLink: event.webLink?.trim() || activity.TeamsWebLink,
    LinkedContacts: linked,
    Stakeholders: stakeholders,
    Contact: primary ?? activity.Contact,
    DurationMinutes: duration,
  };
}
