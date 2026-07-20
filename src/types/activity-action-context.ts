import type { InsightCategory } from "@/types/smartassist-intelligence";

export type RelevantDocument = {
  id: string;
  name: string;
  whyRelevant: string;
  href: string | null;
  insightCategory?: InsightCategory;
};

export type RelevantActivity = {
  id: string;
  subject: string;
  dateLabel: string;
  whyRelevant: string;
  href: string;
  insightCategory?: InsightCategory;
};

export type RelatedOpportunity = {
  dealId: string;
  name: string;
  status: string;
  attentionLevel: string;
  biggestUnknown: string;
  href: string;
};

export type RelevantContact = {
  contactId: string;
  name: string;
  role: string;
  relationship: string;
  href: string;
};

export type RelevantDecision = {
  text: string;
  whyRelevant: string;
};

export type ActivityActionContext = {
  documents: RelevantDocument[];
  activities: RelevantActivity[];
  opportunity: RelatedOpportunity | null;
  contacts: RelevantContact[];
  decisions: RelevantDecision[];
  viewAllDocumentsHref: string | null;
  viewAllActivitiesHref: string | null;
};
