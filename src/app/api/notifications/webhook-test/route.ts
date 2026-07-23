import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import {
  sendWebhookAlert,
  type WebhookPlatform,
} from "@/lib/notifications/webhook-service";
import {
  clientIpFromRequest,
  logAuditEvent,
  resolveAuditActor,
} from "@/lib/security/audit-logger";
import { isManagerOrAbove } from "@/lib/security/rbac";

/**
 * POST /api/notifications/webhook-test
 * Body: { platform: 'SLACK' | 'TEAMS', webhookUrl: string, event?: string, payload?: object }
 * Restricted to ADMIN / MANAGER.
 */
export async function POST(request: Request) {
  const role = getRequestRole(request);

  if (!isManagerOrAbove({ role })) {
    return NextResponse.json(
      { error: "Forbidden — webhook test requires ADMIN or MANAGER" },
      { status: 403 },
    );
  }

  try {
    const body = (await request.json()) as {
      platform?: WebhookPlatform;
      webhookUrl?: string;
      event?: string;
      payload?: Record<string, unknown>;
    };

    const platform = body.platform;
    const webhookUrl = body.webhookUrl?.trim();

    if (platform !== "SLACK" && platform !== "TEAMS") {
      return NextResponse.json(
        { error: "platform must be SLACK or TEAMS" },
        { status: 400 },
      );
    }
    if (!webhookUrl) {
      return NextResponse.json(
        { error: "webhookUrl is required" },
        { status: 400 },
      );
    }

    const event = body.event?.trim() || "WEBHOOK_TEST";
    const payload = body.payload ?? {
      title: "SmartCRM webhook test",
      message:
        "This is a sample alert from SmartCRM collaboration channels. If you see this, the webhook is connected.",
    };

    const result = await sendWebhookAlert(platform, webhookUrl, event, payload);

    const actor = resolveAuditActor(request, role);
    await logAuditEvent({
      ...actor,
      action: "WEBHOOK_DISPATCHED",
      entityType: "Webhook",
      entityId: platform,
      ipAddress: clientIpFromRequest(request),
      metadata: {
        event,
        ok: result.ok,
        status: result.status,
        detail: result.detail,
      },
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, result },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[notifications/webhook-test]", error);
    return NextResponse.json(
      { error: "Failed to dispatch webhook" },
      { status: 500 },
    );
  }
}
