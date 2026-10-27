import { fetchGraphMe, getActiveM365AccessToken, graphRequest } from "@/lib/m365-client";
import { toGraphRestMessageId } from "@/lib/m365/outlook-selection";

const MESSAGE_SELECT = [
  "id",
  "conversationId",
  "internetMessageId",
  "subject",
  "from",
  "toRecipients",
  "ccRecipients",
  "sentDateTime",
  "receivedDateTime",
  "bodyPreview",
  "webLink",
  "isDraft",
].join(",");

type GraphEmail = { emailAddress?: { address?: string; name?: string } };

type GraphMessage = {
  id?: string;
  conversationId?: string;
  internetMessageId?: string;
  subject?: string;
  bodyPreview?: string;
  webLink?: string;
  sentDateTime?: string;
  receivedDateTime?: string;
  isDraft?: boolean;
  from?: GraphEmail;
  toRecipients?: GraphEmail[];
  ccRecipients?: GraphEmail[];
};

export type OutlookGraphMessageSeed = {
  requestItemId: string;
  externalMessageId: string;
  alternateItemId?: string;
  conversationId: string;
  internetMessageId?: string;
  subject: string;
  senderEmail: string;
  senderDisplayName?: string;
  sentAt: string;
  isOutbound: boolean;
  recipientEmails: string[];
  bodyPreview?: string;
  webLink?: string;
};

export type OutlookGraphLookup = {
  itemId?: string;
  alternateItemId?: string;
  internetMessageId?: string;
};

function addresses(rows: GraphEmail[] | undefined): string[] {
  return (rows ?? [])
    .map((row) => row.emailAddress?.address?.trim().toLowerCase() || "")
    .filter((email) => email.includes("@"));
}

function odataString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function readGraphMessage(
  accessToken: string,
  itemId: string,
): Promise<GraphMessage | null> {
  const id = toGraphRestMessageId(itemId);
  if (!id) return null;
  try {
    return await graphRequest<GraphMessage>(
      accessToken,
      `/me/messages/${encodeURIComponent(id)}?$select=${MESSAGE_SELECT}`,
    );
  } catch {
    return null;
  }
}

async function readGraphMessageByInternetId(
  accessToken: string,
  internetMessageId: string,
): Promise<GraphMessage | null> {
  const raw = internetMessageId.trim();
  if (!raw) return null;
  const wrapped = raw.startsWith("<") ? raw : `<${raw}>`;
  try {
    const listed = await graphRequest<{ value?: GraphMessage[] }>(
      accessToken,
      `/me/messages?$top=1&$select=${MESSAGE_SELECT}&$filter=${encodeURIComponent(
        `internetMessageId eq ${odataString(wrapped)}`,
      )}`,
    );
    return listed.value?.[0] ?? null;
  } catch {
    return null;
  }
}

function toSeed(
  message: GraphMessage,
  selfEmail: string,
  requestItemId: string,
  alternateItemId?: string,
): OutlookGraphMessageSeed | null {
  const externalMessageId = message.id?.trim() || "";
  const conversationId = message.conversationId?.trim() || "";
  if (!externalMessageId || !conversationId) return null;
  const fromEmail = message.from?.emailAddress?.address?.trim().toLowerCase() || "";
  const fromName = message.from?.emailAddress?.name?.trim() || "";
  const isOutbound = Boolean(selfEmail) && fromEmail === selfEmail;
  const sentAt = message.sentDateTime || message.receivedDateTime || "";
  return {
    requestItemId,
    externalMessageId,
    alternateItemId,
    conversationId,
    internetMessageId: message.internetMessageId?.trim() || undefined,
    subject: message.subject?.trim() || "(no subject)",
    senderEmail: fromEmail,
    senderDisplayName: fromName || undefined,
    sentAt,
    isOutbound: isOutbound || message.isDraft === true,
    recipientEmails: [...addresses(message.toRecipients), ...addresses(message.ccRecipients)],
    bodyPreview: message.bodyPreview?.trim() || undefined,
    webLink: message.webLink?.trim() || undefined,
  };
}

/**
 * Fill sender and conversation id for checked Outlook mails when Office.js
 * only returned item ids. Uses the connected Microsoft 365 mailbox.
 */
export async function readOutlookMessagesFromGraph(
  items: OutlookGraphLookup[],
): Promise<OutlookGraphMessageSeed[]> {
  const token = await getActiveM365AccessToken();
  if (!token) return [];
  const me = await fetchGraphMe(token.accessToken).catch(() => null);
  const selfEmail = (me?.mail || me?.userPrincipalName || "").trim().toLowerCase();
  const seeds: OutlookGraphMessageSeed[] = [];

  for (const item of items.slice(0, 50)) {
    const requestItemId = item.itemId?.trim() || item.alternateItemId?.trim() || "";
    if (!requestItemId && !item.internetMessageId?.trim()) continue;
    const message =
      (item.internetMessageId
        ? await readGraphMessageByInternetId(token.accessToken, item.internetMessageId)
        : null) ||
      (await readGraphMessage(token.accessToken, item.itemId || "")) ||
      (item.alternateItemId && item.alternateItemId !== item.itemId
        ? await readGraphMessage(token.accessToken, item.alternateItemId)
        : null);
    if (!message) continue;
    const seed = toSeed(message, selfEmail, requestItemId, item.alternateItemId);
    if (seed) seeds.push(seed);
  }

  return seeds;
}
