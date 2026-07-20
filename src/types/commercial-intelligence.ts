import type { ImpactSignal } from "@/types/impact";

export type CommercialIntelligenceDimensionId =
  | "buying_drivers"
  | "financial_readiness"
  | "project_readiness"
  | "delivery_readiness"
  | "business_case_strength"
  | "strategic_fit"
  | "resource_consumption"
  | "contract_readiness";

export type CommercialIntelligenceStatus = "strong" | "moderate" | "weak" | "critical";

export type CommercialIntelligenceDimension = {
  id: CommercialIntelligenceDimensionId;
  label: string;
  score: number;
  status: CommercialIntelligenceStatus;
  summary: string;
  impact: string[];
};

export type PursuitRecommendation = "pursue" | "qualify" | "deprioritize" | "walk_away";

export type CommercialStrategicAnswers = {
  whyWillTheyBuy: string;
  canTheyBuy: string;
  canTheyImplement: string;
  canWeDeliver: string;
  shouldWePursue: string;
  whyGoodProject: string;
  preventingSignedContract: string;
  whenWillTheyBuy: string;
  contractProbability: string;
  recommendedNextAction: string;
};

export type CommercialIntelligenceAssessment = {
  dealId: string;
  dealName: string;
  companyId: string | null;
  companyName: string | null;
  salesValueLabel: string;
  compositeScore: number;
  contractProbability: number;
  contractProbabilityLabel: string;
  pursuitRecommendation: PursuitRecommendation;
  pursuitLabel: string;
  expectedBuyWindow: string;
  dimensions: CommercialIntelligenceDimension[];
  strategicAnswers: CommercialStrategicAnswers;
  blockers: ImpactSignal[];
  recommendedNextAction: {
    action: string;
    reason: string;
    href: string;
    priority: "High" | "Medium" | "Low";
  };
};

/** Compact coach card for SmartAssist popup lists */
export type CommercialIntelligenceBrief = {
  dealId: string;
  dealName: string;
  companyName: string | null;
  contractProbability: number;
  contractProbabilityLabel: string;
  pursuitRecommendation: PursuitRecommendation;
  pursuitLabel: string;
  headline: string;
  recommendedNextAction: string;
  href: string;
  compositeScore: number;
};

export const COMMERCIAL_DIMENSION_LABELS: Record<CommercialIntelligenceDimensionId, string> = {
  buying_drivers: "Buying Drivers",
  financial_readiness: "Financial Readiness",
  project_readiness: "Project Readiness",
  delivery_readiness: "Delivery Readiness",
  business_case_strength: "Business Case Strength",
  strategic_fit: "Strategic Fit",
  resource_consumption: "Resource Consumption",
  contract_readiness: "Contract Readiness",
};

export const PURSUIT_LABELS: Record<PursuitRecommendation, string> = {
  pursue: "Pursue — high contract probability",
  qualify: "Qualify — validate before investing more",
  deprioritize: "Deprioritize — protect scarce resources",
  walk_away: "Walk away — effort exceeds return",
};
