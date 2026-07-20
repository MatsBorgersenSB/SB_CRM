import type { Company } from "@/types/company";
import type { ProjectRelatedOrganization } from "@/types/project-relationships";
import { createOrganizationId } from "@/lib/project-relationship-utils";

/** Phase 2.2B — primary account helpers for project header controls. */

export function getPrimaryOrganization(
  organizations: ProjectRelatedOrganization[],
): ProjectRelatedOrganization | undefined {
  return organizations.find((org) => org.isPrimary) ?? organizations[0];
}

export function changeProjectAccount(
  organizations: ProjectRelatedOrganization[],
  companyId: string,
): ProjectRelatedOrganization[] {
  const primary = getPrimaryOrganization(organizations);

  if (primary) {
    return organizations.map((org) =>
      org.id === primary.id
        ? { ...org, companyId, organizationType: "customer", isPrimary: true }
        : org,
    );
  }

  return [
    {
      id: createOrganizationId(),
      companyId,
      organizationType: "customer",
      isPrimary: true,
      label: "Primary customer",
    },
    ...organizations,
  ];
}

export function replaceProjectAccount(
  organizations: ProjectRelatedOrganization[],
  companyId: string,
): ProjectRelatedOrganization[] {
  const withoutPrimary = organizations.filter((org) => !org.isPrimary);
  return [
    {
      id: createOrganizationId(),
      companyId,
      organizationType: "customer",
      isPrimary: true,
      label: "Primary customer",
    },
    ...withoutPrimary,
  ];
}

export function removeProjectAccount(
  organizations: ProjectRelatedOrganization[],
): ProjectRelatedOrganization[] {
  const primary = getPrimaryOrganization(organizations);
  if (!primary) return organizations;
  return organizations.filter((org) => org.id !== primary.id);
}

export function buildAccountCompanyOptions(
  companies: Company[],
  currentCompanyId?: string,
): Company[] {
  const sorted = [...companies].sort((a, b) => a.Title.localeCompare(b.Title));
  if (!currentCompanyId) return sorted;
  const current = sorted.find((company) => company.CompanyID === currentCompanyId);
  if (!current) return sorted;
  return [current, ...sorted.filter((company) => company.CompanyID !== currentCompanyId)];
}
