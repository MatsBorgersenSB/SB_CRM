import type { Company, Contact } from "@/lib/companies-data";
import { getContactDisplayName } from "@/types/contact";
import type { PipelineRow } from "@/types/pipeline";

export type GlobalContactRecord = {
  contact: Contact;
  companyId: string;
  companyName: string;
  linkedPipelineIds: string[];
};

export function getLinkedPipelineIdsForContact(
  contactId: string,
  company: Company,
  pipelines: PipelineRow[],
): string[] {
  const linked = new Set<string>(company.pipelineIds);

  for (const pipeline of pipelines) {
    const onTeam = pipeline.team?.some((member) => member.contactId === contactId);
    if (onTeam) linked.add(pipeline.id);
  }

  return Array.from(linked).sort();
}

export function getGlobalContactRecords(
  companies: Company[],
  pipelines: PipelineRow[],
): GlobalContactRecord[] {
  const records: GlobalContactRecord[] = [];

  for (const company of companies) {
    for (const contact of company.contacts) {
      records.push({
        contact,
        companyId: company.CompanyID,
        companyName: company.Title,
        linkedPipelineIds: getLinkedPipelineIdsForContact(
          contact.ContactID,
          company,
          pipelines,
        ),
      });
    }
  }

  return records.sort((a, b) =>
    getContactDisplayName(a.contact).localeCompare(getContactDisplayName(b.contact)),
  );
}

export function findGlobalContactRecord(
  records: GlobalContactRecord[],
  companyId: string,
  contactId: string,
): GlobalContactRecord | undefined {
  return records.find(
    (record) =>
      record.companyId === companyId && record.contact.ContactID === contactId,
  );
}

function contactMatchesRouteKey(
  contact: Contact,
  routeKey: string,
): boolean {
  const key = routeKey.trim();
  if (!key) return false;

  if (contact.ContactID === key) return true;
  if (String(contact.id) === key) return true;

  const email = contact.Email?.trim().toLowerCase();
  if (email && email === key.toLowerCase()) return true;

  return false;
}

/**
 * Resolve a contact from a route key: ContactID, numeric list id, or email.
 * When `companyId` is set, prefer that company but fall back to a global match
 * so email / external links still resolve.
 */
export function findContactByContactId(
  companies: Company[],
  pipelines: PipelineRow[],
  contactId: string,
  companyId?: string,
): GlobalContactRecord | undefined {
  const records = getGlobalContactRecords(companies, pipelines);
  const key = contactId.trim();
  if (!key) return undefined;

  if (companyId) {
    const scoped = records.find(
      (record) =>
        record.companyId === companyId &&
        contactMatchesRouteKey(record.contact, key),
    );
    if (scoped) return scoped;
  }

  return records.find((record) => contactMatchesRouteKey(record.contact, key));
}
