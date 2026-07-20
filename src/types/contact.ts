import type { SharePointLookup } from "@/types/company";
import type {
  CareerHistoryEntry,
  CompanyTransferRecord,
  EmploymentStatus,
} from "@/types/contact-lifecycle";

/** SharePoint Contacts list — Role choice field (PascalCase). */
export type ContactListRole =
  | "Executive Sponsor"
  | "Plant Manager"
  | "Compliance Officer"
  | "Procurement";

export type ContactStatus = "Active" | "Inactive" | "Prospecting";

export type RelationshipLevel =
  | "Strategic"
  | "Operational"
  | "Tactical"
  | "Vendor";

export const CONTACT_LIST_ROLES: ContactListRole[] = [
  "Executive Sponsor",
  "Plant Manager",
  "Compliance Officer",
  "Procurement",
];

export const CONTACT_STATUSES: ContactStatus[] = [
  "Active",
  "Inactive",
  "Prospecting",
];

export const RELATIONSHIP_LEVELS: RelationshipLevel[] = [
  "Strategic",
  "Operational",
  "Tactical",
  "Vendor",
];

/** SharePoint Contacts list — frozen schema. */
export type Contact = {
  /** SharePoint native list item ID */
  id: number;
  /** Tracking identifier, e.g. CT-10011 */
  ContactID: string;
  /** Display name — computed as FirstName + ' ' + LastName */
  Title: string;
  FirstName: string;
  LastName: string;
  Company: SharePointLookup;
  JobTitle: string;
  Role: ContactListRole;
  Email: string;
  Phone: string;
  Mobile: string;
  LinkedInURL: string;
  Status: ContactStatus;
  RelationshipLevel: RelationshipLevel;
  /** Phase 1.25 — employment lifecycle status */
  EmploymentStatus?: EmploymentStatus;
  /** Archived contacts are hidden from default lists but history is preserved */
  IsArchived?: boolean;
  /** Career timeline — previous employers, roles, dates */
  CareerHistory?: CareerHistoryEntry[];
  /** Company transfer audit trail */
  CompanyTransfers?: CompanyTransferRecord[];
  /** Flagged during import or review — name/company mismatch, duplicate, or bad data */
  IsSuspicious?: boolean;
};

export function getContactDisplayName(
  contact: Pick<Contact, "FirstName" | "LastName">,
): string {
  return `${contact.FirstName} ${contact.LastName}`.trim();
}

export function buildContactTitle(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

export type CreateContactInput = Pick<
  Contact,
  | "FirstName"
  | "LastName"
  | "JobTitle"
  | "Role"
  | "Email"
  | "Phone"
  | "Mobile"
  | "LinkedInURL"
  | "Status"
  | "RelationshipLevel"
  | "EmploymentStatus"
  | "IsArchived"
> & {
  Company: SharePointLookup | { CompanyID: string };
  EmploymentStatus?: EmploymentStatus;
};

export type ContactCompanyRef = SharePointLookup | { CompanyID: string };

export type UpdateContactInput = Partial<
  Pick<
    Contact,
    | "FirstName"
    | "LastName"
    | "Title"
    | "JobTitle"
    | "Role"
    | "Email"
    | "Phone"
    | "Mobile"
    | "LinkedInURL"
    | "Status"
    | "RelationshipLevel"
    | "IsSuspicious"
    | "EmploymentStatus"
    | "IsArchived"
    | "CareerHistory"
    | "CompanyTransfers"
  >
> & {
  Company?: ContactCompanyRef;
};

export type EditableContactField = keyof Pick<
  Contact,
  "Email" | "Phone" | "Mobile" | "LinkedInURL" | "JobTitle"
>;
