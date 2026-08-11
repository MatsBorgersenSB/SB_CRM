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

/** Resolve a project org/account company ref against live CompanyIDs / codes / names. */
export function findCompanyByProjectRef(
  companies: Company[],
  companyRef: string | undefined | null,
): Company | undefined {
  const key = companyRef?.trim();
  if (!key) return undefined;
  const lower = key.toLowerCase();
  return companies.find(
    (company) =>
      company.CompanyID === key ||
      company.code === key ||
      company.Title.trim().toLowerCase() === lower,
  );
}

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
  const accountCompany = findCompanyByProjectRef(companies, accountCompanyId);
  const resolvedAccountId = accountCompany?.CompanyID ?? accountCompanyId;

  const orgCompanyIds = new Set<string>();
  for (const org of organizations) {
    const matched = findCompanyByProjectRef(companies, org.companyId);
    if (matched) orgCompanyIds.add(matched.CompanyID);
    else if (org.companyId) orgCompanyIds.add(org.companyId);
  }

  const removedContactIds = new Set(
    removedStakeholders.map((entry) => entry.contactId).filter(Boolean) as string[],
  );

  const accountContacts: ProjectContactOption[] = [];
  const otherContacts: ProjectContactOption[] = [];
  const seen = new Set<string>();

  const pushOption = (
    contact: Contact,
    company: Company,
    source: ProjectContactOption["source"],
  ) => {
    if (seen.has(contact.ContactID)) return;
    if (assignedContactIds.has(contact.ContactID)) return;
    if (removedContactIds.has(contact.ContactID)) return;
    if (
      isRemovedStakeholder(
        {
          id: contact.ContactID,
          contactId: contact.ContactID,
          name: getContactDisplayName(contact),
          role: "",
        },
        removedStakeholders,
      )
    ) {
      return;
    }

    seen.add(contact.ContactID);
    const option: ProjectContactOption = {
      contact,
      companyId: company.CompanyID,
      companyName: company.Title,
      source,
    };
    if (source === "account") accountContacts.push(option);
    else otherContacts.push(option);
  };

  for (const company of companies) {
    const isAccount = Boolean(
      resolvedAccountId && company.CompanyID === resolvedAccountId,
    );
    const isOrg =
      orgCompanyIds.has(company.CompanyID) && company.CompanyID !== resolvedAccountId;

    for (const contact of company.contacts ?? []) {
      if (isAccount) {
        pushOption(contact, company, "account");
      } else if (isOrg) {
        pushOption(contact, company, "organization");
      } else {
        // Always searchable — suppliers / partners on the project (e.g. AlsaFlam on Escalante).
        pushOption(contact, company, "other");
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
