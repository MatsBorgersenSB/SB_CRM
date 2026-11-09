/**
 * FS-012 Relationship Intake — proposal types.
 * Propose → Confirm → Persist. Never auto-create.
 */

import type { SignatureEnrichment } from "@/lib/m365/signature-intelligence";
import type { SharePointPerson } from "@/types/company";
import type { OutlookAddContactResult, OutlookContactEnrichment } from "@/lib/m365/outlook-sender-types";
import type { OutlookCompanyOption } from "@/lib/m365/company-resolution";

export type RelationshipIntakeConfidence = "high" | "medium" | "low" | "none";

export type RelationshipIntakeResolutionKind =
  | "company_match"
  | "new_company"
  | "internal_colleague"
  /** Person already in the Contact Registry — show the card, never offer create. */
  | "contact_exists";

export type RelationshipIntakeExistingContact = {
  contactId: string;
  companyId: string;
  displayName: string;
  companyName: string;
  /** Registry status — "active" opens the card; anything else needs reactivation. */
  status: string;
};

export type RelationshipIntakeLinkOption = {
  id: string;
  label: string;
  name: string;
  kind: "opportunity" | "project";
};

export type RelationshipIntakeProposal = {
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  domain: string;
  resolutionKind: RelationshipIntakeResolutionKind;
  confidence: RelationshipIntakeConfidence;
  companyResolved: boolean;
  companyId: string | null;
  companyName: string;
  companyHint: string;
  decisionQuestion: string;
  decisionImpact: string;
  requiresCompanyType: boolean;
  requiresIndustry: boolean;
  enrichment: SignatureEnrichment;
  opportunityOptions: RelationshipIntakeLinkOption[];
  projectOptions: RelationshipIntakeLinkOption[];
  companyOptions: OutlookCompanyOption[];
  /** Set when `resolutionKind === "contact_exists"`. */
  existingContact?: RelationshipIntakeExistingContact | null;
  colleague?: {
    email: string;
    knownUser: boolean;
    displayName: string;
    userId: string | null;
    team: string | null;
    role: string | null;
  } | null;
};

export type RelationshipIntakeApproveInput = {
  email: string;
  firstName: string;
  lastName: string;
  companyName: string;
  role: string;
  industry?: string;
  companyTypes?: string[];
  matchedCompanyId?: string;
  skipAutoCompanyMatch?: boolean;
  enrichment?: OutlookContactEnrichment;
  /** Person who confirmed the import — becomes company and contact owner. */
  accountOwner?: SharePointPerson | null;
  /** Optional intentional thread link after create. */
  conversationId?: string;
  opportunityId?: string | null;
  projectId?: string | null;
  message?: {
    externalMessageId?: string;
    subject?: string;
    senderEmail?: string;
    recipientEmails?: string[];
    sentAt?: string;
    bodyPreview?: string;
    webLink?: string;
    isOutbound?: boolean;
  };
};

export type RelationshipIntakeApproveResult = OutlookAddContactResult & {
  threadLinked: boolean;
  linkedOpportunityId?: string | null;
  linkedProjectId?: string | null;
};
