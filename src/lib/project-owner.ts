import { buildCompanyOwnerOptions } from "@/lib/company-owner";
import { resolveProjectManagerName } from "@/lib/project-team-utils";
import type { Company, SharePointPerson } from "@/types/company";
import { STANDARD_BIO_USERS } from "@/types/bio-user";
import type { Project } from "@/types/project";

export function resolveProjectOwner(project: Project): SharePointPerson | null {
  const title = resolveProjectManagerName(project)?.trim();
  if (!title) return null;

  const canonical = STANDARD_BIO_USERS.find(
    (user) => user.Title.toLowerCase() === title.toLowerCase(),
  );
  return canonical ?? { Id: -1, Title: title };
}

export function buildProjectOwnerOptions(
  companies: Company[],
  currentOwner?: SharePointPerson | null,
): SharePointPerson[] {
  return buildCompanyOwnerOptions(companies, currentOwner);
}
