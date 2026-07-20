import type { ContactListRole } from "@/types/contact";

export type EmploymentStatus =
  | "Active"
  | "Former Employee"
  | "Left Company"
  | "Retired"
  | "Do Not Contact"
  | "Suspicious";

export const EMPLOYMENT_STATUSES: EmploymentStatus[] = [
  "Active",
  "Former Employee",
  "Left Company",
  "Retired",
  "Do Not Contact",
  "Suspicious",
];

export type CareerHistoryEntry = {
  id: string;
  companyId: string;
  companyName: string;
  role: ContactListRole | string;
  jobTitle: string;
  startDate: string;
  endDate: string | null;
};

export type CompanyTransferRecord = {
  id: string;
  previousCompanyId: string;
  previousCompanyName: string;
  newCompanyId: string;
  newCompanyName: string;
  transferDate: string;
  preservedReferences: {
    activities: number;
    documents: number;
    opportunities: number;
    emails: number;
  };
};

export type ContactLifecycleInsightCategory =
  | "company_move"
  | "role_change"
  | "potential_duplicate"
  | "relationship_opportunity";

export type ContactLifecycleInsight = {
  id: string;
  category: ContactLifecycleInsightCategory;
  categoryLabel: string;
  title: string;
  why: string;
  impact: string;
  recommendedAction: string;
  resolutionHref: string;
  resolutionLabel: string;
  severity: "critical" | "warning" | "info";
};

export type ContactLifecycleAudit = {
  contactId: string;
  generatedAt: string;
  insights: ContactLifecycleInsight[];
  summary: string;
};

export type TransferContactInput = {
  targetCompanyId: string;
  newRole?: ContactListRole;
  newJobTitle?: string;
  employmentStatus?: EmploymentStatus;
};

export type MergeContactInput = {
  primaryContactId: string;
  secondaryContactId: string;
};
