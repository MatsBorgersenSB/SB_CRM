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
  if (typeof window === "undefined") {
    return null;
  }

  const office = await whenOfficeReady();
  if (!office) return null;

  try {
    const item = office.context.mailbox?.item as
      | {
          conversationId?: string;
          getConversationIdAsync?: (
            callback: (result: {
              status: Office.AsyncResultStatus;
              value?: string;
            }) => void,
          ) => void;
        }
      | undefined;
    if (!item) return null;

    const direct = item.conversationId?.trim();
    if (direct) return direct;

    if (typeof item.getConversationIdAsync === "function") {
      return await new Promise((resolve) => {
        item.getConversationIdAsync!((result) => {
          if (result.status !== Office.AsyncResultStatus.Succeeded) {
            resolve(null);
            return;
          }
          resolve(result.value?.trim() || null);
        });
      });
    }

    return null;
  } catch {
    return null;
  }
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
