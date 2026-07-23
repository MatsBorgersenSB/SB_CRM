import type { NotificationType, Prisma } from "@/generated/prisma";
import { withPrismaRetry } from "@/lib/prisma";
import { logAuditEvent } from "@/lib/security/audit-logger";
import type { UserRole } from "@/types/auth";

export type CreateNotificationInput = {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  link?: string | null;
  /** Optional actor for audit trail */
  actor?: {
    userId: string;
    userEmail: string;
    userName?: string | null;
    accessRole?: UserRole;
  };
};

export type NotificationDto = {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  link: string | null;
  createdAt: string;
};

function toDto(row: {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  link: string | null;
  createdAt: Date;
}): NotificationDto {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    message: row.message,
    type: row.type,
    read: row.read,
    link: row.link,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Persist a notification for a user and write NOTIFICATION_CREATED audit.
 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<NotificationDto> {
  const created = await withPrismaRetry((prisma) =>
    prisma.notification.create({
      data: {
        userId: input.userId,
        title: input.title.trim(),
        message: input.message.trim(),
        type: input.type,
        link: input.link?.trim() || null,
      },
    }),
  );

  if (input.actor) {
    await logAuditEvent({
      ...input.actor,
      action: "NOTIFICATION_CREATED",
      entityType: "Notification",
      entityId: created.id,
      metadata: {
        targetUserId: input.userId,
        type: input.type,
        title: input.title,
      },
    });
  }

  return toDto(created);
}

export async function markAsRead(notificationId: string): Promise<NotificationDto | null> {
  try {
    const updated = await withPrismaRetry((prisma) =>
      prisma.notification.update({
        where: { id: notificationId },
        data: { read: true },
      }),
    );
    return toDto(updated);
  } catch {
    return null;
  }
}

export async function listNotificationsForUser(
  userId: string,
  options?: { unreadOnly?: boolean; limit?: number },
): Promise<NotificationDto[]> {
  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(options?.unreadOnly ? { read: false } : {}),
  };

  const rows = await withPrismaRetry((prisma) =>
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options?.limit ?? 50,
    }),
  );

  return rows.map(toDto);
}

export async function countUnreadForUser(userId: string): Promise<number> {
  return withPrismaRetry((prisma) =>
    prisma.notification.count({
      where: { userId, read: false },
    }),
  );
}
