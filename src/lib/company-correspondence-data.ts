/**
 * Server-only correspondence loaders (Prisma / pg).
 * Do not import from Client Components.
 */

import "server-only";

import { getPrisma } from "@/lib/prisma";
import {
  EMPTY_CORRESPONDENCE,
  type CompanyCorrespondenceEvidence,
} from "@/lib/company-correspondence";
import {
  extractCorrespondenceActionSignals,
  type CorrespondenceMailSnippet,
} from "@/lib/correspondence-action-signals";
import type { Company } from "@/types/company";

/**
 * Load EmailMessageRecord evidence for one company (contact id + email match).
 */
export async function loadCorrespondenceEvidenceForCompany(
  company: Company,
  options?: { take?: number },
): Promise<CompanyCorrespondenceEvidence> {
  const map = await loadCorrespondenceEvidenceByCompanyId([company], options);
  return map.get(company.CompanyID) ?? EMPTY_CORRESPONDENCE;
}

export async function loadCorrespondenceEvidenceByCompanyId(
  companies: Company[],
  options?: { take?: number },
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
      id: true,
      conversationId: true,
      contactId: true,
      senderEmail: true,
      recipientEmails: true,
      sentAt: true,
      projectId: true,
      projectName: true,
      subject: true,
      bodyPreview: true,
      isOutbound: true,
      sentiment: true,
    },
    orderBy: { sentAt: "desc" },
    take:
      options?.take ?? Math.min(250, Math.max(50, companies.length * 5)),
  });

  const snippetsByCompany = new Map<string, CorrespondenceMailSnippet[]>();

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
    const snippet: CorrespondenceMailSnippet = {
      id: message.id,
      conversationId: message.conversationId,
      subject: message.subject,
      bodyPreview: message.bodyPreview,
      sentAt,
      isOutbound: message.isOutbound,
      sentiment: message.sentiment,
    };

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
        actionAsks: current.actionAsks,
        proposalFollowUps: current.proposalFollowUps,
        openPromises: current.openPromises,
        mailKeywordHaystack: current.mailKeywordHaystack,
      });

      const list = snippetsByCompany.get(companyId) ?? [];
      list.push(snippet);
      snippetsByCompany.set(companyId, list);
    }
  }

  for (const [companyId, snippets] of snippetsByCompany) {
    const current = result.get(companyId) ?? { ...EMPTY_CORRESPONDENCE };
    const signals = extractCorrespondenceActionSignals(snippets);
    result.set(companyId, {
      ...current,
      actionAsks: signals.actionAsks,
      proposalFollowUps: signals.proposalFollowUps,
      openPromises: signals.openPromises,
      mailKeywordHaystack: snippets
        .slice(0, 40)
        .map((snippet) => `${snippet.subject}\n${snippet.bodyPreview ?? ""}`)
        .join("\n")
        .slice(0, 8000),
    });
  }

  return result;
}
