import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import { getContactDisplayName } from "@/types/contact";

export function activityAlreadyOnTeams(activity: Activity): boolean {
  return Boolean(
    activity.TeamsScheduled ||
      activity.TeamsJoinUrl ||
      activity.TeamsEventId ||
      activity.TeamsWebLink,
  );
}

type AttendeeRef = {
  name: string;
  contactId?: string;
};

function attendeeRefs(activity: Activity): AttendeeRef[] {
  const refs: AttendeeRef[] = [];
  const seen = new Set<string>();
  const add = (name: string | undefined, contactId?: string) => {
    const trimmed = name?.trim() ?? "";
    const idKey = contactId?.trim().toLowerCase();
    const nameKey = trimmed.toLowerCase();
    if (!idKey && !nameKey) return;
    if ((idKey && seen.has(idKey)) || (nameKey && seen.has(nameKey))) return;
    if (idKey) seen.add(idKey);
    if (nameKey) seen.add(nameKey);
    refs.push({ name: trimmed, contactId: contactId?.trim() || undefined });
  };

  add(activity.Contact?.Title);
  for (const linked of activity.LinkedContacts ?? []) {
    add(linked.Title);
  }
  for (const person of activity.Stakeholders ?? []) {
    add(person.name, person.contactId);
  }
  return refs;
}

function contactMatches(
  contact: Company["contacts"][number],
  ref: AttendeeRef,
): boolean {
  if (ref.contactId) {
    if (contact.ContactID === ref.contactId) return true;
    if (String(contact.id) === ref.contactId) return true;
  }
  if (!ref.name) return false;
  const name = ref.name.toLowerCase();
  return (
    contact.Title.trim().toLowerCase() === name ||
    getContactDisplayName(contact).toLowerCase() === name ||
    `${contact.FirstName} ${contact.LastName}`.trim().toLowerCase() === name
  );
}

/** Real work emails only — never invent an address for a calendar invite. */
export function resolveActivityAttendeeEmails(
  activity: Activity,
  companies: Company[],
): string[] {
  const company =
    companies.find((row) => row.Title === activity.Company?.Title) ??
    companies.find((row) =>
      row.contacts.some((contact) =>
        attendeeRefs(activity).some((ref) => contactMatches(contact, ref)),
      ),
    );
  const pool = company
    ? company.contacts
    : companies.flatMap((row) => row.contacts);

  const emails: string[] = [];
  const seen = new Set<string>();
  for (const ref of attendeeRefs(activity)) {
    const match = pool.find((contact) => contactMatches(contact, ref));
    const email = match?.Email?.trim().toLowerCase();
    if (!email || !email.includes("@") || seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }
  return emails;
}

export function resolveActivityAttendeeNames(activity: Activity): string[] {
  return attendeeRefs(activity)
    .map((ref) => ref.name)
    .filter(Boolean);
}
