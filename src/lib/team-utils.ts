import type { Company, Contact } from "@/lib/companies-data";
import type { PipelineTeamMember } from "@/types/pipeline";

export type ResolvedTeamMember = PipelineTeamMember & {
  contact: Contact;
};

export function getAllContacts(companies: Company[]): Contact[] {
  const seen = new Set<string>();
  const contacts: Contact[] = [];

  for (const company of companies) {
    for (const contact of company.contacts) {
      if (seen.has(contact.ContactID)) continue;
      seen.add(contact.ContactID);
      contacts.push(contact);
    }
  }

  return contacts;
}

export function resolvePipelineTeam(
  team: PipelineTeamMember[] | undefined,
  companies: Company[],
): ResolvedTeamMember[] {
  if (!team?.length) return [];

  const contactMap = new Map<string, Contact>();

  for (const company of companies) {
    for (const contact of company.contacts) {
      contactMap.set(contact.ContactID, contact);
    }
  }

  return team.flatMap((member) => {
    const contact = contactMap.get(member.contactId);
    if (!contact) return [];
    return [{ ...member, contact }];
  });
}
