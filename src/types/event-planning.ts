import type { GrowthEvent } from "@/types/growth-intelligence";
import type { ConfidenceLevel } from "@/lib/opportunity-workspace-intelligence";
import type { InsightCategory } from "@/types/smartassist-intelligence";

export type EventPlanningContactStatus =
  | "identified"
  | "meeting_requested"
  | "meeting_scheduled";

export type EventDiscoverySource = "crm" | "inferred" | "seed";

export type EventContactDiscovery = {
  website?: string;
  contactPageUrl?: string;
  email?: string;
  linkedInUrl?: string;
  phone?: string;
  source: EventDiscoverySource;
};

export type EventPlanningCompany = {
  id: string;
  name: string;
  companyId?: string;
  industry?: string;
  geography?: string;
  relevanceScore: number;
  relevanceReasons: string[];
  discovery: EventContactDiscovery;
  inCrm: boolean;
  href?: string;
};

export type EventPlanningContact = {
  id: string;
  contactId?: string;
  companyTargetId: string;
  companyName: string;
  name: string;
  jobTitle?: string;
  role?: string;
  relevanceScore: number;
  whyRelevant: string;
  discussionTopics: string[];
  discovery: EventContactDiscovery;
  status: EventPlanningContactStatus;
  inCrm: boolean;
  priority: "high" | "medium" | "low";
};

export type EventOutreachRecommendation = {
  contactTargetId: string;
  contactName: string;
  companyName: string;
  whyContact: string;
  discussionTopics: string[];
  confidence: ConfidenceLevel;
  priority: number;
  emailSubject?: string;
  emailBody?: string;
};

export type EventMeetingCategory =
  | "opportunity_match"
  | "prospect"
  | "competitor"
  | "partner"
  | "customer";

export type EventMeetingSignal = {
  rank: number;
  contactTargetId: string;
  name: string;
  companyName: string;
  category: EventMeetingCategory;
  whyMeet: string;
  confidence: ConfidenceLevel;
  insightCategory: InsightCategory;
};

export type EventSignalGroups = {
  topToMeet: EventMeetingSignal[];
  topCompetitors: EventMeetingSignal[];
  topPartners: EventMeetingSignal[];
  topCustomers: EventMeetingSignal[];
  topProspects: EventMeetingSignal[];
};

export type EventPlanningMetrics = {
  companiesIdentified: number;
  contactsIdentified: number;
  meetingsRequested: number;
  meetingsScheduled: number;
  companiesShown: number;
  contactsShown: number;
};

export type EventPlanningWorkspace = {
  event: GrowthEvent;
  headline: string;
  focusQuestions: string[];
  /** Signal-budget capped lists */
  companies: EventPlanningCompany[];
  contacts: EventPlanningContact[];
  signals: EventSignalGroups;
  recommendations: EventOutreachRecommendation[];
  metrics: EventPlanningMetrics;
  /** Single primary action */
  primaryAction: string | null;
  nextActions: string[];
};

export type EventPlanningProspectContactSeed = {
  id: string;
  name: string;
  jobTitle?: string;
  role?: string;
  email?: string;
  phone?: string;
  linkedInUrl?: string;
  whyRelevant: string;
  discussionTopics: string[];
};

export type EventPlanningProspectCompanySeed = {
  id: string;
  name: string;
  industry?: string;
  geography?: string;
  domain?: string;
  phone?: string;
  contactPageUrl?: string;
  relevanceReasons: string[];
  contacts: EventPlanningProspectContactSeed[];
};

export type EventPlanningSeed = {
  targetIndustries: string[];
  targetGeographies: string[];
  focusSegments: string[];
  discussionThemes: string[];
  prospectCompanies: EventPlanningProspectCompanySeed[];
};

export function eventPlanningHref(eventId: string): string {
  return `/growth/events/${eventId}`;
}
