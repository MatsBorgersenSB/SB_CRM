/**
 * Client-safe deduplication result types — no Prisma / server-only imports.
 */

export type DedupContactSummary = {
  id: string;
  contactId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  jobTitle: string;
  companyId: string | null;
  companyName: string;
};

export type ContactDuplicateCheckResult =
  | { status: "CLEAN" }
  | { status: "EXACT_EMAIL_EXISTS"; existingContact: DedupContactSummary }
  | { status: "NAME_SIMILARITY_MATCH"; existingContacts: DedupContactSummary[] };

export type DedupCompanySummary = {
  id: string;
  companyId: string;
  name: string;
  organizationNumber: string | null;
};

export type CompanyDuplicateCheckResult =
  | { status: "CLEAN" }
  | { status: "DUPLICATE_EXISTS"; existingCompany: DedupCompanySummary };

export type DedupProjectSummary = {
  id: string;
  title: string;
  projectType?: string;
  companyId?: string | null;
};

export type ProjectDuplicateCheckResult =
  | { status: "CLEAN" }
  | { status: "DUPLICATE_TITLE"; existingProject: DedupProjectSummary };

export type DedupOpportunitySummary = {
  id: string;
  name: string;
  companyId: string;
  companyName: string;
};

export type OpportunityDuplicateCheckResult =
  | { status: "CLEAN" }
  | { status: "DUPLICATE_EXISTS"; existingOpportunity: DedupOpportunitySummary };

export function isContactSoftMatch(
  result: ContactDuplicateCheckResult,
): result is Extract<ContactDuplicateCheckResult, { status: "NAME_SIMILARITY_MATCH" }> {
  return result.status === "NAME_SIMILARITY_MATCH";
}

export function isContactHardMatch(
  result: ContactDuplicateCheckResult,
): result is Extract<ContactDuplicateCheckResult, { status: "EXACT_EMAIL_EXISTS" }> {
  return result.status === "EXACT_EMAIL_EXISTS";
}
