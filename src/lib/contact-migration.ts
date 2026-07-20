import type { Contact, ContactListRole } from "@/types/contact";
import { buildContactTitle } from "@/types/contact";
import type { Company } from "@/types/company";

const LEGACY_ROLE_MAP: Record<string, ContactListRole> = {
  executive_sponsor: "Executive Sponsor",
  plant_manager: "Plant Manager",
  compliance_officer: "Compliance Officer",
  procurement: "Procurement",
};

type LegacyContact = {
  contactId: string;
  fullName: string;
  contactRole: string;
  email: string;
  phone: string;
};

function parseLegacyFullName(fullName: string): { FirstName: string; LastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) {
    return { FirstName: parts[0] ?? "", LastName: "" };
  }

  return { FirstName: parts[0]!, LastName: parts.slice(1).join(" ") };
}

export function migrateLegacyContact(
  raw: unknown,
  company: Pick<Company, "id" | "Title">,
  sharePointId?: number,
): Contact {
  const candidate = raw as Partial<Contact> & Partial<LegacyContact>;

  if (candidate.ContactID && candidate.FirstName !== undefined) {
    return {
      ...(candidate as Contact),
      Title:
        candidate.Title ??
        buildContactTitle(candidate.FirstName ?? "", candidate.LastName ?? ""),
      Company: candidate.Company ?? { Id: company.id, Title: company.Title },
    };
  }

  const legacy = raw as LegacyContact;
  const { FirstName, LastName } = parseLegacyFullName(legacy.fullName);
  const role = LEGACY_ROLE_MAP[legacy.contactRole] ?? "Plant Manager";

  return {
    id: sharePointId ?? 0,
    ContactID: legacy.contactId,
    Title: legacy.fullName,
    FirstName,
    LastName,
    Company: { Id: company.id, Title: company.Title },
    JobTitle: role,
    Role: role,
    Email: legacy.email,
    Phone: legacy.phone,
    Mobile: "",
    LinkedInURL: "",
    Status: "Active",
    RelationshipLevel: "Operational",
  };
}

export function contactsNeedMigration(contacts: unknown[]): boolean {
  return contacts.some((contact) => {
    const row = contact as Partial<Contact> & Partial<LegacyContact>;
    return !row.ContactID || row.FirstName === undefined;
  });
}
