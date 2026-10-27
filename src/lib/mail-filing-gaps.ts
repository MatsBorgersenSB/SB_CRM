import type { AttentionItem } from "@/types/attention-item";
import type { Company } from "@/types/company";
import { company360Href, companyMailHref } from "@/types/company-360";

const MAX_ITEMS = 3;

/** One mail whose attachments are not (fully) in the record. */
export type MailFilingGapSignal = {
  id: string;
  subject: string;
  sentAt: string;
  companyId: string;
  companyName: string;
  status: "partial" | "unfiled" | "failed";
  expected: number;
  filed: number;
};

function cleanSubject(subject: string): string {
  return subject.replace(/^((re|fw|fwd|sv|vs):\s*)+/i, "").trim() || subject;
}

/**
 * Correspondence control: mail whose files are missing from SmartCRM.
 * One item per company so a bad week never floods My Attention.
 */
export function buildMailFilingGapAttention(
  signals: MailFilingGapSignal[],
  companies: Company[],
  companyId?: string,
): AttentionItem[] {
  if (signals.length === 0) return [];
  const byId = new Map(companies.map((company) => [company.CompanyID, company]));
  const grouped = new Map<string, MailFilingGapSignal[]>();
  for (const signal of signals) {
    if (companyId && signal.companyId !== companyId) continue;
    if (!byId.has(signal.companyId)) continue;
    const list = grouped.get(signal.companyId) ?? [];
    list.push(signal);
    grouped.set(signal.companyId, list);
  }

  const items: AttentionItem[] = [];
  for (const [id, group] of grouped) {
    const company = byId.get(id);
    if (!company) continue;
    const latest = [...group].sort((a, b) => Date.parse(b.sentAt) - Date.parse(a.sentAt))[0]!;
    const missing = group.reduce((sum, row) => sum + Math.max(row.expected - row.filed, 0), 0);
    const mailCount = group.length;

    items.push({
      id: `attn-mail-filing-gap-${company.CompanyID}`,
      sourceObjectId: company.CompanyID,
      sourceObjectName: company.Title,
      objectType: "Company",
      severity: "needs_attention",
      status: "open",
      recommendation:
        mailCount === 1
          ? `${missing} attachment${missing === 1 ? "" : "s"} from “${cleanSubject(latest.subject)}” ${missing === 1 ? "is" : "are"} not in the record — a file the client sent could be missing when you need it.`
          : `${missing} attachments across ${mailCount} mails are not in the record — files the client sent could be missing when you need them.`,
      suggestedAiAction: "File the missing attachments",
      ownerLabel: company.AccountOwner?.Title || undefined,
      dueDate: latest.sentAt,
      href: company360Href(company.CompanyID),
      issueHref: companyMailHref(company.CompanyID, latest.id),
      companyId: company.CompanyID,
      companyName: company.Title,
      ruleId: "mail_filing_gap",
    });
    if (items.length >= MAX_ITEMS) break;
  }
  return items;
}
