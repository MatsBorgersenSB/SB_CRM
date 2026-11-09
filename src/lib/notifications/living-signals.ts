import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { toCompanyTrackingId } from "@/lib/prisma-mappers";
import { pingColleagueAboutAssignment } from "@/lib/m365/colleague-assignment-notify";
import {
  assignmentShouldNotify,
  ownershipNoticeCopy,
  ownershipNoticeLink,
  type OwnershipEntityKind,
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
  let email: string | null = null;
  let name: string | null = null;
  let id: number | null = null;

  try {
    const session = await auth();
    email = session?.user?.email?.trim() || null;
    name = session?.user?.name?.trim() || null;
  } catch {
    /* session unavailable outside request context */
  }

  if (!email || !name) {
    try {
      const reqHeaders = await headers();
      const headerEmail = reqHeaders.get("x-sb-user-email")?.trim() || null;
      const headerName = reqHeaders.get("x-sb-user-name")?.trim() || null;
      const headerId = Number(reqHeaders.get("x-sb-user-id") ?? "");
      if (!email && headerEmail && !headerEmail.endsWith("@smartcrm.local")) {
        email = headerEmail;
      }
      if (!name && headerName) {
        name = headerName;
      }
      if (Number.isFinite(headerId) && headerId > 0) {
        id = headerId;
      }
    } catch {
      /* headers unavailable outside request context */
    }
  }

  try {
    const match = await findColleague({ email, name, id });
    return {
      id: match?.id ?? id,
      title: match?.displayName ?? name,
      email: match?.email ?? email,
    };
  } catch {
    return { id, title: name, email };
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

/** Bell + Teams/Outlook ping when a colleague is given responsibility for a record. */
export async function notifyOwnershipAssigned(input: {
  kind: OwnershipEntityKind;
  entityId: string;
  subject: string;
  assigneeId?: number | null;
  assigneeTitle?: string | null;
  previousOwnerId?: number | null;
  previousOwnerTitle?: string | null;
  companyName?: string | null;
  dueDate?: string | null;
  assignerTitle?: string | null;
}): Promise<void> {
  const assigner = await resolveSessionAssigner();
  const assignee = await findColleague({
    id: input.assigneeId != null && input.assigneeId > 0 ? input.assigneeId : null,
    name: input.assigneeTitle,
  });
  const previousColleague =
    (input.previousOwnerId == null || input.previousOwnerId <= 0) &&
    input.previousOwnerTitle?.trim()
      ? await findColleague({ name: input.previousOwnerTitle })
      : null;

  const resolvedAssigneeId =
    assignee?.id ??
    (input.assigneeId != null && input.assigneeId > 0 ? input.assigneeId : null);
  if (!resolvedAssigneeId) return;

  const resolvedPreviousOwnerId =
    input.previousOwnerId != null && input.previousOwnerId > 0
      ? input.previousOwnerId
      : (previousColleague?.id ?? null);

  const assignerTitle = assigner.title || input.assignerTitle;
  const assigneeTitle = assignee?.displayName ?? input.assigneeTitle ?? null;

  if (
    !assignmentShouldNotify({
      previousOwnerId: resolvedPreviousOwnerId,
      nextOwnerId: resolvedAssigneeId,
      previousOwnerTitle: input.previousOwnerTitle,
      assignerId: assigner.id,
      assignerEmail: assigner.email,
      assigneeEmail: assignee?.email,
      assignerTitle,
      assigneeTitle,
    })
  ) {
    return;
  }

  const userId = String(resolvedAssigneeId);
  const link = ownershipNoticeLink({
    kind: input.kind,
    entityId: input.entityId,
    assigneeId: resolvedAssigneeId,
    previousOwnerId: resolvedPreviousOwnerId,
  });
  if (await alreadyNotified(userId, link)) return;

  const openUrl = `${resolvePublicAppOrigin()}${link}`;
  const copy = ownershipNoticeCopy({
    kind: input.kind,
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
  await notifyOwnershipAssigned({
    kind: "activity",
    entityId: input.activityId,
    subject: input.subject,
    assigneeId: input.assigneeId,
    assigneeTitle: input.assigneeTitle,
    previousOwnerId: input.previousOwnerId,
    companyName: input.companyName,
    dueDate: input.dueDate,
    assignerTitle: input.assignerTitle,
  });
}
