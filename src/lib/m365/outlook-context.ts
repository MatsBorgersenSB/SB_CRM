/**
 * Outlook sender resolution — email, display name, and dev query-param fallbacks.
 */

import { whenOfficeReady } from "@/lib/outlook-office";
import { resolvePublicAppOrigin } from "@/lib/smartcrm-origin";

export type OutlookSenderDetails = {
  email: string;
  displayName: string;
};

export async function resolveOutlookSenderDetails(): Promise<OutlookSenderDetails | null> {
  if (typeof window === "undefined") {
    return null;
  }

  const office = await whenOfficeReady();
  if (!office) return null;

  try {
    const item = office.context.mailbox?.item;
    if (!item) return null;

    const selfEmail = office.context.mailbox?.userProfile?.emailAddress
      ?.trim()
      .toLowerCase();

    const fromEmail = item.from?.emailAddress?.trim().toLowerCase();
    if (fromEmail && fromEmail !== selfEmail) {
      return {
        email: fromEmail,
        displayName: item.from?.displayName?.trim() ?? "",
      };
    }

    const attendeeSource = item.requiredAttendees ?? item.optionalAttendees ?? item.to;
    if (!attendeeSource) return null;

    return await new Promise((resolve) => {
      attendeeSource.getAsync((result) => {
        if (result.status !== Office.AsyncResultStatus.Succeeded) {
          resolve(null);
          return;
        }

        const match = result.value?.find((entry) => {
          const email = entry.emailAddress?.trim().toLowerCase();
          return email && email !== selfEmail;
        });

        if (!match?.emailAddress) {
          resolve(null);
          return;
        }

        resolve({
          email: match.emailAddress.trim().toLowerCase(),
          displayName: match.displayName?.trim() ?? "",
        });
      });
    });
  } catch {
    return null;
  }
}

export async function resolveOutlookCounterpartyEmail(): Promise<string | null> {
  const sender = await resolveOutlookSenderDetails();
  return sender?.email ?? null;
}

/**
 * Graph conversationId for the open Outlook item (read or compose), when available.
 */
export async function resolveOutlookConversationId(): Promise<string | null> {
  const seed = await resolveOutlookOpenMessageSeed();
  return seed?.conversationId ?? null;
}

export type OutlookOpenMessageSeed = {
  conversationId: string;
  /** Prefer Graph REST item id when convertToRestId is available. */
  externalMessageId: string;
  subject: string;
  senderEmail: string;
  sentAt: string;
  /** True when the open item is an outbound draft / send we are composing. */
  isOutbound?: boolean;
  recipientEmails?: string[];
};

export type OutlookComposeRecipient = {
  email: string;
  displayName: string;
};

function getRecipientsAsync(
  source: { getAsync: (callback: (result: Office.AsyncResult<Office.EmailAddressDetails[]>) => void) => void } | undefined,
): Promise<OutlookComposeRecipient[]> {
  if (!source?.getAsync) return Promise.resolve([]);
  return new Promise((resolve) => {
    source.getAsync((result) => {
      if (result.status !== Office.AsyncResultStatus.Succeeded || !result.value) {
        resolve([]);
        return;
      }
      resolve(
        result.value
          .map((entry) => ({
            email: entry.emailAddress?.trim().toLowerCase() ?? "",
            displayName: entry.displayName?.trim() ?? "",
          }))
          .filter((entry) => Boolean(entry.email)),
      );
    });
  });
}

/**
 * Resolve To (+ Cc) recipients on a compose item.
 * Excludes the mailbox owner. Reality First — only addresses Outlook provides.
 */
export async function resolveOutlookComposeRecipients(): Promise<OutlookComposeRecipient[]> {
  if (typeof window === "undefined") return [];

  const office = await whenOfficeReady();
  if (!office) return [];

  try {
    const mailbox = office.context.mailbox;
    const item = mailbox?.item;
    if (!item) return [];

    const selfEmail = mailbox?.userProfile?.emailAddress?.trim().toLowerCase() ?? "";
    const [to, cc] = await Promise.all([
      getRecipientsAsync(item.to),
      getRecipientsAsync(item.cc),
    ]);

    const seen = new Set<string>();
    const recipients: OutlookComposeRecipient[] = [];
    for (const entry of [...to, ...cc]) {
      if (!entry.email || entry.email === selfEmail || seen.has(entry.email)) continue;
      seen.add(entry.email);
      recipients.push(entry);
    }
    return recipients;
  } catch {
    return [];
  }
}

async function saveComposeItemAsync(): Promise<boolean> {
  const office = await whenOfficeReady();
  const item = office?.context.mailbox?.item;
  if (!item?.saveAsync) return false;

  return await new Promise((resolve) => {
    item.saveAsync!((result) => {
      resolve(result.status === Office.AsyncResultStatus.Succeeded);
    });
  });
}

/**
 * Ensure compose draft has itemId + conversationId (saveAsync when needed).
 * Returns null if Outlook cannot provide identity yet.
 */
