import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { syncMailDeltaForIntegration } from "@/lib/m365/mail-delta-ingest";

export const dynamic = "force-dynamic";

type GraphChangeNotification = {
  subscriptionId?: string;
  clientState?: string;
  changeType?: string;
};

/**
 * Microsoft Graph inbox change notifications.
 * Validation handshake returns the token as plain text; mail creates trigger a delta sync.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const validationToken =
    url.searchParams.get("validationToken") ?? url.searchParams.get("validationtoken");
  if (validationToken) {
    return new NextResponse(validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  let payload: { value?: GraphChangeNotification[] } = {};
  try {
    payload = (await request.json()) as { value?: GraphChangeNotification[] };
  } catch {
    return new NextResponse(null, { status: 202 });
  }

  const notices = payload.value ?? [];
  const subscriptionIds = [
    ...new Set(
      notices
        .map((notice) => notice.subscriptionId?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  if (subscriptionIds.length === 0) {
    return new NextResponse(null, { status: 202 });
  }

  try {
    const prisma = getPrisma();
    const subscriptions = await prisma.webhookSubscription.findMany({
      where: { externalSubscriptionId: { in: subscriptionIds } },
      select: { integrationId: true, clientState: true, externalSubscriptionId: true },
    });

    const allowed = new Set<string>();
    for (const notice of notices) {
      const row = subscriptions.find(
        (subscription) =>
          subscription.externalSubscriptionId === notice.subscriptionId,
      );
      if (!row) continue;
      if (notice.clientState && notice.clientState !== row.clientState) continue;
      allowed.add(row.integrationId);
    }

    for (const integrationId of allowed) {
      await syncMailDeltaForIntegration(integrationId);
    }
  } catch (error) {
    console.error(
      "[graph-webhook]",
      error instanceof Error ? error.message : error,
    );
  }

  return new NextResponse(null, { status: 202 });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const validationToken =
    url.searchParams.get("validationToken") ?? url.searchParams.get("validationtoken");
  if (validationToken) {
    return new NextResponse(validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return new NextResponse(null, { status: 202 });
}
