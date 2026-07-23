import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { markAsRead } from "@/lib/notifications/notification-service";
import { withPrismaRetry } from "@/lib/prisma";
import { resolveAuditActor } from "@/lib/security/audit-logger";

/**
 * PATCH /api/notifications/[id] — mark a notification as read.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const role = getRequestRole(request);
  const actor = resolveAuditActor(request, role);
  const { id } = await params;

  try {
    const body = (await request.json().catch(() => ({}))) as { read?: boolean };
    if (body.read === false) {
      return NextResponse.json(
        { error: "Only marking as read is supported" },
        { status: 400 },
      );
    }

    const existing = await withPrismaRetry((prisma) =>
      prisma.notification.findUnique({ where: { id } }),
    );
    if (!existing) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    const isOwner = existing.userId === actor.userId;
    const isAdmin = role === "superuser" || role === "admin";
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await markAsRead(id);
    if (!updated) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, notification: updated });
  } catch (error) {
    console.error("[notifications PATCH]", error);
    return NextResponse.json(
      { error: "Failed to update notification" },
      { status: 500 },
    );
  }
}
