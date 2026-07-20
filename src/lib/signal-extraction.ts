import type { ConfidenceLevel } from "@/lib/opportunity-workspace-intelligence";
import type { InsightCategory } from "@/types/smartassist-intelligence";

/**
 * Signal Extraction Constitution — information budgets per surface.
 * Apply in engines, not only UI slice, so snapshots stay consistent.
 */
export const SIGNAL_BUDGETS = {
  competitors: 5,
  opportunities: 3,
  documents: 4,
  contacts: 2,
  activities: 5,
  decisions: 3,
  eventMeetings: 5,
  eventRecommendations: 5,
  landscapeShifts: 4,
  recommendedActions: 1,
  knowledgeKnown: 4,
  knowledgeAssumed: 3,
  missingCompetitors: 3,
} as const;

export type SignalSource =
  | "crm"
  | "seed"
  | "inferred"
  | "official_website"
  | "market_intelligence"
  | "event_program"
  | "activity_log";

export type SignalAssessment = {
  confidence: ConfidenceLevel;
  confidenceReason: string;
};

export function applySignalBudget<T>(items: T[], budget: number): T[] {
  return items.slice(0, budget);
}

export function sourceToInsightCategory(source: SignalSource): InsightCategory {
  if (source === "crm" || source === "activity_log") return "known";
  if (source === "official_website" || source === "market_intelligence") return "known";
  if (source === "seed" || source === "inferred" || source === "event_program") return "assumed";
  return "unknown";
}

export function discoverySourceToSignalSource(
  source: "crm" | "inferred" | "seed",
): SignalSource {
  if (source === "crm") return "crm";
  if (source === "seed") return "seed";
  return "inferred";
}

export function buildSignalConfidence(
  validatedDimensions: number,
  totalDimensions: number,
  strongOverlap: boolean,
): SignalAssessment {
  const ratio = validatedDimensions / Math.max(totalDimensions, 1);

  if (ratio >= 0.7 && strongOverlap) {
    return {
      confidence: "high",
      confidenceReason: "Multiple overlap dimensions validated from CRM or official sources.",
    };
  }
  if (ratio >= 0.45 || strongOverlap) {
    return {
      confidence: "medium",
      confidenceReason: "Strong market overlap detected. Limited validated product or service overlap.",
    };
  }
  return {
    confidence: "low",
    confidenceReason: "Overlap inferred from partial signals — requires validation before acting.",
  };
}

export function overflowLabel(shown: number, total: number): string | null {
  if (total <= shown) return null;
  return `${total - shown} more identified — filtered to signals that matter`;
}

export const SMARTASSIST_SIGNAL_QUESTIONS = [
  "What changed?",
  "What matters?",
  "What is the biggest threat?",
  "What is the biggest opportunity?",
  "What deserves attention?",
  "What should happen next?",
] as const;

export type CompetitorOverlapDimension =
  | "business"
  | "market"
  | "process"
  | "product"
  | "service"
  | "geographic"
  | "event";

export type CompetitorOverlapScores = Record<CompetitorOverlapDimension, number> & {
  overall: number;
  validatedCount: number;
};

export function scoreCompetitorOverlap(input: {
  hasCrmRecord: boolean;
  hasSeedProfile: boolean;
  threatLevel: "critical" | "high" | "medium" | "low";
  marketCount: number;
  geographyCount: number;
  eventCount: number;
  hasProductOverlap: boolean;
  hasServiceOverlap: boolean;
  hasPipelineOverlap: boolean;
}): CompetitorOverlapScores {
  const business = input.hasPipelineOverlap ? 90 : input.hasSeedProfile ? 75 : 40;
  const market = Math.min(95, 50 + input.marketCount * 15);
  const process = input.hasSeedProfile ? 80 : 45;
  const product = input.hasProductOverlap ? 85 : input.hasSeedProfile ? 60 : 30;
  const service = input.hasServiceOverlap ? 80 : 40;
  const geographic = Math.min(90, 40 + input.geographyCount * 20);
  const event = Math.min(90, 30 + input.eventCount * 25);

  const scores = { business, market, process, product, service, geographic, event };
  const overall = Math.round(
    Object.values(scores).reduce((sum, value) => sum + value, 0) / 7,
  );

  const validatedCount = [
    input.hasCrmRecord,
    input.hasSeedProfile && input.hasProductOverlap,
    input.hasPipelineOverlap,
    input.eventCount > 0,
    input.marketCount > 0,
  ].filter(Boolean).length;

  return { ...scores, overall, validatedCount };
}

export function dimensionLabel(dimension: CompetitorOverlapDimension): string {
  const labels: Record<CompetitorOverlapDimension, string> = {
    business: "Business competition",
    market: "Market competition",
    process: "Process competition",
    product: "Product competition",
    service: "Service competition",
    geographic: "Geographic relevance",
    event: "Event relevance",
  };
  return labels[dimension];
}
