/**
 * Correspondence evidence from EmailMessageRecord + live Outlook context.
 * Knowledge before questions — mail and project tags count as interaction.
 */

import { getPrisma } from "@/lib/prisma";
import {
  isOpportunityEligibleCompany,
  normalizeCompanyTypes,
} from "@/lib/company-classification";
import type { Company } from "@/types/company";

export type CompanyCorrespondenceEvidence = {
  messageCount: number;
  lastSentAt: string | null;
  projectLinkedCount: number;
  projectNames: string[];
};

export const EMPTY_CORRESPONDENCE: CompanyCorrespondenceEvidence = {
  messageCount: 0,
  lastSentAt: null,
  projectLinkedCount: 0,
  projectNames: [],
};

export function hasCorrespondence(
  evidence: CompanyCorrespondenceEvidence | null | undefined,
): boolean {
  return Boolean(evidence && evidence.messageCount > 0);
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
 * When mail exists and role is Prospect-only, prefer classify over inventing deals
 * if the thread is project-tagged OR the caller marked project context.
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
  // Prospect-only + correspondence: do not auto-push Create Opportunity;
  // classify / capture first (user may still create manually later).
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

  return {
    messageCount: Math.max(base.messageCount, 1),
    lastSentAt: base.lastSentAt ?? new Date().toISOString(),
    projectLinkedCount: Math.max(
      base.projectLinkedCount,
      projectName ? 1 : 0,
    ),
    projectNames,
  };
}

/**
 * Load EmailMessageRecord evidence for one company (contact id + email match).
 */
export async function loadCorrespondenceEvidenceForCompany(
  company: Company,
): Promise<CompanyCorrespondenceEvidence> {
  const map = await loadCorrespondenceEvidenceByCompanyId([company]);
  return map.get(company.CompanyID) ?? EMPTY_CORRESPONDENCE;
}

export async function loadCorrespondenceEvidenceByCompanyId(
  companies: Company[],
): Promise<Map<string, CompanyCorrespondenceEvidence>> {
  const result = new Map<string, CompanyCorrespondenceEvidence>();
  if (companies.length === 0) return result;

  const emails: string[] = [];
  const contactIds: string[] = [];
  const emailToCompany = new Map<string, string>();
  const contactToCompany = new Map<string, string>();

  for (const company of companies) {
    result.set(company.CompanyID, { ...EMPTY_CORRESPONDENCE });
    for (const contact of company.contacts) {
      const contactId = contact.ContactID?.trim();
      if (contactId) {
        contactIds.push(contactId);
        contactToCompany.set(contactId, company.CompanyID);
      }
      const email = contact.Email?.trim().toLowerCase();
      if (email) {
        emails.push(email);
        emailToCompany.set(email, company.CompanyID);
      }
    }
  }

  if (emails.length === 0 && contactIds.length === 0) return result;

  const prisma = getPrisma();
  const orClauses: Array<Record<string, unknown>> = [];
  if (contactIds.length > 0) {
    orClauses.push({ contactId: { in: [...new Set(contactIds)] } });
  }
  if (emails.length > 0) {
    const uniqueEmails = [...new Set(emails)];
    orClauses.push({ senderEmail: { in: uniqueEmails } });
    orClauses.push({ recipientEmails: { hasSome: uniqueEmails } });
  }

  const messages = await prisma.emailMessageRecord.findMany({
    where: {
      isDeletedInSource: false,
      OR: orClauses,
    },
    select: {
      contactId: true,
      senderEmail: true,
      recipientEmails: true,
      sentAt: true,
      projectId: true,
      projectName: true,
    },
    orderBy: { sentAt: "desc" },
    take: Math.min(3000, Math.max(200, companies.length * 40)),
  });

  for (const message of messages) {
    const companyIds = new Set<string>();
    if (message.contactId && contactToCompany.has(message.contactId)) {
      companyIds.add(contactToCompany.get(message.contactId)!);
    }
    const sender = message.senderEmail?.trim().toLowerCase();
    if (sender && emailToCompany.has(sender)) {
      companyIds.add(emailToCompany.get(sender)!);
    }
    for (const recipient of message.recipientEmails ?? []) {
      const normalized = recipient.trim().toLowerCase();
      if (normalized && emailToCompany.has(normalized)) {
        companyIds.add(emailToCompany.get(normalized)!);
      }
    }

    const sentAt = message.sentAt.toISOString();
    const projectLinked = Boolean(message.projectId?.trim());
    const projectName = message.projectName?.trim() || null;

    for (const companyId of companyIds) {
      const current = result.get(companyId) ?? { ...EMPTY_CORRESPONDENCE };
      const projectNames =
        projectName && !current.projectNames.includes(projectName)
          ? [...current.projectNames, projectName]
          : current.projectNames;
      result.set(companyId, {
        messageCount: current.messageCount + 1,
        lastSentAt: current.lastSentAt ?? sentAt,
        projectLinkedCount:
          current.projectLinkedCount + (projectLinked ? 1 : 0),
        projectNames,
      });
    }
  }

  return result;
}
