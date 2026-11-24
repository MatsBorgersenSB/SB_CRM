import "server-only";

import {
  getActiveM365AccessToken,
  graphRequest,
} from "@/lib/m365-client";
import { getSessionAzureOid } from "@/lib/m365/session-graph-user";

/**
 * Post an Adaptive Card to a Teams channel (FS-018 Phase 4 weekly attention loop).
 * Uses the signed-in user's delegated ChannelMessage.Send token.
 */
export async function postAdaptiveCardToTeamsChannel(input: {
  teamId: string;
  channelId: string;
  card: Record<string, unknown>;
  fallbackText: string;
}): Promise<{ messageId: string } | null> {
  const teamId = input.teamId.trim();
  const channelId = input.channelId.trim();
  if (!teamId || !channelId) return null;

  const oid = await getSessionAzureOid().catch(() => undefined);
  const token =
    (await getActiveM365AccessToken(oid)) ??
    (oid ? await getActiveM365AccessToken() : null);
  if (!token?.accessToken) {
    console.warn("[teams-attention-post] No M365 token — card not posted");
    return null;
  }

  try {
    const created = await graphRequest<{ id?: string }>(
      token.accessToken,
      `/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/messages`,
      {
        method: "POST",
        body: JSON.stringify({
          body: {
            contentType: "html",
            content: `<p>${escapeHtml(input.fallbackText)}</p>`,
          },
          attachments: [
            {
              id: "smartcrm-attention",
              contentType: "application/vnd.microsoft.card.adaptive",
              content: JSON.stringify(input.card),
            },
          ],
        }),
      },
    );
    if (!created?.id) return null;
    return { messageId: created.id };
  } catch (error) {
    console.warn(
      "[teams-attention-post] Channel post failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
