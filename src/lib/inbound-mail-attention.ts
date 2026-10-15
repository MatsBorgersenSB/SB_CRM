import {
  EMPTY_CORRESPONDENCE,
  type CompanyCorrespondenceEvidence,
} from "@/lib/company-correspondence";
import { laterIso } from "@/lib/contact-360-verdict";
import type { AttentionItem } from "@/types/attention-item";
import type { Company } from "@/types/company";
import { company360Href } from "@/types/company-360";
import { getContactDisplayName } from "@/types/contact";

const RECENT_INBOUND_LIMIT = 5;
const TODAY_MS = 24 * 60 * 60 * 1000;

/** One inbound mail that deserves a place on My Attention. */
export type InboundMailAttentionSignal = {
  id: string;
  subject: string;
  senderEmail: string;
  sentAt: string;
  companyId: string;
  companyName: string;
  contactId?: string | null;
};

function isToday(iso: string): boolean {
  const sent = new Date(iso);
  if (Number.isNaN(sent.getTime())) return false;
  return Date.now() - sent.getTime() <= TODAY_MS;
}

function senderLabel(signal: InboundMailAttentionSignal, company: Company): string {
  const email = signal.senderEmail.trim().toLowerCase();
  const contact =
    (signal.contactId
      ? company.contacts.find((person) => person.ContactID === signal.contactId)
      : null) ??
    company.contacts.find((person) => person.Email?.trim().toLowerCase() === email);
  if (contact) {
    const name = getContactDisplayName(contact).trim();
    if (name) return name;
  }
  return signal.senderEmail;
}

/**
 * New inbound mail that is already linked to a company.
 * Today → urgent so it sits above stale 999-day nags.
 */
export function buildInboundMailAttention(
  signals: InboundMailAttentionSignal[],
  companies: Company[],
  companyId?: string,
): AttentionItem[] {
  if (signals.length === 0) return [];

  const byId = new Map(companies.map((company) => [company.CompanyID, company]));
  const items: AttentionItem[] = [];

  for (const signal of signals) {
    if (companyId && signal.companyId !== companyId) continue;
    const company = byId.get(signal.companyId);
    if (!company) continue;

    const who = senderLabel(signal, company);
    const subject = signal.subject.replace(/^((re|fw|fwd|sv|vs):\s*)+/i, "").trim();
    const today = isToday(signal.sentAt);

    items.push({
      id: `attn-inbound-mail-${signal.id}`,
      sourceObjectId: company.CompanyID,
      sourceObjectName: company.Title,
      objectType: "Company",
      severity: today ? "urgent" : "needs_attention",
      status: "open",
      recommendation: `New mail from ${who} — ${subject || signal.subject}`,
      suggestedAiAction: "Read and decide next step",
      ownerLabel: company.AccountOwner?.Title || undefined,
      dueDate: signal.sentAt,
      href: company360Href(company.CompanyID),
      companyId: company.CompanyID,
      companyName: company.Title,
      ruleId: "recent_inbound_mail",
      contactEmail: signal.senderEmail,
    });

    if (items.length >= RECENT_INBOUND_LIMIT) break;
  }

  return items;
}

/** Outlook mail is a touch — fold it into correspondence so silence nags stay honest. */
export function mergeInboundMailIntoCorrespondence(
  correspondence: Map<string, CompanyCorrespondenceEvidence> | undefined,
  inbound: InboundMailAttentionSignal[],
): Map<string, CompanyCorrespondenceEvidence> {
  const map = new Map(correspondence ?? []);
  for (const mail of inbound) {
    const current = map.get(mail.companyId) ?? { ...EMPTY_CORRESPONDENCE };
    const email = mail.senderEmail.trim().toLowerCase();
    const lastSentByEmail = { ...current.lastSentByEmail };
    if (
      email &&
      (!lastSentByEmail[email] || Date.parse(mail.sentAt) > Date.parse(lastSentByEmail[email]))
    ) {
      lastSentByEmail[email] = mail.sentAt;
    }
    map.set(mail.companyId, {
      ...current,
      messageCount: Math.max(current.messageCount, 1),
      lastSentAt: laterIso(current.lastSentAt, mail.sentAt) ?? mail.sentAt,
      correspondentEmails:
        email && !current.correspondentEmails.includes(email)
          ? [...current.correspondentEmails, email]
          : current.correspondentEmails,
      lastSentByEmail,
    });
  }
  return map;
}
