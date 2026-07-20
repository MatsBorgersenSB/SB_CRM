import type { ConfidenceLevel } from "@/lib/opportunity-workspace-intelligence";
import type { GrowthCompetitorProfile } from "@/types/growth-intelligence";
import type { SmartAssistInsight } from "@/types/smartassist-intelligence";
import type { CompetitorOverlapScores } from "@/lib/signal-extraction";

export const SMARTASSIST_COMPETITIVE_QUESTIONS = [
  "Who do we compete with?",
  "Why do we compete with them?",
  "Where do we compete?",
  "How do we compete?",
  "What is changing?",
] as const;

export type CompetitiveMarketContext = {
  id: string;
  name: string;
  geography: string;
  competitiveIntensity: "high" | "medium" | "low";
  summary: string;
  activeCompetitorIds?: string[];
};

export type CompetitiveTechnologyContext = {
  id: string;
  name: string;
  maturity: "commercial" | "emerging" | "research";
  summary: string;
  leadingCompetitorIds?: string[];
};

export type CompetitiveBusinessContext = {
  summary: string;
  focusAreas: string[];
  derivedFrom: "crm" | "seed" | "mixed";
};

export type CompetitiveLandscapeContext = {
  business: CompetitiveBusinessContext;
  markets: CompetitiveMarketContext[];
  technologies: CompetitiveTechnologyContext[];
};

export type CompetitorWhereWeCompete = {
  markets: string[];
  geographies: string[];
  segments: string[];
  overlappingDeals?: string[];
  overlappingEvents?: string[];
};

export type CompetitorHowWeCompete = {
  theirApproach: string;
  ourCounter: string;
  winConditions: string[];
  loseConditions: string[];
};

export type CompetitorChangeSignal = {
  change: string;
  implication: string;
  dateLabel: string;
};

export type CompetitorBdDecision = {
  action: string;
  why: string;
  expectedImpact: string;
  confidence: ConfidenceLevel;
};

export type PotentialMissingCompetitor = {
  name: string;
  status: "unclassified" | "requires_validation";
  reason: string;
};

export type CompetitorSignalAssessment = {
  confidence: ConfidenceLevel;
  confidenceReason: string;
  overlapScores: CompetitorOverlapScores;
};

export type CompetitorUnderstanding = {
  profile: GrowthCompetitorProfile;
  whyWeCompete: string;
  whereWeCompete: CompetitorWhereWeCompete;
  howWeCompete: CompetitorHowWeCompete;
  whatsChanging: CompetitorChangeSignal[];
  whatWeShouldLearn: string;
  nextBestDecision: CompetitorBdDecision;
  relatedMarketIntelligence?: string[];
  signalAssessment: CompetitorSignalAssessment;
  knowledgeInsights: SmartAssistInsight[];
};

export type CompetitiveLandscapeSummary = {
  headline: string;
  focusQuestions: readonly string[];
  context: CompetitiveLandscapeContext;
  /** Signal-budget capped competitor understandings */
  competitors: CompetitorUnderstanding[];
  /** Full count before budget filter */
  totalCompetitorsIdentified: number;
  landscapeShifts: CompetitorChangeSignal[];
  /** Single primary recommended action */
  primaryAction: CompetitorBdDecision | null;
  nextBestDecisions: CompetitorBdDecision[];
  potentialMissingCompetitors: PotentialMissingCompetitor[];
  metrics: {
    competitorCount: number;
    criticalThreats: number;
    activeMarkets: number;
    recentChanges: number;
  };
};

export function competitiveIntelligenceHref(companyId: string): string {
  return `/growth/competitors/${companyId}`;
}

export function competitiveLandscapeHref(): string {
  return "/growth/competitors";
}
