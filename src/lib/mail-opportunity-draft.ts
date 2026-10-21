import { buildCustomOffering } from "@/lib/custom-offering";
import { STANDARD_BIO_OFFERINGS } from "@/lib/standard-bio-offerings";
import type { UserRole } from "@/types/auth";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";

export type MailOpportunityDraft = {
  emailId: string;
  conversationId: string;
  assetName: string;
  offeringIds: string[];
  /** Preview text already on the mail. Empty when the preview says nothing useful. */
  knownFromMail: string | null;
  contactId: string | null;
  contactName: string | null;
};

/** Drop reply and forward prefixes so the opportunity name is the topic. */
export function mailTopic(subject: string): string {
  let value = subject.trim();
  let previous = "";
  while (value && value !== previous) {
    previous = value;
    value = value.replace(/^(re|fw|fwd)\s*:\s*/i, "").trim();
  }
  return value;
}

export function knownLineFromMail(bodyPreview: string | null | undefined): string | null {
  const text = bodyPreview?.replace(/\s+/g, " ").trim() ?? "";
  if (text.length < 12) return null;
  return text.length > 280 ? `${text.slice(0, 277)}…` : text;
}

/**
 * Use a catalog offering when its name is in the subject.
 * Otherwise a short subject becomes a suggested product the user can remove.
 */
export function suggestOfferingIdsForTopic(topic: string): string[] {
  const hay = topic.trim().toLowerCase();
  if (!hay) return [];
  const catalogMatch = STANDARD_BIO_OFFERINGS.filter(
    (offering) =>
      offering.name.trim().length >= 4 && hay.includes(offering.name.trim().toLowerCase()),
  ).sort((a, b) => b.name.length - a.name.length)[0];
  if (catalogMatch) return [catalogMatch.id];

  const words = topic.trim().split(/\s+/).filter(Boolean);
  if (words.length > 4) return [];
  const custom = buildCustomOffering("product", topic.trim());
  return custom ? [custom.id] : [];
}

export function buildMailOpportunityDraft(input: {
  emailId: string;
  conversationId: string;
  subject: string;
  bodyPreview: string | null;
  contactId: string | null;
  contactName: string | null;
}): MailOpportunityDraft | null {
  const assetName = mailTopic(input.subject);
  if (assetName.length < 2) return null;
  return {
    emailId: input.emailId,
    conversationId: input.conversationId,
    assetName,
    offeringIds: suggestOfferingIdsForTopic(assetName),
    knownFromMail: knownLineFromMail(input.bodyPreview),
    contactId: input.contactId,
    contactName: input.contactName,
  };
}

export function matchingOpportunityForTopic<T extends { id: string; assetName: string }>(
  deals: T[],
  topic: string,
): T | null {
  const needle = topic.trim().toLowerCase();
  if (needle.length < 3) return null;
  return (
    deals.find((deal) => {
      const name = deal.assetName.trim().toLowerCase();
      if (name.length < 3) return false;
      return name === needle || name.includes(needle) || needle.includes(name);
    }) ?? null
  );
}

export function mailOpportunityImpact(input: {
  topic: string;
  contactName: string | null;
  existingDealName: string | null;
}): string {
  const who = input.contactName?.trim();
  const source = who ? `${who}'s mail` : "This mail";
  if (input.existingDealName) {
    return `${source} is about ${input.topic}, which matches ${input.existingDealName}. Adding it keeps one opportunity.`;
  }
  return `${source} is about ${input.topic}. An opportunity keeps that conversation on the company.`;
}

export async function linkMailConversationToOpportunity(
  conversationId: string,
  opportunityId: string,
  role: UserRole,
): Promise<void> {
  const response = await fetch(
    `/api/emails/conversations/${encodeURIComponent(conversationId)}/opportunity`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [AUTH_ROLE_HEADER]: role,
      },
      body: JSON.stringify({ opportunityId }),
    },
  );
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "Could not attach this mail to the opportunity");
  }
}
