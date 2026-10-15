import "server-only";

import { getPrisma } from "@/lib/prisma";
import {
  graphRequest,
  M365_SUBSCRIPTION_RENEWAL_MINUTES,
} from "@/lib/m365-client";

const INBOX_RESOURCE = "/me/mailFolders('Inbox')/messages";

function publicAppUrl(): string | null {
  const raw = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");
  if (!raw.startsWith("https://")) return null;
  return raw;
}

/**
 * Keep a Graph inbox change-notification so new mail syncs without waiting on cron.
 */
export async function ensureMailInboxSubscription(
  integrationId: string,
  accessToken: string,
): Promise<void> {
  const notificationUrl = publicAppUrl();
  if (!notificationUrl) return;

  const prisma = getPrisma();
  const existing = await prisma.webhookSubscription.findFirst({
    where: {
      integrationId,
      resource: INBOX_RESOURCE,
      expiresAt: { gt: new Date(Date.now() + 60 * 60 * 1000) },
    },
    select: { id: true },
  });
  if (existing) return;

  const clientState = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + M365_SUBSCRIPTION_RENEWAL_MINUTES * 60 * 1000,
  );

  const created = await graphRequest<{
    id?: string;
    expirationDateTime?: string;
  }>(accessToken, "/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      changeType: "created",
      notificationUrl: `${notificationUrl}/api/m365/graph-webhook`,
      resource: INBOX_RESOURCE,
      expirationDateTime: expiresAt.toISOString(),
      clientState,
    }),
  });

  if (!created.id) return;

  await prisma.webhookSubscription.create({
    data: {
      integrationId,
      externalSubscriptionId: created.id,
      resource: INBOX_RESOURCE,
      clientState,
      expiresAt: created.expirationDateTime
        ? new Date(created.expirationDateTime)
        : expiresAt,
    },
  });
}
