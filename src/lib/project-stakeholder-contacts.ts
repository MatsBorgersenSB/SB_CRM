import type { Company } from "@/types/company";
import type { Contact } from "@/types/contact";
import { getContactDisplayName } from "@/types/contact";
import type { Project } from "@/types/project";
import type {
  ProjectRelatedOrganization,
  ProjectRemovedStakeholderRecord,
  ProjectStakeholderRecord,
} from "@/types/project-relationships";
import {
  getProjectRelatedOrganizations,
  isRemovedStakeholder,
} from "@/lib/project-relationship-utils";

export type ProjectContactOption = {
  contact: Contact;
  companyId: string;
  companyName: string;
  source: "account" | "organization" | "other";
};

export function getProjectAccountCompanyId(project: Project): string | undefined {
  const orgs = getProjectRelatedOrganizations(project);
  const primary = orgs.find((org) => org.isPrimary) ?? orgs[0];
  return primary?.companyId ?? project.linkedCompanyId;
}

export function buildProjectContactOptions(
  project: Project,
  companies: Company[],
  organizations: ProjectRelatedOrganization[],
  assignedContactIds: Set<string>,
  removedStakeholders: ProjectRemovedStakeholderRecord[] = [],
): { accountContacts: ProjectContactOption[]; otherContacts: ProjectContactOption[] } {
  const accountCompanyId = getProjectAccountCompanyId(project);
  const orgCompanyIds = new Set(organizations.map((org) => org.companyId));
  const removedContactIds = new Set(
    removedStakeholders.map((entry) => entry.contactId).filter(Boolean) as string[],
  );

  const accountContacts: ProjectContactOption[] = [];
  const otherContacts: ProjectContactOption[] = [];

  for (const company of companies) {
    const isAccount = company.CompanyID === accountCompanyId;
    const isOrg =
      orgCompanyIds.has(company.CompanyID) && company.CompanyID !== accountCompanyId;

    if (!isAccount && !isOrg && orgCompanyIds.size > 0) continue;
    if (!isAccount && !isOrg && orgCompanyIds.size === 0 && accountCompanyId) continue;

    for (const contact of company.contacts) {
      if (assignedContactIds.has(contact.ContactID)) continue;
      if (removedContactIds.has(contact.ContactID)) continue;
      if (isRemovedStakeholder({ id: contact.ContactID, contactId: contact.ContactID, name: getContactDisplayName(contact), role: "" }, removedStakeholders)) continue;

      const option: ProjectContactOption = {
        contact,
        companyId: company.CompanyID,
        companyName: company.Title,
        source: isAccount ? "account" : isOrg ? "organization" : "other",
      };

      if (isAccount) {
        accountContacts.push(option);
      } else {
        otherContacts.push(option);
      }
    }
  }

  const byName = (a: ProjectContactOption, b: ProjectContactOption) =>
    getContactDisplayName(a.contact).localeCompare(getContactDisplayName(b.contact));

  return {
    accountContacts: accountContacts.sort(byName),
    otherContacts: otherContacts.sort(byName),
  };
}

export function buildRemovedStakeholderRecord(
  stakeholder: ProjectStakeholderRecord,
): ProjectRemovedStakeholderRecord {
  return {
    stakeholderId: stakeholder.id,
    contactId: stakeholder.contactId,
    userId: stakeholder.userId,
    role: stakeholder.role,
    name: stakeholder.name,
    removedAt: new Date().toISOString(),
  };
}

export function mergeRemovedStakeholders(
  existing: ProjectRemovedStakeholderRecord[] | undefined,
  removed: ProjectRemovedStakeholderRecord[],
): ProjectRemovedStakeholderRecord[] {
  const merged = [...(existing ?? [])];
  for (const entry of removed) {
    if (merged.some((item) => item.stakeholderId === entry.stakeholderId)) continue;
    if (
      entry.contactId &&
      merged.some((item) => item.contactId === entry.contactId)
    ) {
      continue;
    }
    if (entry.userId && merged.some((item) => item.userId === entry.userId && item.role === entry.role)) {
      continue;
    }
    merged.push(entry);
  }
  return merged;
}

export function clearRemovedStakeholderForOwner(
  removed: ProjectRemovedStakeholderRecord[] | undefined,
  owner: { Id: number; Title: string },
): ProjectRemovedStakeholderRecord[] {
  return (removed ?? []).filter(
    (entry) =>
      !(
        entry.userId === owner.Id &&
        entry.role?.toLowerCase() === "project manager"
      ),
  );
}
