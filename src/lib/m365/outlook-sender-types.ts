import type { SignatureEnrichment } from "@/lib/m365/signature-intelligence";

export type OutlookContactEnrichment = {
  jobTitle?: string;
  mobile?: string;
  phone?: string;
  companyName?: string;
  address?: string;
  website?: string;
};

export type OutlookSenderPrepopulation = {
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  domain: string;
  companyResolved: boolean;
  companyId: string | null;
  companyName: string;
  companyHint: string;
  enrichment: SignatureEnrichment;
};

export type OutlookAddContactInput = {
  email: string;
  firstName: string;
  lastName: string;
  companyName: string;
  /** User confirmed an auto-matched company — link contact to this record. */
  matchedCompanyId?: string;
  /** User rejected auto-match — do not resolve company from email domain. */
  skipAutoCompanyMatch?: boolean;
  enrichment?: OutlookContactEnrichment;
};

export type OutlookAddContactResult = {
  contactId: string;
  companyId: string;
  companyCreated: boolean;
  relationshipCard: import("@/types/m365").M365RelationshipCardPayload | null;
};
