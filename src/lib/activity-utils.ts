import type { Company } from "@/types/company";
import type { Contact } from "@/types/contact";
import type { PipelineRow } from "@/types/pipeline";
import type { Activity, ActivityFilters } from "@/types/activity";
import { EMPTY_ACTIVITY_FILTERS } from "@/types/activity";

export type ActivityDateGroup =
  | "Today"
  | "Yesterday"
  | "Last 7 Days"
  | "Last Month"
  | "Older";

export type GroupedActivities = {
  label: ActivityDateGroup;
  activities: Activity[];
};

export type ActivityIntelligence = {
  openFollowUps: number;
  overdueFollowUps: number;
  upcomingActions: Activity[];
  mostActiveCompanies: { companyId: string; companyName: string; count: number }[];
  mostActiveDeals: { dealId: string; dealName: string; count: number }[];
};

function parseActivityDate(value: string): Date {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(normalized);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatActivityDateTime(value: string): string {
  const date = parseActivityDate(value);
  const now = new Date();
  const today = startOfDay(now);
  const activityDay = startOfDay(date);

  const time = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (activityDay.getTime() === today.getTime()) return `Today ${time}`;

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (activityDay.getTime() === yesterday.getTime()) return `Yesterday ${time}`;

  const datePart = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: activityDay.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });

  return `${datePart} ${time}`;
}

export function formatDueDate(value: string): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function getActivityDateGroup(value: string): ActivityDateGroup {
  const date = startOfDay(parseActivityDate(value));
  const now = startOfDay(new Date());
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays <= 7) return "Last 7 Days";
  if (diffDays <= 30) return "Last Month";
  return "Older";
}

const GROUP_ORDER: ActivityDateGroup[] = [
  "Today",
  "Yesterday",
  "Last 7 Days",
  "Last Month",
  "Older",
];

export function groupActivitiesByDate(activities: Activity[]): GroupedActivities[] {
  const buckets = new Map<ActivityDateGroup, Activity[]>();

  for (const group of GROUP_ORDER) {
    buckets.set(group, []);
  }

  const sorted = [...activities].sort(
    (a, b) =>
      parseActivityDate(b.ActivityDate).getTime() -
      parseActivityDate(a.ActivityDate).getTime(),
  );

  for (const activity of sorted) {
    buckets.get(getActivityDateGroup(activity.ActivityDate))!.push(activity);
  }

  return GROUP_ORDER.flatMap((label) => {
    const items = buckets.get(label)!;
    return items.length > 0 ? [{ label, activities: items }] : [];
  });
}

export function isFollowUpOverdue(activity: Activity): boolean {
  if (!activity.ActionRequired || !activity.NextActionDate) return false;
  if (activity.ActionStatus === "Completed" || activity.ActionStatus === "Cancelled") {
    return false;
  }
  return (
    startOfDay(new Date(activity.NextActionDate)).getTime() <
    startOfDay(new Date()).getTime()
  );
}

export function isFollowUpOpen(activity: Activity): boolean {
  return (
    activity.ActionRequired &&
    activity.ActionStatus !== "Completed" &&
    activity.ActionStatus !== "Cancelled"
  );
}

