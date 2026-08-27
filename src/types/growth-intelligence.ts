import type { CompanyType } from "@/types/company-type";
import type { CompetitiveLandscapeSummary } from "@/types/competitive-intelligence";
import type { GrowthSuperSkills } from "@/types/growth-super-skills";

export const GROWTH_NORTH_STAR_OUTCOMES = [
  "Machinery sales",
  "Paid consulting engagements",
  "Engineering contracts",
  "Project development contracts",
  "Strategic partnerships",
  "Market awareness",
  "Market credibility",
] as const;

export type GrowthNorthStarOutcome = (typeof GROWTH_NORTH_STAR_OUTCOMES)[number];

export const GROWTH_INTELLIGENCE_SECTIONS = [
  {
    id: "dashboard",
    label: "This week",
    href: "/growth",
    description: "Named deals and people from the live registry — what to do now.",
  },
  {
    id: "competitors",
    label: "Competitors",
    href: "/growth/competitors",
    description: "Competitive landscape understanding — who, why, where, how, and what is changing.",
  },
  {
    id: "events",
    label: "Events",
    href: "/growth/events",
    description: "Named meetings from live contacts — paid-study agenda, not a booth.",
  },
  {
    id: "memberships",
    label: "Memberships",
    href: "/growth/memberships",
    description: "Industry associations and membership value analysis.",
  },
  {
    id: "market-segments",
    label: "Market Segments",
    href: "/growth/market-segments",
    description: "Target segments ranked by machinery and services potential.",
  },
  {
    id: "marketing-channels",
    label: "Marketing Channels",
    href: "/growth/marketing-channels",
    description: "Channel effectiveness for awareness, credibility and conversion.",
  },
  {
    id: "partner-ecosystem",
    label: "Partner Ecosystem",
    href: "/growth/partner-ecosystem",
    description: "Partners, offtakers, investors and research organizations.",
  },
  {
    id: "recommendations",
    label: "Recommendations",
    href: "/growth/recommendations",
    description: "Strategic actions grounded in live deals when possible.",
  },
  {
    id: "strategic-initiatives",
    label: "Strategic Initiatives",
    href: "/growth/strategic-initiatives",
    description: "Multi-horizon growth programs and execution tracking.",
  },
  {
    id: "market-intelligence",
    label: "Market Intelligence",
    href: "/growth/market-intelligence",
    description: "Evidence librarian — sourced facts from live CRM, or unknown.",
  },
] as const;

export type GrowthIntelligenceSectionId =
  (typeof GROWTH_INTELLIGENCE_SECTIONS)[number]["id"];

export type GrowthHorizon = "30d" | "90d" | "12m" | "36m";

export type GrowthEvidenceKind = "observed" | "unknown" | "hypothesis";

export type GrowthOperatingHorizon = "this_week" | "this_quarter" | "watch";

export type GrowthOperatingAction = {
  id: string;
  horizon: GrowthOperatingHorizon;
  title: string;
  why: string;
  next: string;
  impact: string;
  href: string;
  evidence: GrowthEvidenceKind;
  companyName?: string;
  dealName?: string;
};

export type GrowthOperatingLoop = {
  thisWeek: GrowthOperatingAction[];
  thisQuarter: GrowthOperatingAction[];
  watch: GrowthOperatingAction[];
  unknowns: string[];
};

export type GrowthLiveDeal = {
  id: string;
  name: string;
  companyName: string;
  status: string;
  nextStep: string;
  href: string;
  offer?: string;
  offerWhy?: string;
};

export type GrowthConfidence = "high" | "medium" | "low";

export type GrowthRecommendation = {
  id: string;
  what: string;
  why: string;
  when: string;
  where: string;
  how: string;
  expectedOutcome: string;
  confidencePercent: number;
  horizon: GrowthHorizon;
  outcomes: GrowthNorthStarOutcome[];
  priority: "critical" | "high" | "medium";
  status: "proposed" | "approved" | "in_progress" | "completed";
};

export type GrowthCompetitorProfile = {
  companyId: string;
  companyName: string;
  threatLevel: "critical" | "high" | "medium" | "low";
  competitorClass: "direct" | "indirect" | "emerging";
  positioning: string;
  strengths: string[];
  weaknesses: string[];
  successFactors: string[];
  recentActivity: string;
  memberships: string[];
  certifications: string[];
  eventPresence: string[];
  learnings: string;
  href: string;
};

