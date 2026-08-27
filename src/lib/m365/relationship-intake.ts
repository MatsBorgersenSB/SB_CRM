/**
 * FS-012 Relationship Intake engine.
 * Resolve → Enrich → Propose → (user Yes) → Persist.
 */

import { addOutlookContact, buildOutlookSenderPrepopulation } from "@/lib/m365/outlook-add-contact";
import { assertExternalContactEmail } from "@/lib/internal-colleague";
import { setConversationLinksForContact } from "@/lib/email-intelligence-data";
import { getPrisma } from "@/lib/prisma";
import { readProjects } from "@/lib/project-db";
import { findPrismaCompanyByRouteKey } from "@/lib/resolve-company-route";
import { prismaDemoSeedOpportunityWhere } from "@/lib/demo-seed-markers";
import type {
  RelationshipIntakeApproveInput,
  RelationshipIntakeApproveResult,
  RelationshipIntakeConfidence,
  RelationshipIntakeLinkOption,
  RelationshipIntakeProposal,
} from "@/types/relationship-intake";

const PERSONAL_DOMAINS = new Set([
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "icloud.com",
  "live.com",
]);

function domainIsPersonal(domain: string): boolean {
  const normalized = domain.trim().toLowerCase();
  return Boolean(normalized) && PERSONAL_DOMAINS.has(normalized);
}

async function loadLinkOptions(companyId: string | null): Promise<{
  opportunityOptions: RelationshipIntakeLinkOption[];
  projectOptions: RelationshipIntakeLinkOption[];
}> {
  const prisma = getPrisma();
  const opportunityOptions: RelationshipIntakeLinkOption[] = [];

  let prismaCompanyId: string | null = null;
  if (companyId) {
    const prismaCompany = await findPrismaCompanyByRouteKey(companyId).catch(() => null);
    prismaCompanyId = prismaCompany?.id ?? null;
    // UUID already stored as CompanyID in some environments
    if (!prismaCompanyId && /^[0-9a-f-]{36}$/i.test(companyId)) {
      prismaCompanyId = companyId;
    }
  }

  if (prismaCompanyId) {
    const companyScoped = await prisma.opportunity.findMany({
      where: {
        status: "open",
        companyId: prismaCompanyId,
        NOT: prismaDemoSeedOpportunityWhere,
      },
      select: { id: true, name: true, code: true },
      orderBy: { updatedAt: "desc" },
      take: 40,
    });
    for (const row of companyScoped) {
      opportunityOptions.push({
        id: row.id,
        name: row.name,
        label: row.code ? `${row.code} · ${row.name}` : row.name,
        kind: "opportunity",
      });
    }
  }

  const projects = await readProjects().catch(() => []);
  const projectOptions: RelationshipIntakeLinkOption[] = companyId
    ? projects
        .filter(
          (project) =>
            !project.linkedCompanyId || project.linkedCompanyId === companyId,
        )
        .slice(0, 40)
        .map((project) => ({
          id: project.id,
          name: project.name,
          label: project.linkedCompanyId
            ? `${project.name} · ${project.linkedCompanyId}`
            : project.name,
          kind: "project" as const,
        }))
    : [];

  return { opportunityOptions, projectOptions };
}

function buildDecisionCopy(input: {
  companyResolved: boolean;
  companyName: string;
  confidence: RelationshipIntakeConfidence;
}): { decisionQuestion: string; decisionImpact: string } {
  if (input.companyResolved && input.companyName) {
    return {
      decisionQuestion: `Add this contact to ${input.companyName}?`,
      decisionImpact:
        "Keeps the person on the existing company record so relationship intelligence stays accurate.",
    };
  }

  if (input.confidence === "low" || input.confidence === "none") {
    return {
      decisionQuestion: "Create this contact and company in SmartCRM?",
      decisionImpact:
        "Without a record, SmartAssist cannot track the relationship or connect this mail to work.",
    };
  }

  return {
    decisionQuestion: input.companyName
      ? `Create ${input.companyName} and this contact in SmartCRM?`
      : "Create this contact and company in SmartCRM?",
    decisionImpact:
      "You stay in Outlook — SmartAssist only writes after you confirm role and relationship type.",
  };
}

/**
 * Build a draft proposal for an unknown Outlook sender.
 * Does not write to CRM.
 */
