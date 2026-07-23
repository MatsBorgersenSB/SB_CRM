import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import {
  createNotification,
  listNotificationsForUser,
} from "@/lib/notifications/notification-service";
import { resolveAuditActor } from "@/lib/security/audit-logger";

/**
 * GET /api/notifications — active notifications for the current session user.
 * Seeds a welcome INFO notification once when the inbox is empty.
 */
export async function GET(request: Request) {
  const role = getRequestRole(request);
  const actor = resolveAuditActor(request, role);
  const userId = actor.userId;

  try {
    let notifications = await listNotificationsForUser(userId, { limit: 40 });

    if (notifications.length === 0) {
      await createNotification({
        userId,
        title: "Welcome to SmartCRM alerts",
        message:
          "Deal wins, approvals, and team alerts will appear here. You decide what to act on.",
        type: "INFO",
        link: "/attention",
        actor,
      });
      notifications = await listNotificationsForUser(userId, { limit: 40 });
    }

    const unreadCount = notifications.filter((row) => !row.read).length;

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error("[notifications GET]", error);
    return NextResponse.json(
      { error: "Failed to load notifications" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/notifications — create a notification for a user.
 */
export async function POST(request: Request) {
  const role = getRequestRole(request);
  if (role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      userId?: string;
      title?: string;
      message?: string;
      type?: "INFO" | "ALERT" | "APPROVAL" | "DEAL_WIN";
      link?: string;
    };

    const actor = resolveAuditActor(request, role);
    const title = body.title?.trim();
    const message = body.message?.trim();
    const type = body.type ?? "INFO";

    if (!title || !message) {
      return NextResponse.json(
        { error: "title and message are required" },
        { status: 400 },
      );
    }

    const notification = await createNotification({
      userId: body.userId?.trim() || actor.userId,
      title,
      message,
      type,
      link: body.link,
      actor,
    });

    return NextResponse.json({ success: true, notification }, { status: 201 });
  } catch (error) {
    console.error("[notifications POST]", error);
    return NextResponse.json(
      { error: "Failed to create notification" },
      { status: 500 },
    );
  }
}
