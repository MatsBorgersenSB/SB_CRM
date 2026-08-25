import type { PipelineRow } from "@/types/pipeline";

export type GrowthEvidenceGrade = "observed" | "reported" | "unverified";

export type GrowthOfferKind =
  | "paid_feasibility"
  | "engineering"
  | "machinery"
  | "walk_away"
  | "watch";

export type GrowthAuthorityLevel = "national" | "regional" | "local" | "project";

export type GrowthDealRecord = PipelineRow & {
  registryStatus?: "open" | "on_hold" | "closed_won" | "closed_lost" | "archived";
  description?: string | null;
  updatedAt?: string;
};

export type GrowthCorrespondenceSnippet = {
  opportunityId: string | null;
  subject: string;
  bodyPreview: string | null;
  sentAt: string;
};

export type GrowthHearingMention = {
  competitorName: string;
  quote: string;
  source: "email" | "activity" | "deal_field";
  asOf?: string;
};

export type GrowthDealHearing = {
  dealId: string;
  dealName: string;
  companyName: string;
  href: string;
  mentions: GrowthHearingMention[];
  unknown: boolean;
};

export type GrowthProjectReality = {
  dealId: string;
  dealName: string;
  companyName: string;
  href: string;
  blockers: Array<"funding" | "permit" | "offtake" | "build" | "operate" | "decision_maker">;
  fatal: string | null;
  next: string;
  authorityLevel: GrowthAuthorityLevel;
};

export type GrowthStakeholderCoverage = {
  dealId: string;
  dealName: string;
  companyName: string;
  href: string;
  have: string[];
  missing: Array<"economic_buyer" | "technical" | "financier" | "authority">;
};

export type GrowthOfferChoice = {
  dealId: string;
  dealName: string;
  companyName: string;
  href: string;
  offer: GrowthOfferKind;
  why: string;
};

export type GrowthWinLossMemory = {
  id: string;
  dealName: string;
  companyName: string;
  outcome: "won" | "lost";
  lesson: string;
  source: string;
  asOf: string;
  href: string;
};

export type GrowthMarketIntelCard = {
  id: string;
  category: "regulation" | "funding" | "competitor_activity" | "demand" | "pipeline" | "unknown";
  title: string;
  fact: string;
  geography: string;
  asOf: string;
  sourceLabel: string;
  evidence: GrowthEvidenceGrade;
  offerImplication: GrowthOfferKind;
  offerWhy: string;
  relatedDeals: Array<{ id: string; name: string; href: string }>;
  nextAction: string;
  nextHref: string;
  authorityLevel: GrowthAuthorityLevel;
};

export type GrowthMeetingTarget = {
  eventId: string;
  eventName: string;
  companyName: string;
  companyHref: string;
  contactName: string | null;
  contactRole: string | null;
  contactEmail?: string | null;
  offer: GrowthOfferKind;
  agenda: string;
  href: string;
  dealName?: string;
};

export type GrowthSuperSkills = {
  hearings: GrowthDealHearing[];
  realities: GrowthProjectReality[];
  stakeholders: GrowthStakeholderCoverage[];
  offers: GrowthOfferChoice[];
  winLoss: GrowthWinLossMemory[];
  marketIntel: GrowthMarketIntelCard[];
  meetingMachine: GrowthMeetingTarget[];
};

export function offerLabel(offer: GrowthOfferKind): string {
  switch (offer) {
    case "paid_feasibility":
      return "Paid feasibility / bankability";
    case "engineering":
      return "Engineering / qualification";
    case "machinery":
      return "Machinery conversation";
    case "walk_away":
      return "Do not sell";
    case "watch":
      return "Watch — do not act";
  }
}