export async function buildRelationshipIntakeProposal(input: {
  email: string;
  displayName?: string;
  messageBody?: string;
}): Promise<RelationshipIntakeProposal> {
  const prepopulation = await buildOutlookSenderPrepopulation(input);

  if (prepopulation.colleague) {
    const colleague = prepopulation.colleague;
    return {
      email: prepopulation.email,
      displayName: colleague.knownUser
        ? colleague.displayName
        : prepopulation.displayName,
      firstName: prepopulation.firstName,
      lastName: prepopulation.lastName,
      domain: prepopulation.domain,
      resolutionKind: "internal_colleague",
      confidence: "high",
      companyResolved: false,
      companyId: null,
      companyName: "",
      companyHint: "",
      decisionQuestion: colleague.knownUser
        ? `${colleague.displayName} is a Standard Bio colleague — a SmartCRM user, not a contact.`
        : "This Standard Bio address is a colleague, not a customer contact.",
      decisionImpact: colleague.knownUser
        ? "They already have a user record. Do not add them to the Contact Registry."
        : "If they need SmartCRM access, add them in Users & Access. Never as a contact.",
      requiresCompanyType: false,
      requiresIndustry: false,
      enrichment: { suggestions: [] },
      opportunityOptions: [],
      projectOptions: [],
      companyOptions: [],
      colleague,
    };
  }

  const personal = domainIsPersonal(prepopulation.domain);

  let confidence: RelationshipIntakeConfidence = "none";
  if (prepopulation.companyResolved) {
    confidence = "medium";
  } else if (prepopulation.companyName && !personal) {
    confidence = "low";
  } else if (prepopulation.companyName) {
    confidence = "low";
  } else {
    confidence = "none";
  }

  const resolutionKind = prepopulation.companyResolved
    ? "company_match"
    : "new_company";

  const { opportunityOptions, projectOptions } = await loadLinkOptions(
    prepopulation.companyId,
  );

  const { decisionQuestion, decisionImpact } = buildDecisionCopy({
    companyResolved: prepopulation.companyResolved,
    companyName: prepopulation.companyName,
    confidence,
  });

  return {
    email: prepopulation.email,
    displayName: prepopulation.displayName,
    firstName: prepopulation.firstName,
    lastName: prepopulation.lastName,
    domain: prepopulation.domain,
    resolutionKind,
    confidence,
    companyResolved: prepopulation.companyResolved,
    companyId: prepopulation.companyId,
    companyName: prepopulation.companyName,
    companyHint: prepopulation.companyHint,
    decisionQuestion,
    decisionImpact,
    requiresCompanyType: !prepopulation.companyResolved,
    requiresIndustry: !prepopulation.companyResolved,
    enrichment: prepopulation.enrichment,
    opportunityOptions,
    projectOptions,
    companyOptions: prepopulation.companyOptions,
    colleague: null,
  };
}

/**
 * Persist only after user Yes + confirm. Optionally tag the open thread.
 */
export async function approveRelationshipIntake(
  input: RelationshipIntakeApproveInput,
): Promise<RelationshipIntakeApproveResult> {
  assertExternalContactEmail(input.email);
  const created = await addOutlookContact({
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    companyName: input.companyName,
    role: input.role,
    industry: input.industry,
    companyTypes: input.companyTypes,
    matchedCompanyId: input.matchedCompanyId,
    skipAutoCompanyMatch: input.skipAutoCompanyMatch,
    enrichment: input.enrichment,
  });

  let threadLinked = false;
  let linkedOpportunityId: string | null | undefined;
  let linkedProjectId: string | null | undefined;

  const conversationId = input.conversationId?.trim();
  const wantsOpportunity =
    typeof input.opportunityId === "string" && input.opportunityId.trim();
  const wantsProject =
    typeof input.projectId === "string" && input.projectId.trim();

  if (conversationId && (wantsOpportunity || wantsProject)) {
    const seedExternalId = input.message?.externalMessageId?.trim();
    try {
      const linkResult = await setConversationLinksForContact(
        created.contactId,
        conversationId,
        {
          opportunityId: wantsOpportunity ? input.opportunityId!.trim() : undefined,
          projectId: wantsProject ? input.projectId!.trim() : undefined,
        },
        seedExternalId
          ? {
              seedMessage: {
                externalMessageId: seedExternalId,
                subject: input.message?.subject,
                senderEmail: input.message?.senderEmail,
                recipientEmails: input.message?.recipientEmails,
                sentAt: input.message?.sentAt,
                bodyPreview: input.message?.bodyPreview,
                webLink: input.message?.webLink,
                isOutbound: input.message?.isOutbound === true,
              },
            }
          : undefined,
      );
      threadLinked = linkResult.updated > 0;
      linkedOpportunityId = linkResult.opportunityId;
      linkedProjectId = linkResult.projectId;
    } catch {
      threadLinked = false;
    }
  }

  return {
    ...created,
    threadLinked,
    linkedOpportunityId,
    linkedProjectId,
  };
}