export async function ensureOutlookComposeSeed(input?: {
  primaryRecipientEmail?: string;
}): Promise<OutlookOpenMessageSeed | null> {
  let seed = await resolveOutlookOpenMessageSeed({
    preferOutbound: true,
    primaryRecipientEmail: input?.primaryRecipientEmail,
  });
  if (seed) return seed;

  const saved = await saveComposeItemAsync();
  if (!saved) return null;

  // Brief pause so hosts populate itemId / conversationId after save.
  await new Promise((resolve) => window.setTimeout(resolve, 250));
  seed = await resolveOutlookOpenMessageSeed({
    preferOutbound: true,
    primaryRecipientEmail: input?.primaryRecipientEmail,
  });
  return seed;
}

/**
 * Snapshot of the open Outlook item for intentional tagging when mail sync
 * has not yet ingested the conversation.
 */
export async function resolveOutlookOpenMessageSeed(options?: {
  preferOutbound?: boolean;
  primaryRecipientEmail?: string;
}): Promise<OutlookOpenMessageSeed | null> {
  if (typeof window === "undefined") {
    return null;
  }

  const office = await whenOfficeReady();
  if (!office) return null;

  try {
    const mailbox = office.context.mailbox;
    const item = mailbox?.item;
    if (!item) return null;

    let conversationId = item.conversationId?.trim() || "";
    if (!conversationId && typeof item.getConversationIdAsync === "function") {
      conversationId = await new Promise<string>((resolve) => {
        item.getConversationIdAsync!((result) => {
          if (result.status !== Office.AsyncResultStatus.Succeeded) {
            resolve("");
            return;
          }
          resolve(result.value?.trim() || "");
        });
      });
    }
    if (!conversationId) return null;

    const ewsOrRestId = item.itemId?.trim() || "";
    if (!ewsOrRestId) return null;

    let externalMessageId = ewsOrRestId;
    try {
      const convert = (
        mailbox as {
          convertToRestId?: (id: string, version: string) => string;
        }
      ).convertToRestId;
      if (typeof convert === "function") {
        const restId = convert.call(mailbox, ewsOrRestId, "v2.0")?.trim();
        if (restId) externalMessageId = restId;
      }
    } catch {
      // Keep EWS id — Graph category sync may fail; SmartCRM link still works.
    }

    const created = item.dateTimeCreated
      ? new Date(item.dateTimeCreated)
      : new Date();
    const selfEmail =
      mailbox?.userProfile?.emailAddress?.trim().toLowerCase() || "";
    const fromEmail = item.from?.emailAddress?.trim().toLowerCase() || "";
    const isOutbound =
      Boolean(options?.preferOutbound) ||
      !fromEmail ||
      fromEmail === selfEmail;

    const recipients = await resolveOutlookComposeRecipients().catch(() => []);
    const recipientEmails = recipients.map((entry) => entry.email);
    if (
      options?.primaryRecipientEmail &&
      !recipientEmails.includes(options.primaryRecipientEmail.trim().toLowerCase())
    ) {
      recipientEmails.unshift(options.primaryRecipientEmail.trim().toLowerCase());
    }

    return {
      conversationId,
      externalMessageId,
      subject: item.subject?.trim() || "(no subject)",
      senderEmail: isOutbound ? selfEmail || fromEmail : fromEmail || selfEmail,
      sentAt: Number.isNaN(created.getTime())
        ? new Date().toISOString()
        : created.toISOString(),
      isOutbound,
      recipientEmails,
    };
  } catch {
    return null;
  }
}

/**
 * Apply SmartCRM categories on the open Outlook item (client-side fallback).
 */
export async function applyOutlookItemSmartCrmCategories(input: {
  opportunityName?: string;
  projectName?: string;
}): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const office = await whenOfficeReady();
  if (!office) return false;

  const item = office.context.mailbox?.item as
    | {
        categories?: {
          addAsync: (
            categories: string[],
            callback: (result: { status: Office.AsyncResultStatus }) => void,
          ) => void;
        };
      }
    | undefined;
  if (!item?.categories?.addAsync) return false;

  const master = "SmartCRM";
  const opportunityName = input.opportunityName?.trim();
  const projectName = input.projectName?.trim();
  const deal = opportunityName
    ? `${master} / ${opportunityName.replace(/[^\w\s\-./]/g, "").trim().slice(0, 80) || "Opportunity"}`
    : projectName
      ? `${master} / Project · ${projectName.replace(/[^\w\s\-./]/g, "").trim().slice(0, 70) || "Project"}`
      : null;

  const toAdd = [master, ...(deal ? [deal] : [])];

  return await new Promise((resolve) => {
    item.categories!.addAsync(toAdd, (result) => {
      resolve(result.status === Office.AsyncResultStatus.Succeeded);
    });
  });
}

export function resolveDevEmail(searchParams: URLSearchParams): string | null {
  const email = searchParams.get("email")?.trim().toLowerCase();
  return email || null;
}

export function resolveDevDisplayName(searchParams: URLSearchParams): string | null {
  const name = searchParams.get("name")?.trim();
  return name || null;
}

export function buildSmartCrmUrl(path: string): string {
  const base = resolvePublicAppOrigin();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
