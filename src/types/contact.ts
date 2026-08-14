import type { SharePointLookup } from "@/types/company";
import type {
  CareerHistoryEntry,
  CompanyTransferRecord,
  EmploymentStatus,
} from "@/types/contact-lifecycle";

/** Contact Role — presets suggested; free text allowed (Reality First). */
export type ContactListRole = string;

export type BuyingRole =
  | "No Buying Role"
  | "Economic Buyer"
  | "Champion"
  | "Technical Evaluator"
  | "Blocker"
  | "End User"
  | "Legal/Procurement";

export type ContactSentiment =
  | "Champion / Promoter"
  | "Neutral"
  | "Detractor / Skeptic";

export type InfluenceLevel = "High" | "Medium" | "Low";

export type EngagementCadence =
  | "Weekly"
  | "Bi-weekly"
  | "Monthly"
  | "Quarterly"
  | "Yearly"
  | "When needed";

export type ContactStatus = "Active" | "Inactive" | "Prospecting" | "Archived";

export type RelationshipLevel =
  | "Strategic"
  | "Operational"
  | "Tactical"
  | "Vendor";

/** Suggested roles — users may add others. */
export const CONTACT_LIST_ROLES: ContactListRole[] = [
  "Executive Sponsor",
  "Decision Maker",
  "Plant Manager",
  "Operations Manager",
  "Project Manager",
  "Technical Lead",
  "Engineer",
  "Compliance Officer",
  "Sustainability / ESG",
  "Procurement",
  "Finance / CFO",
  "Legal Counsel",
  "Business Development",
  "IT / Digital",
  "Consultant",
  "Researcher / Academic",
  "Other",
];

export function normalizeContactListRole(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

/** Prefer exact preset match (case-insensitive); otherwise keep free text. */
export function resolveContactListRole(
  value: string | null | undefined,
): ContactListRole {
  const trimmed = normalizeContactListRole(value);
  if (!trimmed) return "";
  const preset = CONTACT_LIST_ROLES.find(
    (item) => item.toLowerCase() === trimmed.toLowerCase(),
  );
  return preset ?? trimmed;
}

/**
 * Suggest a preset from job-title wording when the user did not pick a role.
 * Never invent — returns empty when no clear signal.
 */
export function suggestContactListRoleFromTitle(
  jobTitle: string | null | undefined,
): ContactListRole {
  const title = (jobTitle ?? "").toLowerCase();
  if (!title.trim()) return "";
  if (/ceo|cfo|chief|executive|sponsor|vp\b|vice president|managing director/.test(title)) {
    return "Executive Sponsor";
  }
  if (/decision.?maker|owner|board/.test(title)) return "Decision Maker";
  if (/plant manager/.test(title)) return "Plant Manager";
  if (/operations manager|ops manager/.test(title)) return "Operations Manager";
  if (/project manager|\bpm\b|prosjektleder/.test(title)) return "Project Manager";
  if (/technical lead|tech lead|cto|chief technology/.test(title)) return "Technical Lead";
  if (/engineer|technician|ingeniør|ingenior/.test(title)) return "Engineer";
  if (/compliance|permit|hse|environment/.test(title)) return "Compliance Officer";
  if (/sustainab|esg|climate|carbon/.test(title)) return "Sustainability / ESG";
  if (/procure|buyer|purchasing|supply chain/.test(title)) return "Procurement";
  if (/\bcfo\b|finance|controller|treasury/.test(title)) return "Finance / CFO";
  if (/legal|counsel|attorney|lawyer/.test(title)) return "Legal Counsel";
  if (/business development|\bbd\b|sales|salg|commercial/.test(title)) {
    return "Business Development";
  }
  if (/\bit\b|digital|cio|information systems/.test(title)) return "IT / Digital";
  if (/consultant|advisor|adviser/.test(title)) return "Consultant";
  if (/professor|researcher|phd|university|academic/.test(title)) {
    return "Researcher / Academic";
  }
  return "";
}

export const BUYING_ROLES: BuyingRole[] = [
  "No Buying Role",
  "Economic Buyer",
  "Champion",
  "Technical Evaluator",
  "Blocker",
  "End User",
  "Legal/Procurement",
];

/** Empty means unclassified — distinct from an explicit “No Buying Role”. */
export function isBuyingRoleUnknown(
  role: BuyingRole | string | null | undefined,
): boolean {
  return !(role ?? "").trim();
}

export const CONTACT_SENTIMENTS: ContactSentiment[] = [
  "Champion / Promoter",
  "Neutral",
  "Detractor / Skeptic",
];

export const INFLUENCE_LEVELS: InfluenceLevel[] = ["High", "Medium", "Low"];

export const ENGAGEMENT_CADENCES: EngagementCadence[] = [
  "Weekly",
  "Bi-weekly",
  "Monthly",
  "Quarterly",
  "Yearly",
  "When needed",
];

export const CONTACT_STATUSES: ContactStatus[] = [
  "Active",
  "Inactive",
  "Prospecting",
  "Archived",
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
  buyingRole?: BuyingRole;
  sentiment?: ContactSentiment;
  influenceLevel?: InfluenceLevel;
  reportsToId?: string;
  reportsToName?: string;
  streetAddress?: string;
  postalCode?: string;
  stateRegion?: string;
  countryCode?: string;
  continent?: string;
  city?: string;
  country?: string;
  timezone?: string;
  isTimezoneOverridden?: boolean;
  engagementCadence?: EngagementCadence;
  backgroundNotes?: string;
  preferredLanguage?: string;
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
  | "buyingRole"
  | "sentiment"
  | "influenceLevel"
  | "reportsToId"
  | "streetAddress"
  | "postalCode"
  | "stateRegion"
  | "countryCode"
  | "continent"
  | "city"
  | "country"
  | "timezone"
  | "isTimezoneOverridden"
  | "engagementCadence"
  | "backgroundNotes"
  | "preferredLanguage"
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
    | "buyingRole"
    | "sentiment"
    | "influenceLevel"
    | "reportsToId"
    | "streetAddress"
    | "postalCode"
    | "stateRegion"
    | "countryCode"
    | "continent"
    | "city"
    | "country"
    | "timezone"
    | "isTimezoneOverridden"
    | "engagementCadence"
    | "backgroundNotes"
    | "preferredLanguage"
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
