/** FS-020 Duplicate Manager — shared types. */

export type DuplicateConfidence = "certain" | "high" | "medium";

export type CompanyMatchReasonCode =
  | "organization_number"
  | "vat_number"
  | "website_domain"
  | "normalized_name"
  | "email_domain"
  | "phone";

export type CompanyMatchReason = {
  code: CompanyMatchReasonCode;
  label: string;
  confidence: DuplicateConfidence;
  value?: string;
};

export type DuplicateCompanyMember = {
  id: string;
  code: string;
  name: string;
  types: string[];
  organizationNumber: string | null;
  vatNumber: string | null;
  website: string | null;
  domain: string | null;
  city: string | null;
  country: string | null;
  ownerId: string | null;
  status: string;
  contactCount: number;
  opportunityCount: number;
  openOpportunityCount: number;
  createdAt: string;
  survivorshipScore: number;
};

export type CompanyDuplicateCluster = {
  id: string;
  confidence: DuplicateConfidence;
  reasons: CompanyMatchReason[];
  suggestedPrimaryId: string;
  members: DuplicateCompanyMember[];
};

export type ContactDuplicatePair = {
  id: string;
  reason: string;
  confidence: DuplicateConfidence;
  primary: {
    contactId: string;
    label: string;
    email: string | null;
    companyId: string;
    companyName: string;
  };
  secondary: {
    contactId: string;
    label: string;
    email: string | null;
    companyId: string;
    companyName: string;
  };
  mergeHref: string;
};

export type DuplicateScanResult = {
  generatedAt: string;
  companies: {
    clusterCount: number;
    certainCount: number;
    highCount: number;
    mediumCount: number;
    clusters: CompanyDuplicateCluster[];
  };
  contacts: {
    pairCount: number;
    pairs: ContactDuplicatePair[];
  };
};

export type CompanyMergeResult = {
  primaryId: string;
  primaryCode: string;
  secondaryId: string;
  secondaryCode: string;
  remapped: {
    contacts: number;
    contactsArchivedAsDuplicates: number;
    opportunities: number;
    notes: number;
    documents: number;
    meetings: number;
  };
};
