import "server-only";

import { getPrisma } from "@/lib/prisma";
import { toCompanyTrackingId } from "@/lib/prisma-mappers";
import { createNotification } from "@/lib/notifications/notification-service";
import { readUsers } from "@/lib/users-access-db";
import { company360Href } from "@/types/company-360";

async function notificationUserIdForEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const users = await readUsers();
  const user = users.find((entry) => entry.email.trim().toLowerCase() === normalized);
  return user ? String(user.id) : null;
}

async function alreadyNotified(userId: string, link: string): Promise<boolean> {
  const existing = await getPrisma().notification.findFirst({
    where: { userId, link },
    select: { id: true },
  });
  return Boolean(existing);
}

/**
 * Bell alert when new inbound mail is linked to a relationship we already know.
 */
export async function notifyInboundMail(input: {
  recordId: string;
  subject: string;
  senderEmail: string;
  mailboxEmail: string;
  contactId: string | null;
  opportunityId: string | null;
  projectId: string | null;
  projectName: string | null;
  tagged?: boolean;
}): Promise<void> {
  const relevant = Boolean(
    input.contactId || input.opportunityId || input.projectId || input.tagged,
  );
  if (!relevant) return;

  const userId = await notificationUserIdForEmail(input.mailboxEmail);
  if (!userId) return;

  const prisma = getPrisma();
  let companyCode: string | null = null;
  let companyName: string | null = null;

  if (input.contactId) {
    const contact = await prisma.contact.findUnique({
      where: { id: input.contactId },
      select: { company: { select: { id: true, code: true, name: true } } },
    });
    if (contact?.company) {
      companyCode = contact.company.code?.trim() || toCompanyTrackingId(contact.company.id);
      companyName = contact.company.name;
    }
  }

  if (!companyCode && input.opportunityId) {
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: input.opportunityId },
      select: { company: { select: { id: true, code: true, name: true } } },
    });
    if (opportunity?.company) {
      companyCode =
        opportunity.company.code?.trim() || toCompanyTrackingId(opportunity.company.id);
      companyName = opportunity.company.name;
    }
  }

  if (!companyCode && input.projectId) {
    try {
      const { readProjects } = await import("@/lib/project-db");
      const project = (await readProjects()).find((entry) => entry.id === input.projectId);
      const linked = project?.linkedCompanyId?.trim() || project?.companyId?.trim();
      if (linked) {
        companyCode = linked;
        companyName = project?.name ?? companyName;
      }
    } catch {
      /* project store is optional */
    }
  }

  const subject = input.subject.replace(/^((re|fw|fwd|sv|vs):\s*)+/i, "").trim() || input.subject;
  const link = companyCode
    ? `${company360Href(companyCode)}?mail=${encodeURIComponent(input.recordId)}`
    : input.projectId
      ? `/projects/${encodeURIComponent(input.projectId)}?mail=${encodeURIComponent(input.recordId)}`
      : `/?mail=${encodeURIComponent(input.recordId)}`;

  if (await alreadyNotified(userId, link)) return;

  const place = companyName || input.projectName?.trim() || "a relationship";
  await createNotification({
    userId,
    type: "ALERT",
    title: `${place} — new mail`,
    message: `From ${input.senderEmail}: ${subject}`,
    link,
  });
}

/** Bell alert when a colleague assigns an activity to someone else. */
export async function notifyActivityAssigned(input: {
  activityId: string;
  subject: string;
  assigneeId: number;
  assigneeTitle: string;
  assignerTitle?: string | null;
}): Promise<void> {
  const userId = String(input.assigneeId);
  const link = `/activities/${encodeURIComponent(input.activityId)}?assigned=${input.assigneeId}`;
  if (await alreadyNotified(userId, link)) return;

  const who = input.assignerTitle?.trim();
  await createNotification({
    userId,
    type: "ALERT",
    title: "Assigned to you",
    message: who
      ? `${who} assigned you: ${input.subject}`
      : `You now own: ${input.subject}`,
    link,
  });
}
