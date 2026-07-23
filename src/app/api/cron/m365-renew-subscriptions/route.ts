import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import {
  getAccessTokenForIntegration,
  M365_SUBSCRIPTION_RENEWAL_MINUTES,
  renewGraphSubscription,
} from "@/lib/m365-client";

/**
 * Authorize cron callers with CRON_SECRET (Bearer or x-cron-secret).
 */
function assertCronAuthorized(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  const bearer =
    authHeader?.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : null;
  const headerSecret = request.headers.get("x-cron-secret")?.trim() ?? null;
  const provided = bearer || headerSecret;

  if (!provided || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

/**
 * Renew Graph webhook subscriptions expiring within 24 hours.
 * Extends each subscription by 4230 minutes (~3 days) via PATCH /subscriptions/{id}.
 */
async function renewExpiringSubscriptions() {
  const prisma = getPrisma();
  const horizon = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const due = await prisma.webhookSubscription.findMany({
    where: {
      expiresAt: { lte: horizon },
      integration: { status: "active", provider: "m365_graph" },
    },
    include: {
      integration: { select: { id: true, status: true } },
    },
    orderBy: { expiresAt: "asc" },
  });

  const results: Array<{
    id: string;
    externalSubscriptionId: string;
    status: "renewed" | "failed" | "skipped";
    expiresAt?: string;
    error?: string;
  }> = [];

  for (const subscription of due) {
    try {
      const accessToken = await getAccessTokenForIntegration(subscription.integrationId);
      if (!accessToken) {
        results.push({
          id: subscription.id,
          externalSubscriptionId: subscription.externalSubscriptionId,
          status: "skipped",
          error: "No active access token for integration",
        });
        continue;
      }

      const nextExpiry = new Date(
        Date.now() + M365_SUBSCRIPTION_RENEWAL_MINUTES * 60 * 1000,
      );

      const renewed = await renewGraphSubscription(
        accessToken,
        subscription.externalSubscriptionId,
        nextExpiry,
      );

      const expiresAt = renewed.expirationDateTime
        ? new Date(renewed.expirationDateTime)
        : nextExpiry;

      await prisma.webhookSubscription.update({
        where: { id: subscription.id },
        data: { expiresAt },
      });

      results.push({
        id: subscription.id,
        externalSubscriptionId: subscription.externalSubscriptionId,
        status: "renewed",
        expiresAt: expiresAt.toISOString(),
      });
    } catch (error) {
      results.push({
        id: subscription.id,
        externalSubscriptionId: subscription.externalSubscriptionId,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    dueCount: due.length,
    renewed: results.filter((r) => r.status === "renewed").length,
    failed: results.filter((r) => r.status === "failed").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    results,
  };
}

export async function GET(request: Request) {
  const unauthorized = assertCronAuthorized(request);
  if (unauthorized) return unauthorized;

  try {
    const summary = await renewExpiringSubscriptions();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("[cron m365-renew-subscriptions GET]", error);
    return NextResponse.json(
      {
        error: "Subscription renewal failed",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