function contactDisplayNameFromParts(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

/** Match activities linked by ContactID, SharePoint id, or display name. */
export function activityMatchesContact(
  activity: Activity,
  contactId: string,
  contact?: Pick<Contact, "FirstName" | "LastName" | "Title" | "id">,
): boolean {
  const contactTitle = activity.Contact?.Title?.trim() ?? "";
  if (!contactTitle) return false;

  if (contactTitle === contactId) return true;
  if (contact && String(contact.id) === contactTitle) return true;

  if (contact) {
    const displayName = contact.Title || contactDisplayNameFromParts(contact.FirstName, contact.LastName);
    if (contactTitle === displayName) return true;
  }

  if (contactTitle.includes(contactId)) return true;

  return false;
}

function matchesCompany(
  activity: Activity,
  companyId: string,
  companies: Company[],
): boolean {
  const company = companies.find(
    (c) => c.CompanyID === companyId || c.Title === companyId,
  );
  if (!company) return activity.Company?.Title === companyId;

  if (activity.Company?.Title === company.Title) return true;

  const contactIds = new Set(company.contacts.map((c) => c.ContactID));
  const contactNames = new Set(
    company.contacts.map((c) => `${c.FirstName} ${c.LastName}`.trim()),
  );

  if (activity.Contact?.Title && contactIds.has(activity.Contact.Title)) return true;
  if (activity.Contact?.Title && contactNames.has(activity.Contact.Title)) return true;

  return false;
}

export function filterActivities(
  activities: Activity[],
  filters: ActivityFilters = EMPTY_ACTIVITY_FILTERS,
  companies: Company[] = [],
): Activity[] {
  const search = filters.search.trim().toLowerCase();

  return activities.filter((activity) => {
    if (search) {
      const haystack = [
        activity.Subject,
        activity.Summary,
        activity.ActivityDescription,
        activity.Company?.Title,
        activity.Contact?.Title,
        activity.Deal?.Title,
        activity.ActivityOwner?.Title,
        activity.NextAction,
        ...(activity.KeyDecisions ?? []),
        ...(activity.AgreedActions ?? []).map((a) => a.text),
        ...(activity.Risks ?? []),
        ...(activity.LinkedDocuments ?? []).map((d) => d.Title),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(search)) return false;
    }

    if (filters.companyId && !matchesCompany(activity, filters.companyId, companies)) {
      return false;
    }

    if (filters.contactId) {
      if (!activityMatchesContact(activity, filters.contactId)) {
        return false;
      }
    }

    if (filters.dealId && activity.Deal?.Title !== filters.dealId) return false;
    if (filters.activityType && activity.ActivityType !== filters.activityType) {
      return false;
    }
    if (
      filters.ownerId &&
      activity.ActivityOwner?.Title !== filters.ownerId &&
      String(activity.ActivityOwner?.Id) !== filters.ownerId
    ) {
      return false;
    }
    if (filters.status && activity.ActionStatus !== filters.status) return false;

    if (filters.dateFrom) {
      const from = startOfDay(new Date(filters.dateFrom));
      if (parseActivityDate(activity.ActivityDate) < from) return false;
    }
    if (filters.dateTo) {
      const to = startOfDay(new Date(filters.dateTo));
      to.setHours(23, 59, 59, 999);
      if (parseActivityDate(activity.ActivityDate) > to) return false;
    }

    return true;
  });
}

export function getActivitiesForContact(
  activities: Activity[],
  contactId: string,
  contact?: Pick<Contact, "FirstName" | "LastName" | "Title" | "id">,
): Activity[] {
  return activities
    .filter((activity) => activityMatchesContact(activity, contactId, contact))
    .sort(
      (a, b) =>
        parseActivityDate(b.ActivityDate).getTime() -
        parseActivityDate(a.ActivityDate).getTime(),
    );
}

export function getActivitiesForCompany(
  activities: Activity[],
  company: Pick<Company, "CompanyID" | "Title" | "contacts">,
): Activity[] {
  return filterActivities(activities, { ...EMPTY_ACTIVITY_FILTERS, companyId: company.CompanyID }, [
    company as Company,
  ]);
}

export function getActivitiesForDeal(
  activities: Activity[],
  dealId: string,
): Activity[] {
  return getActivitiesForDealId(activities, dealId);
}

function getActivitiesForDealId(activities: Activity[], dealId: string): Activity[] {
  return activities
    .filter((a) => a.Deal?.Title === dealId)
    .sort(
      (a, b) =>
        parseActivityDate(b.ActivityDate).getTime() -
        parseActivityDate(a.ActivityDate).getTime(),
    );
}

export function getActivitiesForProject(
  activities: Activity[],
  projectId: string,
  options?: { linkedDealId?: string | null },
): Activity[] {
  const id = projectId.trim();
  if (!id) return [];
  const linkedDealId = options?.linkedDealId?.trim() || "";
  return activities
    .filter((a) => {
      if (a.ProjectId === id) return true;
      // Legacy: project pages previously scoped by linked opportunity only.
      if (!a.ProjectId && linkedDealId && a.Deal?.Title === linkedDealId) return true;
      return false;
    })
    .sort(
      (a, b) =>
        parseActivityDate(b.ActivityDate).getTime() -
        parseActivityDate(a.ActivityDate).getTime(),
    );
}

export function computeActivityIntelligence(
  activities: Activity[],
  pipelines: PipelineRow[],
): ActivityIntelligence {
  const openFollowUps = activities.filter(isFollowUpOpen).length;
  const overdueFollowUps = activities.filter(isFollowUpOverdue).length;

  const upcomingActions = activities
    .filter(isFollowUpOpen)
    .sort(
      (a, b) =>
        new Date(a.NextActionDate || "9999").getTime() -
        new Date(b.NextActionDate || "9999").getTime(),
    )
    .slice(0, 5);

  const companyCounts = new Map<string, { name: string; count: number }>();
  for (const activity of activities) {
    const key = activity.Company?.Title ?? "Unknown";
    const current = companyCounts.get(key) ?? { name: key, count: 0 };
    current.count += 1;
    companyCounts.set(key, current);
  }

  const mostActiveCompanies = Array.from(companyCounts.entries())
    .map(([companyId, { name, count }]) => ({
      companyId,
      companyName: name,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const dealCounts = new Map<string, number>();
  for (const activity of activities) {
    if (!activity.Deal?.Title) continue;
    dealCounts.set(
      activity.Deal.Title,
      (dealCounts.get(activity.Deal.Title) ?? 0) + 1,
    );
  }

  const mostActiveDeals = Array.from(dealCounts.entries())
    .map(([dealId, count]) => {
      const pipeline = pipelines.find((p) => p.id === dealId);
      return {
        dealId,
        dealName: pipeline?.assetName ?? dealId,
        count,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    openFollowUps,
    overdueFollowUps,
    upcomingActions,
    mostActiveCompanies,
    mostActiveDeals,
  };
}

/** @deprecated Use getActivitiesForContact from activity-utils */
export function getInteractionsForContact(
  activities: Activity[],
  contactId: string,
): Activity[] {
  return getActivitiesForContact(activities, contactId);
}
