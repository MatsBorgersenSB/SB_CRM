import {
  analyzeContactLifecycle,
  buildCareerTimeline,
  countPreservedReferences,
  type ContactLifecycleContext,
} from "@/lib/contact-lifecycle-engine";
import type { Contact } from "@/types/contact";
import type { EmploymentStatus, TransferContactInput } from "@/types/contact-lifecycle";

/** Server-only contact lifecycle mutations — Prisma registry first, JSON fallback. */

export async function loadContactLifecycleContext(): Promise<ContactLifecycleContext> {
  const { readLivePortfolio, readLiveActivities } = await import("@/lib/prisma-data");

  const [{ companies, pipelines }, activities] = await Promise.all([
    readLivePortfolio(),
    readLiveActivities(),
  ]);

  return { companies, pipelines, activities };
}

export async function auditContactLifecycle(
  contactId: string,
  companyId?: string,
): Promise<ReturnType<typeof analyzeContactLifecycle>> {
  const context = await loadContactLifecycleContext();
  const location = findContactInContext(contactId, context);

  if (!location) {
    throw new Error(`Contact not found: ${contactId}`);
  }

  const resolvedCompanyId = companyId ?? location.company.CompanyID;

  return analyzeContactLifecycle(
    location.contact,
    resolvedCompanyId,
    location.company.Title,
    context,
  );
}

function findContactInContext(
  contactId: string,
  context: ContactLifecycleContext,
): { contact: Contact; company: (typeof context.companies)[number] } | null {
  const key = contactId.trim().toLowerCase();
  for (const company of context.companies) {
    const contact = company.contacts.find((row) => {
      if (row.ContactID?.trim().toLowerCase() === key) return true;
      if (String(row.id).toLowerCase() === key) return true;
      return false;
    });
    if (contact) return { contact, company };
  }
  return null;
}

export async function executeContactTransfer(
  contactId: string,
  input: TransferContactInput,
): Promise<Contact> {
  const { updateRegistryContact } = await import("@/lib/contact-registry");
  const updated = await updateRegistryContact(contactId, {
    Company: { CompanyID: input.targetCompanyId },
    ...(input.newRole ? { Role: input.newRole } : {}),
    ...(input.newJobTitle !== undefined ? { JobTitle: input.newJobTitle } : {}),
    ...(input.employmentStatus ? { EmploymentStatus: input.employmentStatus } : {}),
  });
  if (updated) return updated;

  const { transferCompanyContactWithHistory } = await import("@/lib/pipeline-db");
  return transferCompanyContactWithHistory(contactId, input);
}

export async function executeContactArchive(
  contactId: string,
  archived: boolean,
  employmentStatus?: EmploymentStatus,
): Promise<Contact> {
  const { updateRegistryContact } = await import("@/lib/contact-registry");
  const updated = await updateRegistryContact(contactId, {
    IsArchived: archived,
    ...(employmentStatus ? { EmploymentStatus: employmentStatus } : {}),
  });
  if (updated) return updated;

  const { archiveCompanyContact } = await import("@/lib/pipeline-db");
  return archiveCompanyContact(contactId, archived, employmentStatus);
}

export async function executeContactMerge(
  primaryContactId: string,
  secondaryContactId: string,
): Promise<Contact> {
  const { mergeCompanyContacts } = await import("@/lib/pipeline-db");
  return mergeCompanyContacts(primaryContactId, secondaryContactId);
}

export async function previewContactTransfer(
  contactId: string,
  targetCompanyId: string,
): Promise<{
  contact: Contact;
  sourceCompanyId: string;
  targetCompanyName: string;
  preservedReferences: ReturnType<typeof countPreservedReferences>;
  careerTimeline: ReturnType<typeof buildCareerTimeline>;
}> {
  const context = await loadContactLifecycleContext();
  const location = findContactInContext(contactId, context);

  if (!location) {
    throw new Error(`Contact not found: ${contactId}`);
  }

  const targetCompany = context.companies.find(
    (company) => company.CompanyID === targetCompanyId,
  );

  if (!targetCompany) {
    throw new Error(`Company not found: ${targetCompanyId}`);
  }

  return {
    contact: location.contact,
    sourceCompanyId: location.company.CompanyID,
    targetCompanyName: targetCompany.Title,
    preservedReferences: countPreservedReferences(
      location.contact,
      location.company,
      context,
    ),
    careerTimeline: buildCareerTimeline(location.contact, location.company),
  };
}
