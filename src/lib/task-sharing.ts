import type { Activity } from "@/types/activity";
import type { SharePointPerson } from "@/types/company";
import { mailtoHref } from "@/lib/compose-actions";

export function taskDetailHref(activityId: string): string {
  return `/activities/${encodeURIComponent(activityId)}`;
}

export function taskAbsoluteUrl(activityId: string): string {
  if (typeof window === "undefined") return taskDetailHref(activityId);
  return `${window.location.origin}${taskDetailHref(activityId)}`;
}

export function buildTaskShareEmail(activity: Activity): {
  subject: string;
  body: string;
} {
  const due =
    activity.NextActionDate ||
    (activity.ActivityDate ? activity.ActivityDate.slice(0, 10) : "");
  const assignee = activity.ActivityOwner?.Title ?? "Unassigned";
  const link = taskAbsoluteUrl(activity.ActivityID);
  return {
    subject: `Shared task: ${activity.Subject}`,
    body: [
      `Task: ${activity.Subject}`,
      `Assignee: ${assignee}`,
      due ? `Due: ${due}` : null,
      activity.Company?.Title ? `Company: ${activity.Company.Title}` : null,
      "",
      "Open in SmartCRM:",
      link,
    ]
      .filter((line) => line !== null)
      .join("\n"),
  };
}

export function taskShareMailtoHref(activity: Activity, toEmail?: string): string {
  const { subject, body } = buildTaskShareEmail(activity);
  return mailtoHref(toEmail ?? "", subject, body);
}

export function isTaskSharedWithUser(
  activity: Pick<Activity, "ActivityType" | "SharedWith">,
  user: Pick<SharePointPerson, "Id" | "Title">,
): boolean {
  if (activity.ActivityType !== "Task") return false;
  const shared = activity.SharedWith ?? [];
  return shared.some(
    (person) =>
      person.Id === user.Id ||
      person.Title.trim().toLowerCase() === user.Title.trim().toLowerCase(),
  );
}

export function mergeSharedWith(
  current: SharePointPerson[] | undefined,
  add: SharePointPerson[],
  removeIds: number[] = [],
): SharePointPerson[] {
  const byId = new Map<number, SharePointPerson>();
  for (const person of current ?? []) {
    if (!removeIds.includes(person.Id)) byId.set(person.Id, person);
  }
  for (const person of add) {
    if (!removeIds.includes(person.Id)) byId.set(person.Id, person);
  }
  return Array.from(byId.values()).sort((a, b) => a.Title.localeCompare(b.Title));
}
