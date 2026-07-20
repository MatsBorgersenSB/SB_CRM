import type { Company } from "@/types/company";
import type { Project } from "@/types/project";
import type { ProjectRelationshipValidation } from "@/types/project-relationships";

/** Phase 2.2B — SmartAssist relationship mismatch detection. */

const TOKEN_STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "project",
  "phase",
  "site",
  "ab",
  "as",
  "at",
  "by",
  "of",
  "to",
  "inc",
  "ltd",
  "llc",
  "gmbh",
]);

function normalizeTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !TOKEN_STOP_WORDS.has(token));
}

function tokensOverlap(left: string[], right: string[]): boolean {
  const rightSet = new Set(right);
  return left.some((token) => rightSet.has(token));
}

function objectiveMentionsCompany(objective: string, companyName: string): boolean {
  const objectiveLower = objective.toLowerCase();
  const companyTokens = normalizeTokens(companyName);
  return companyTokens.some((token) => objectiveLower.includes(token));
}

export function detectProjectRelationshipMismatch(
  project: Project,
  companies: Company[],
): ProjectRelationshipValidation | undefined {
  if (!project.linkedCompanyId) return undefined;

  const account = companies.find((company) => company.CompanyID === project.linkedCompanyId);
  if (!account?.Title?.trim()) return undefined;

  const projectTokens = normalizeTokens(project.name);
  const accountTokens = normalizeTokens(account.Title);

  if (projectTokens.length === 0 || accountTokens.length === 0) return undefined;

  if (tokensOverlap(projectTokens, accountTokens)) return undefined;

  const objectiveAligns = objectiveMentionsCompany(project.objective, account.Title);

  return {
    id: "relationship_mismatch",
    detected: true,
    severity: "warning",
    projectName: project.name,
    accountName: account.Title,
    message: "Potential relationship mismatch detected.",
    detail: objectiveAligns
      ? `Project "${project.name}" is linked to ${account.Title}. The objective references this account, but the project name does not — please verify the relationship is correct.`
      : `Project "${project.name}" is linked to ${account.Title}. These names do not appear to describe the same organization — please verify.`,
    recommendedAction: "Confirm the connected account is correct, or update the project account to match the delivery context.",
  };
}