export type GrowthEvent = {
  id: string;
  name: string;
  location: string;
  dateLabel: string;
  /** ISO date (YYYY-MM-DD) when the event ends — used to hide finished shows from planning. */
  endsOn?: string;
  horizon: GrowthHorizon;
  audienceQuality: "high" | "medium" | "low";
  decisionMakerDensity: "high" | "medium" | "low";
  strategicRelevance: number;
  competitivePresence: string[];
  estimatedCost: string;
  returnPotential: string;
  recommendation: "attend" | "monitor" | "skip";
  planningStatus: "needs_planning" | "planned" | "confirmed" | "completed";
  impact: string[];
};

export type GrowthMembership = {
  id: string;
  name: string;
  organizationCompanyId?: string;
  strategicRelevance: number;
  decisionMakerAccess: "high" | "medium" | "low";
  partnerAccess: "high" | "medium" | "low";
  marketInfluence: "high" | "medium" | "low";
  competitiveParticipation: string[];
  commercialPotential: string;
  recommendation: "join" | "evaluate" | "decline";
  timing: string;
  impact: string[];
};

export type GrowthMarketSegment = {
  id: string;
  name: string;
  geography: string;
  machineryPotential: "high" | "medium" | "low";
  servicesPotential: "high" | "medium" | "low";
  trend: "growing" | "stable" | "emerging";
  summary: string;
  opportunityCount: number;
  impact: string[];
};

export type GrowthMarketingChannel = {
  id: string;
  name: string;
  awareness: number;
  credibility: number;
  commercialImpact: number;
  strategicValue: number;
  longTermInfluence: number;
  rank: number;
  summary: string;
  impact: string[];
};

export type GrowthStrategicInitiative = {
  id: string;
  name: string;
  horizon: GrowthHorizon;
  status: "planned" | "active" | "completed";
  owner: string;
  outcomes: GrowthNorthStarOutcome[];
  summary: string;
  nextMilestone: string;
  impact: string[];
};

export type GrowthMarketIntelligenceItem = {
  id: string;
  category: "trend" | "regulation" | "funding" | "research" | "competitor_activity";
  title: string;
  summary: string;
  dateLabel: string;
  relevance: "high" | "medium" | "low";
  impact: string[];
  evidence?: GrowthEvidenceKind;
};

export type GrowthAttentionItem = {
  id: string;
  label: string;
  detail: string;
  severity: "critical" | "warning" | "info";
  href?: string;
  impact: string[];
};

export type GrowthEmergingOpportunity = {
  id: string;
  label: string;
  segment: string;
  horizon: GrowthHorizon;
  potential: "high" | "medium";
  impact: string[];
  href?: string;
};

export type GrowthIntelligenceSnapshot = {
  generatedAt: string;
  operatingLoop: GrowthOperatingLoop;
  liveDeals: GrowthLiveDeal[];
  attention: GrowthAttentionItem[];
  emergingOpportunities: GrowthEmergingOpportunity[];
  activeCompetitors: GrowthCompetitorProfile[];
  eventsRequiringPlanning: GrowthEvent[];
  recommendations: GrowthRecommendation[];
  competitors: GrowthCompetitorProfile[];
  events: GrowthEvent[];
  memberships: GrowthMembership[];
  marketSegments: GrowthMarketSegment[];
  marketingChannels: GrowthMarketingChannel[];
  partnerEcosystem: Array<{
    companyId: string;
    companyName: string;
    types: CompanyType[];
    role: string;
    strategicValue: string;
    href: string;
  }>;
  strategicInitiatives: GrowthStrategicInitiative[];
  marketIntelligence: GrowthMarketIntelligenceItem[];
  unverifiedMarketNotes: GrowthMarketIntelligenceItem[];
  superSkills: GrowthSuperSkills;
  competitiveLandscape: CompetitiveLandscapeSummary;
  metrics: {
    competitorCount: number;
    eventsNeedingPlanning: number;
    highPriorityRecommendations: number;
    partnerCount: number;
    emergingOpportunityCount: number;
  };
};

export function isGrowthSectionId(value: string): value is GrowthIntelligenceSectionId {
  return GROWTH_INTELLIGENCE_SECTIONS.some((section) => section.id === value);
}
