/**
 * Server-only correspondence loaders (Prisma / pg).
 * Do not import from Client Components.
 */

import "server-only";

import type { Prisma } from "@/generated/prisma";
import { getPrisma } from "@/lib/prisma";
import { toContactTrackingId } from "@/lib/prisma-mappers";
import {
  EMPTY_CORRESPONDENCE,
  type CompanyCorrespondenceEvidence,
} from "@/lib/company-correspondence";
import {
  extractCorrespondenceActionSignals,
  type CorrespondenceMailSnippet,
} from "@/lib/correspondence-action-signals";
import type { Company } from "@/types/company";

function addressesFromEmailsJson(emails: unknown): string[] {
  if (!Array.isArray(emails)) return [];
  return [
    ...new Set(
      emails
        .map((entry) => {
          if (!entry || typeof entry !== "object") return "";
          const address = (entry as { address?: unknown }).address;
          return typeof address === "string" ? address.trim().toLowerCase() : "";
        })
        .filter(Boolean),
    ),
  ];
}

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

  const prisma = getPrisma();
  const lookupKeys = [
    ...new Set(
      companies.flatMap((company) =>
        [company.CompanyID, company.code].filter(
          (value): value is string => Boolean(value?.trim()),
        ),
      ),
    ),
  ];

  if (lookupKeys.length > 0) {
    const prismaCompanies = await prisma.company.findMany({
      where: {
        OR: lookupKeys.flatMap((key) => [
          { id: key },
          { code: key },
          { code: key.toUpperCase() },
        ]),
      },
      select: {
        id: true,
        code: true,
        contacts: {
          where: { status: "active" },
          select: { id: true, emails: true },
        },
      },
    });

    for (const row of prismaCompanies) {
      const appCompany = companies.find(
        (company) =>
          company.CompanyID === row.code ||
          company.code === row.code ||
          company.CompanyID === row.id ||
          company.code === row.id,
      );
      if (!appCompany) continue;

      for (const contact of row.contacts) {
        contactIds.push(contact.id);
        contactToCompany.set(contact.id, appCompany.CompanyID);
        contactToCompany.set(
          toContactTrackingId(contact.id),
          appCompany.CompanyID,
        );
        for (const address of addressesFromEmailsJson(contact.emails)) {
          emails.push(address);
          emailToCompany.set(address, appCompany.CompanyID);
        }
      }
    }
  }

  const uniqueContactIds = [...new Set(contactIds)];
  const uniqueEmails = [...new Set(emails)];
  const orClauses: Prisma.EmailMessageRecordWhereInput[] = [];
  if (uniqueContactIds.length > 0) {
    orClauses.push({ contactId: { in: uniqueContactIds } });
  }
  if (uniqueEmails.length > 0) {
    orClauses.push({ senderEmail: { in: uniqueEmails } });
    orClauses.push({ recipientEmails: { hasSome: uniqueEmails } });
  }

  const projectToCompanies = new Map<string, string[]>();
  try {
    const { readProjects } = await import("@/lib/project-db");
    const { getProjectsForCompany } = await import("@/lib/project-team-utils");
    const projects = await readProjects();
    for (const company of companies) {
      const keys = [company.CompanyID, company.code].filter(
        (value): value is string => Boolean(value?.trim()),
      );
      const linked = keys.flatMap((key) => getProjectsForCompany(key, projects));
      for (const project of linked) {
        const list = projectToCompanies.get(project.id) ?? [];
        if (!list.includes(company.CompanyID)) list.push(company.CompanyID);
        projectToCompanies.set(project.id, list);
      }
    }
    const projectIds = [...projectToCompanies.keys()];
    if (projectIds.length > 0) {
      orClauses.push({ projectId: { in: projectIds } });
    }
  } catch (error) {
    console.warn("[correspondence] project mail match skipped", error);
  }

  if (orClauses.length === 0) return result;

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
    if (message.contactId) {
      const byUuid = contactToCompany.get(message.contactId);
      if (byUuid) companyIds.add(byUuid);
      const byTracking = contactToCompany.get(
        toContactTrackingId(message.contactId),
      );
      if (byTracking) companyIds.add(byTracking);
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
    if (message.projectId) {
      for (const companyId of projectToCompanies.get(message.projectId) ?? []) {
        companyIds.add(companyId);
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
    const matchedAddresses = [sender, ...(message.recipientEmails ?? [])]
      .map((value) => value?.trim().toLowerCase() ?? "")
      .filter((value) => value && emailToCompany.has(value));

    for (const companyId of companyIds) {
      const current = result.get(companyId) ?? { ...EMPTY_CORRESPONDENCE };
      const projectNames =
        projectName && !current.projectNames.includes(projectName)
          ? [...current.projectNames, projectName]
          : current.projectNames;
      const correspondentEmails = [...(current.correspondentEmails ?? [])];
      const lastSentByEmail = { ...(current.lastSentByEmail ?? {}) };
      for (const address of matchedAddresses) {
        if (!correspondentEmails.includes(address)) {
          correspondentEmails.push(address);
        }
        if (!lastSentByEmail[address]) {
          lastSentByEmail[address] = sentAt;
        }
      }
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
        correspondentEmails,
        lastSentByEmail,
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
