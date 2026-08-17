import "server-only";

import { getPrisma } from "@/lib/prisma";
import {
  fetchGraphMailMessageView,
  getActiveM365AccessToken,
} from "@/lib/m365-client";
import { buildOutlookReadDeeplink } from "@/lib/m365/outlook-deeplink";

export type EmailMessageViewDto = {
  id: string;
  externalMessageId: string;
  subject: string;
  bodyPreview: string | null;
  bodyText: string | null;
  webLink: string | null;
  senderEmail: string;
  sentAt: string;
  enrichedFromGraph: boolean;
};

/**
 * SmartCRM preview + Outlook deep link for a synced message.
 * Enriches from Graph when webLink / fuller body is missing.
 */
export async function readEmailMessageView(
  emailId: string,
  options?: { enrich?: boolean },
): Promise<EmailMessageViewDto | null> {
  const prisma = getPrisma();
  const message = await prisma.emailMessageRecord.findUnique({
    where: { id: emailId },
    select: {
      id: true,
      externalMessageId: true,
      subject: true,
      bodyPreview: true,
      webLink: true,
      senderEmail: true,
      sentAt: true,
    },
  });
  if (!message) return null;

  let webLink = message.webLink;
  let bodyPreview = message.bodyPreview;
  let bodyText: string | null = bodyPreview;
  let enrichedFromGraph = false;

  const needsEnrich =
    options?.enrich !== false &&
    (!webLink || !bodyPreview || (bodyPreview?.length ?? 0) < 80);

  if (needsEnrich && message.externalMessageId) {
    try {
      const token = await getActiveM365AccessToken();
      if (token?.accessToken) {
        const view = await fetchGraphMailMessageView(
          token.accessToken,
          message.externalMessageId,
        );
        enrichedFromGraph = true;
        if (view.webLink) webLink = view.webLink;
        if (view.bodyPreview) bodyPreview = view.bodyPreview;
        if (view.bodyText) bodyText = view.bodyText;
        else if (view.bodyPreview) bodyText = view.bodyPreview;

        if (view.webLink || view.bodyPreview) {
          await prisma.emailMessageRecord.update({
            where: { id: message.id },
            data: {
              ...(view.webLink ? { webLink: view.webLink } : {}),
              ...(view.bodyPreview
                ? { bodyPreview: view.bodyPreview.slice(0, 2000) }
                : {}),
            },
          });
        }
      }
    } catch (error) {
      console.warn(
        "[email-message-view] Graph enrich failed:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (!webLink && message.externalMessageId) {
    webLink = buildOutlookReadDeeplink(message.externalMessageId);
    if (webLink) {
      await prisma.emailMessageRecord
        .update({
          where: { id: message.id },
          data: { webLink },
        })
        .catch(() => undefined);
    }
  }

  return {
    id: message.id,
    externalMessageId: message.externalMessageId,
    subject: message.subject,
    bodyPreview,
    bodyText: bodyText ?? bodyPreview,
    webLink,
    senderEmail: message.senderEmail,
    sentAt: message.sentAt.toISOString(),
    enrichedFromGraph,
  };
}
