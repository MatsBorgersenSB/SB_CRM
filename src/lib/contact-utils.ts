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

export function findContactByContactId(
  companies: Company[],
  pipelines: PipelineRow[],
  contactId: string,
  companyId?: string,
): GlobalContactRecord | undefined {
  const records = getGlobalContactRecords(companies, pipelines);

  if (companyId) {
    return findGlobalContactRecord(records, companyId, contactId);
  }

  return records.find((record) => record.contact.ContactID === contactId);
}
