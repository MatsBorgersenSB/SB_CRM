/**
 * Pure counterparty picking for Outlook add-contact.
 * Never treat the mailbox owner (or Standard Bio) as the person to add.
 */

import { extractEmailDomain, isInternalEmail } from "@/lib/domain-rules";

export type OutlookParty = {
  email: string;
  displayName?: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function localPart(email: string): string {
  const normalized = normalizeEmail(email);
  const at = normalized.indexOf("@");
  return at > 0 ? normalized.slice(0, at) : "";
}

/** Same mailbox even when UPN and SMTP differ (walter.aker@standard.bio vs onmicrosoft). */
export function isSameMailboxIdentity(left: string, right: string): boolean {
  const a = normalizeEmail(left);
  const b = normalizeEmail(right);
  if (!a || !b) return false;
  if (a === b) return true;

  const localA = localPart(a);
  const localB = localPart(b);
  if (!localA || localA !== localB) return false;

  return isInternalEmail(a) && isInternalEmail(b);
}

export function isMailboxOwnerEmail(
  email: string,
  selfEmails: readonly string[],
): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return selfEmails.some((self) => isSameMailboxIdentity(normalized, self));
}

/**
 * Address we can add as a CRM contact from this mail.
 * Skips empty, automated, mailbox owner, and Standard Bio colleagues.
 */
export function isUsableCounterpartyEmail(
  email: string,
  selfEmails: readonly string[] = [],
): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  if (isMailboxOwnerEmail(normalized, selfEmails)) return false;
  if (isInternalEmail(normalized)) return false;

  const domain = extractEmailDomain(normalized);
  if (
    domain === "adobesign.com" ||
    domain === "echosign.com" ||
    domain === "docusign.com" ||
    domain === "docusign.net" ||
    domain.endsWith(".adobesign.com") ||
    domain.endsWith(".docusign.net")
  ) {
    return false;
  }

  const local = localPart(normalized);
  return !/^(noreply|no-reply|donotreply|do-not-reply|mailer-daemon|notifications?)$/i.test(
    local,
  );
}

/**
 * Prefer the external From/sender. If Outlook reports the mailbox owner as From
 * (Sent Items, New Outlook, Mac), use the first external To/Cc instead.
 */
export function pickOutlookCounterparty(input: {
  from?: OutlookParty | null;
  sender?: OutlookParty | null;
  recipients?: OutlookParty[];
  selfEmails: readonly string[];
}): OutlookParty | null {
  const selfEmails = input.selfEmails.map(normalizeEmail).filter(Boolean);

  const envelope = [input.from, input.sender];
  for (const party of envelope) {
    const email = party?.email ? normalizeEmail(party.email) : "";
    if (email && isUsableCounterpartyEmail(email, selfEmails)) {
      return {
        email,
        displayName: party?.displayName?.trim() ?? "",
      };
    }
  }

  for (const party of input.recipients ?? []) {
    const email = normalizeEmail(party.email);
    if (!isUsableCounterpartyEmail(email, selfEmails)) continue;
    return {
      email,
      displayName: party.displayName?.trim() ?? "",
    };
  }

  return null;
}
