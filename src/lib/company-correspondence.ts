/**
 * Correspondence evidence helpers — client-safe (no Prisma / pg).
 * Loaders live in company-correspondence-data.ts (server only).
 */

import {
  isOpportunityEligibleCompany,
  normalizeCompanyTypes,
} from "@/lib/company-classification";
import type {
  CorrespondenceActionAsk,
  CorrespondenceOpenPromise,
  CorrespondenceProposalFollowUp,
} from "@/lib/correspondence-action-signals";
import type { Company } from "@/types/company";

export type CompanyCorrespondenceEvidence = {
  messageCount: number;
  lastSentAt: string | null;
  projectLinkedCount: number;
  projectNames: string[];
  /** Inbound mail that asks for an action — SmartAssist must note these. */
  actionAsks: CorrespondenceActionAsk[];
  /** Outbound proposal/quote/RFP with no reply — follow-up required. */
  proposalFollowUps: CorrespondenceProposalFollowUp[];
  /** Outbound promises we made that still need follow-through. */
  openPromises: CorrespondenceOpenPromise[];
  /** Subject + preview from recent threads — keyword detection only, never displayed. */
  mailKeywordHaystack: string;
  /** Lowercased contact emails that appear on matched mail — person-level recency. */
  correspondentEmails: string[];
  /** Lowercased contact email → latest sentAt for that person. */
  lastSentByEmail: Record<string, string>;
};

export const EMPTY_CORRESPONDENCE: CompanyCorrespondenceEvidence = {
  messageCount: 0,
  lastSentAt: null,
  projectLinkedCount: 0,
  projectNames: [],
  actionAsks: [],
  proposalFollowUps: [],
  openPromises: [],
  mailKeywordHaystack: "",
  correspondentEmails: [],
  lastSentByEmail: {},
};

export function hasCorrespondence(
  evidence: CompanyCorrespondenceEvidence | null | undefined,
): boolean {
  return Boolean(evidence && evidence.messageCount > 0);
}

export function correspondenceTouchesEmail(
  evidence: CompanyCorrespondenceEvidence | null | undefined,
  email: string | null | undefined,
): boolean {
  const normalized = email?.trim().toLowerCase();
  if (!normalized || !evidence) return false;
  return (evidence.correspondentEmails ?? []).includes(normalized);
}

/**
 * Project-tagged mail without a true Customer/Offtaker role → delivery partner,
 * not a sales pipeline invent. Prospect alone is often misclassified supplier.
 */
export function isProjectDeliveryPartner(
  company: Pick<Company, "CompanyTypes" | "companyType" | "Status">,
  evidence: CompanyCorrespondenceEvidence | null | undefined,
): boolean {
  if (!evidence || evidence.projectLinkedCount <= 0) return false;
  const types = normalizeCompanyTypes(company);
  const hasTrueCustomer = types.some(
    (type) => type === "Customer" || type === "Offtaker",
  );
  return !hasTrueCustomer;
}

/**
 * Prospect (or similar sell-to) with live mail but no Customer/Offtaker —
 * still allow Create Opportunity only when there is no project-delivery signal.
 */
export function isMisclassifiedCommercialTarget(
  company: Pick<Company, "CompanyTypes" | "companyType" | "Status">,
  evidence: CompanyCorrespondenceEvidence | null | undefined,
): boolean {
  if (!hasCorrespondence(evidence)) return false;
  const types = normalizeCompanyTypes(company);
  const hasTrueCustomer = types.some(
    (type) => type === "Customer" || type === "Offtaker",
  );
  if (hasTrueCustomer) return false;
  if (isProjectDeliveryPartner(company, evidence)) return true;
  return types.length === 1 && types[0] === "Prospect";
}

/** Create Opportunity only when sell-to AND not a project-delivery / misclassified supplier. */
export function shouldOfferCreateOpportunity(
  company: Pick<Company, "CompanyTypes" | "companyType" | "Status">,
  evidence?: CompanyCorrespondenceEvidence | null,
): boolean {
  if (!isOpportunityEligibleCompany(company)) return false;
  if (isMisclassifiedCommercialTarget(company, evidence)) return false;
  if (isProjectDeliveryPartner(company, evidence)) return false;
  return true;
}

export function mergeLiveMailIntoEvidence(
  base: CompanyCorrespondenceEvidence,
  options?: {
    liveCorrespondentEmail?: string | null;
    liveProjectName?: string | null;
  },
): CompanyCorrespondenceEvidence {
  const liveEmail = options?.liveCorrespondentEmail?.trim();
  if (!liveEmail) return base;

  const projectName = options?.liveProjectName?.trim() || null;
  const projectNames =
    projectName && !base.projectNames.includes(projectName)
      ? [...base.projectNames, projectName]
      : base.projectNames;

  const liveNormalized = liveEmail.toLowerCase();
  const currentEmails = base.correspondentEmails ?? [];
  const correspondentEmails = currentEmails.includes(liveNormalized)
    ? currentEmails
    : [...currentEmails, liveNormalized];
  const lastSentAt = base.lastSentAt ?? new Date().toISOString();
  const lastSentByEmail = {
    ...(base.lastSentByEmail ?? {}),
  };
  if (!lastSentByEmail[liveNormalized]) {
    lastSentByEmail[liveNormalized] = lastSentAt;
  }

  return {
    messageCount: Math.max(base.messageCount, 1),
    lastSentAt,
    projectLinkedCount: Math.max(
      base.projectLinkedCount,
      projectName ? 1 : 0,
    ),
    projectNames,
    actionAsks: base.actionAsks ?? [],
    proposalFollowUps: base.proposalFollowUps ?? [],
    openPromises: base.openPromises ?? [],
    mailKeywordHaystack: base.mailKeywordHaystack ?? "",
    correspondentEmails,
    lastSentByEmail,
  };
}

/** Map stored Outlook recency onto company people (ContactID keys). */
export function lastMailByContactIdFromCorrespondence(
  contacts: Array<{ ContactID: string; Email?: string | null }>,
  evidence: CompanyCorrespondenceEvidence | null | undefined,
): Record<string, string> {
  const next: Record<string, string> = {};
  const byEmail = evidence?.lastSentByEmail ?? {};
  for (const contact of contacts) {
    const email = contact.Email?.trim().toLowerCase();
    if (!email) continue;
    const sentAt = byEmail[email];
    if (sentAt) next[contact.ContactID] = sentAt;
  }
  return next;
}
