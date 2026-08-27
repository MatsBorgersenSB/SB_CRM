import "server-only";

import { getContactDisplayName } from "@/types/contact";
import { findDuplicateContacts } from "@/lib/contact-lifecycle-engine";
import { readLiveCompanies } from "@/lib/prisma-data";
import type { ContactDuplicatePair } from "@/lib/duplicate-management/types";
import { normalizeEmailAddress } from "@/lib/duplicate-management/normalize";

function pairId(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

/**
 * Portfolio contact duplicate scan — wraps Contact Lifecycle rules.
 * Does not invent a second merge engine.
 */
export async function findPortfolioContactDuplicates(): Promise<ContactDuplicatePair[]> {
  const companies = await readLiveCompanies();
  const context = { companies, pipelines: [], activities: [] };
  const seen = new Set<string>();
  const pairs: ContactDuplicatePair[] = [];

  for (const company of companies) {
    for (const contact of company.contacts) {
      if (contact.IsArchived) continue;
      const duplicates = findDuplicateContacts(contact, company.CompanyID, context);
      for (const dup of duplicates) {
        if (dup.contact.IsArchived) continue;
        const id = pairId(contact.ContactID, dup.contact.ContactID);
        if (seen.has(id)) continue;
        seen.add(id);

        const confidence =
          dup.reason.toLowerCase().includes("email") ? "certain" : "medium";

        const primaryIsThis =
          (contact.Email?.trim() ? 1 : 0) + (contact.Phone?.trim() ? 1 : 0) >=
          (dup.contact.Email?.trim() ? 1 : 0) + (dup.contact.Phone?.trim() ? 1 : 0);

        const primaryContact = primaryIsThis ? contact : dup.contact;
        const secondaryContact = primaryIsThis ? dup.contact : contact;
        const primaryCompanyId = primaryIsThis ? company.CompanyID : dup.companyId;
        const primaryCompanyName = primaryIsThis ? company.Title : dup.companyName;
        const secondaryCompanyId = primaryIsThis ? dup.companyId : company.CompanyID;
        const secondaryCompanyName = primaryIsThis ? dup.companyName : company.Title;

        pairs.push({
          id: `contact-pair-${id}`,
          reason: dup.reason,
          confidence,
          primary: {
            contactId: primaryContact.ContactID,
            label: getContactDisplayName(primaryContact),
            email: normalizeEmailAddress(primaryContact.Email) || null,
            companyId: primaryCompanyId,
            companyName: primaryCompanyName,
          },
          secondary: {
            contactId: secondaryContact.ContactID,
            label: getContactDisplayName(secondaryContact),
            email: normalizeEmailAddress(secondaryContact.Email) || null,
            companyId: secondaryCompanyId,
            companyName: secondaryCompanyName,
          },
          mergeHref: `/contacts/${encodeURIComponent(primaryContact.ContactID)}?company=${encodeURIComponent(primaryCompanyId)}&lifecycle=merge`,
        });
      }
    }
  }

  pairs.sort((a, b) => {
    if (a.confidence === "certain" && b.confidence !== "certain") return -1;
    if (b.confidence === "certain" && a.confidence !== "certain") return 1;
    return a.primary.label.localeCompare(b.primary.label);
  });

  return pairs;
}
