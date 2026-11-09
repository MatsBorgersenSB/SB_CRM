import { mailtoHref } from "@/lib/compose-actions";

/**
 * Blank (or prefilled) new message in the desktop mail client.
 * See outlookComposeHref — the https deeplink only focuses the Outlook inbox.
 */
export function outlookComposeUrl(options?: {
  to?: string;
  subject?: string;
}): string {
  return mailtoHref(options?.to ?? "", options?.subject);
}
