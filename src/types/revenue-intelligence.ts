/**
 * Revenue Intelligence Engine — StandardBio
 * Forecast and prioritize revenue across machinery, services, and recurring streams.
 */

export const PRIMARY_REVENUE_CATEGORIES = [
  "Machinery Sales",
  "Equipment Sales",
  "Technology Packages",
] as const;

export const PROFESSIONAL_SERVICE_CATEGORIES = [
  "Project Bankability Assessment",
  "Feasibility Studies",
  "Engineering Services",
  "Commissioning",
  "Training",
  "Project Development",
] as const;

export const RECURRING_REVENUE_CATEGORIES = [
  "Service Agreements",
  "Support Contracts",
  "Spare Parts",
  "Upgrades",
] as const;

export type RevenueHorizon = "30d" | "90d" | "12m" | "36m";

export type ForecastBucket = "committed" | "likely" | "possible" | "strategic";

export const FORECAST_BUCKET_LABELS: Record<ForecastBucket, string> = {
  committed: "Committed Revenue",
  likely: "Likely Revenue",
  possible: "Possible Revenue",
  strategic: "Strategic Pipeline",
};

export type SalesPathStageId =
  | "relationship"
  | "consulting"
  | "engineering"
  | "proposal"
  | "machinery_contract";

export const SALES_PATH_STAGES: Array<{ id: SalesPathStageId; label: string }> = [
  { id: "relationship", label: "Relationship" },
  { id: "consulting", label: "Consulting" },
  { id: "engineering", label: "Engineering" },
  { id: "proposal", label: "Proposal" },
  { id: "machinery_contract", label: "Machinery Contract" },
];

export type SalesPathStage = {
  id: SalesPathStageId;
  label: string;
  status: "completed" | "current" | "future";
  probability: number;
};

export type ProjectEconomics = {
  estimatedProjectValue: number;
  estimatedServiceValue: number;
  expectedMachineryValue: number;
  expectedLifetimeValue: number;
  expectedPartnershipValue: number;
  currency: string;
};

export type OpportunityRevenueAssessment = {
  dealId: string;
  dealName: string;
  companyName: string | null;
  href: string;
  qualificationScore: number;
  qualificationTier: string;
  revenuePotential: number;
  professionalServicePotential: number;
  machineryPotential: number;
  partnershipValue: number;
  strategicValue: number;
  probabilityOfSuccess: number;
  expectedRevenueWindow: string;
  expectedSalesCycleMonths: number;
  salesPath: SalesPathStage[];
  economics: ProjectEconomics;
  forecastBucket: ForecastBucket;
  revenueAtRisk: boolean;
  fastestRevenue: boolean;
  primaryServiceCategory: string;
  currency: string;
};

export type HorizonForecast = {
  horizon: RevenueHorizon;
  horizonLabel: string;
  committed: number;
  likely: number;
  possible: number;
  strategic: number;
  total: number;
  totalLabel: string;
  currency: string;
};

export type MarketReturnSummary = {
  market: string;
  opportunityCount: number;
  totalPotential: number;
  averageProbability: number;
  totalPotentialLabel: string;
};

export type RevenueIntelligenceSnapshot = {
  generatedAt: string;
  currency: string;
  forecasts: HorizonForecast[];
  topRevenueOpportunities: OpportunityRevenueAssessment[];
  topConsultingOpportunities: OpportunityRevenueAssessment[];
  topMachineryOpportunities: OpportunityRevenueAssessment[];
  revenueAtRisk: OpportunityRevenueAssessment[];
  pipelineGrowthLabel: string;
  metrics: {
    totalPipelineValue: number;
    totalPipelineLabel: string;
    weightedForecastLabel: string;
    atRiskLabel: string;
    salesOpportunityCount: number;
    committedHorizon12mLabel: string;
  };
  marketReturns: MarketReturnSummary[];
  aiInsights: Array<{
    question: string;
    answer: string;
  }>;
};
