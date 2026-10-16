import "server-only";

import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { toCompanyTrackingId } from "@/lib/prisma-mappers";
import { pingColleagueAboutAssignment } from "@/lib/m365/colleague-assignment-notify";
import {
  assignmentNoticeCopy,
  assignmentNoticeLink,
  assignmentShouldNotify,
} from "@/lib/notifications/activity-assignment";
import { createNotification } from "@/lib/notifications/notification-service";
import { resolvePublicAppOrigin } from "@/lib/smartcrm-origin";
import { readUsers } from "@/lib/users-access-db";
import { company360Href } from "@/types/company-360";
import type { StandardBioUserRecord } from "@/types/user-access";

async function notificationUserIdForEmail(email: string): Promise<string | null> {
  const match = await findColleague({ email });
  return match ? String(match.id) : null;
}

/** Inbox key for the signed-in colleague — email/name first, never a shared placeholder id. */
export async function resolveNotificationInboxUserId(input: {
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
}): Promise<string> {
  const match = await findColleague({
    email: input.userEmail,
    name: input.userName,
    id: Number(input.userId),
  });
  return match ? String(match.id) : input.userId;
}

async function findColleague(input: {
  email?: string | null;
  name?: string | null;
  id?: number | null;
}): Promise<StandardBioUserRecord | null> {
  const users = await readUsers();
  const email = input.email?.trim().toLowerCase() ?? "";
  if (email && !email.endsWith("@smartcrm.local")) {
    const byEmail = users.find((entry) => entry.email.trim().toLowerCase() === email);
    if (byEmail) return byEmail;
  }
  const name = input.name?.trim().toLowerCase() ?? "";
  if (name && name !== "guest") {
    const byName = users.find((entry) => entry.displayName.trim().toLowerCase() === name);
    if (byName) return byName;
  }
  if (input.id != null && Number.isFinite(input.id) && input.id > 0) {
    return users.find((entry) => entry.id === input.id) ?? null;
  }
  return null;
}

async function resolveSessionAssigner(): Promise<{
  id: number | null;
  title: string | null;
  email: string | null;
}> {
  try {
    const session = await auth();
    const email = session?.user?.email?.trim() || null;
    const name = session?.user?.name?.trim() || null;
    const match = await findColleague({ email, name });
    return {
      id: match?.id ?? null,
      title: match?.displayName ?? name,
      email: match?.email ?? email,
    };
  } catch {
    return { id: null, title: null, email: null };
  }
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
      const linked =
        project?.linkedCompanyId?.trim() ||
        project?.relatedOrganizations?.find((org) => org.isPrimary)?.companyId?.trim() ||
        project?.relatedOrganizations?.[0]?.companyId?.trim();
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

/** Bell + Teams/Outlook ping when a colleague is given an activity. */
export async function notifyActivityAssigned(input: {
  activityId: string;
  subject: string;
  assigneeId: number;
  assigneeTitle: string;
  previousOwnerId?: number | null;
  companyName?: string | null;
  dueDate?: string | null;
  assignerTitle?: string | null;
}): Promise<void> {
  const assigner = await resolveSessionAssigner();
  const assignee = await findColleague({
    id: input.assigneeId,
    name: input.assigneeTitle,
  });
  const assignerTitle = assigner.title || input.assignerTitle;
  if (
    !assignmentShouldNotify({
      previousOwnerId: input.previousOwnerId,
      nextOwnerId: input.assigneeId,
      assignerId: assigner.id,
      assignerEmail: assigner.email,
      assigneeEmail: assignee?.email,
      assignerTitle,
      assigneeTitle: assignee?.displayName ?? input.assigneeTitle,
    })
  ) {
    return;
  }

  const userId = String(assignee?.id ?? input.assigneeId);
  const link = assignmentNoticeLink({
    activityId: input.activityId,
    assigneeId: input.assigneeId,
    previousOwnerId: input.previousOwnerId,
  });
  if (await alreadyNotified(userId, link)) return;

  const openUrl = `${resolvePublicAppOrigin()}${link}`;
  const copy = assignmentNoticeCopy({
    subject: input.subject,
    assignerTitle,
    companyName: input.companyName,
    dueDate: input.dueDate,
    openUrl,
  });

  await createNotification({
    userId,
    type: "ALERT",
    title: copy.title,
    message: copy.message,
    link,
  });

  if (assignee?.email) {
    try {
      await pingColleagueAboutAssignment({
        assigneeEmail: assignee.email,
        html: copy.html,
        mailSubject: copy.mailSubject,
      });
    } catch (error) {
      console.warn(
        "[assignment-notify] colleague ping failed",
        error instanceof Error ? error.message : error,
      );
    }
  }
}
