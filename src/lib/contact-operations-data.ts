import { getActivitiesForContact } from "@/lib/activity-utils";
import { daysBetween } from "@/lib/relative-time";
import type { GlobalContactRecord } from "@/lib/contact-utils";
import type { Activity } from "@/types/activity";
import { CONTACT_STATUSES, RELATIONSHIP_LEVELS } from "@/types/contact";

const COLD_CONTACT_DAYS = 45;

export type ContactOperationsSummary = {
  totalContacts: number;
  noRecentActivityCount: number;
  missingEmailCount: number;
  missingPhoneCount: number;
  activeCount: number;
  prospectingCount: number;
  byStatus: Array<{ status: string; count: number }>;
  byRelationship: Array<{ level: string; count: number }>;
};

export function buildContactOperationsSummary(
  records: GlobalContactRecord[],
  activities: Activity[],
): ContactOperationsSummary {
  let noRecentActivityCount = 0;
  let missingEmailCount = 0;
  let missingPhoneCount = 0;
  let activeCount = 0;
  let prospectingCount = 0;

  const statusCounts = Object.fromEntries(CONTACT_STATUSES.map((status) => [status, 0]));
  const relationshipCounts = Object.fromEntries(
    RELATIONSHIP_LEVELS.map((level) => [level, 0]),
  );

  for (const record of records) {
    const { contact } = record;

    if (!contact.Email.trim()) missingEmailCount += 1;
    if (!contact.Phone.trim() && !contact.Mobile.trim()) missingPhoneCount += 1;

    statusCounts[contact.Status] = (statusCounts[contact.Status] ?? 0) + 1;
    relationshipCounts[contact.RelationshipLevel] =
      (relationshipCounts[contact.RelationshipLevel] ?? 0) + 1;

    if (contact.Status === "Active") activeCount += 1;
    if (contact.Status === "Prospecting") prospectingCount += 1;

    const contactActivities = getActivitiesForContact(activities, contact.ContactID);
    const last = contactActivities[0];
    if (!last) {
      noRecentActivityCount += 1;
      continue;
    }
    if (daysBetween(last.ActivityDate, new Date()) > COLD_CONTACT_DAYS) {
      noRecentActivityCount += 1;
    }
  }

  return {
    totalContacts: records.length,
    noRecentActivityCount,
    missingEmailCount,
    missingPhoneCount,
    activeCount,
    prospectingCount,
    byStatus: CONTACT_STATUSES.map((status) => ({
      status,
      count: statusCounts[status] ?? 0,
    })).filter((entry) => entry.count > 0),
    byRelationship: RELATIONSHIP_LEVELS.map((level) => ({
      level,
      count: relationshipCounts[level] ?? 0,
    })).filter((entry) => entry.count > 0),
  };
}
