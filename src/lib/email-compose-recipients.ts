/**
 * Recipient suggestions for "Open tagged draft" — prefer external project people.
 */

import { isExternalEmail, isInternalEmail } from "@/lib/domain-rules";

export type ComposeRecipientOption = {
  email: string;
  label: string;
  source: "stakeholder" | "thread" | "company";
  isExternal: boolean;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function mergeComposeRecipientOptions(
  rows: ComposeRecipientOption[],
): ComposeRecipientOption[] {
  const byEmail = new Map<string, ComposeRecipientOption>();
  for (const row of rows) {
    const email = normalizeEmail(row.email);
    if (!email || !email.includes("@")) continue;
    const previous = byEmail.get(email);
    if (!previous) {
      byEmail.set(email, { ...row, email });
      continue;
    }
    // Prefer stakeholder over thread, and keep the clearer label.
    const sourceRank = { stakeholder: 3, company: 2, thread: 1 } as const;
    if (sourceRank[row.source] > sourceRank[previous.source]) {
      byEmail.set(email, { ...row, email });
    } else if (
      sourceRank[row.source] === sourceRank[previous.source] &&
      row.label.length > previous.label.length
    ) {
      byEmail.set(email, { ...row, email });
    }
  }

  return [...byEmail.values()].sort((a, b) => {
    if (a.isExternal !== b.isExternal) return a.isExternal ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

/** External (and optional internal) people already visible on loaded email threads. */
export function composeRecipientsFromThreads(
  messages: Array<{
    senderEmail: string;
    recipientEmails: string[];
    contactName?: string | null;
    senderIsInternal?: boolean;
    isOutbound?: boolean;
  }>,
  options?: { includeInternal?: boolean },
): ComposeRecipientOption[] {
  const includeInternal = options?.includeInternal === true;
  const rows: ComposeRecipientOption[] = [];

  for (const message of messages) {
    const candidates: Array<{ email: string; name?: string | null }> = [];
    if (message.isOutbound) {
      for (const email of message.recipientEmails) {
        candidates.push({ email });
      }
    } else {
      candidates.push({
        email: message.senderEmail,
        name: message.contactName,
      });
      for (const email of message.recipientEmails) {
        candidates.push({ email });
      }
    }

    for (const candidate of candidates) {
      const email = normalizeEmail(candidate.email);
      if (!email) continue;
      const external = isExternalEmail(email);
      if (!external && !includeInternal) continue;
      if (!external && isInternalEmail(email) && !includeInternal) continue;
      const local = email.split("@")[0] ?? email;
      const fallbackName = local.replace(/\./g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      rows.push({
        email,
        label: candidate.name?.trim() || fallbackName,
        source: "thread",
        isExternal: external,
      });
    }
  }

  return mergeComposeRecipientOptions(rows);
}
