import type { ImpactSignal } from "@/types/impact";

export type BuyingDriverId =
  | "cost_reduction"
  | "waste_reduction"
  | "sustainability_goals"
  | "carbon_reduction"
  | "regulatory_compliance"
  | "revenue_generation"
  | "energy_recovery"
  | "strategic_growth";

export const BUYING_DRIVER_LABELS: Record<BuyingDriverId, string> = {
  cost_reduction: "Cost Reduction",
  waste_reduction: "Waste Reduction",
  sustainability_goals: "Sustainability",
  carbon_reduction: "Carbon Reduction",
  regulatory_compliance: "Compliance",
  revenue_generation: "Revenue Generation",
  energy_recovery: "Energy Recovery",
  strategic_growth: "Strategic Growth",
};

export type RevenuePathId =
  | "fel1_assessment"
  | "feedstock_validation"
  | "utility_assessment"
  | "feasibility_study"
  | "business_case_development"
  | "feed_package"
  | "engineering_services"
  | "equipment_sale"
  | "service_agreement"
  | "expansion_projects";

export const REVENUE_PATH_LABELS: Record<RevenuePathId, string> = {
  fel1_assessment: "FEL-1 Assessment",
  feedstock_validation: "Feedstock Validation",
  utility_assessment: "Utility Assessment",
  feasibility_study: "Feasibility Study",
  business_case_development: "Business Case Development",
  feed_package: "FEED Package",
  engineering_services: "Engineering Services",
  equipment_sale: "Equipment Contract",
  service_agreement: "Service Agreement",
  expansion_projects: "Expansion Project",
};

export const REVENUE_PATH_LADDER: RevenuePathId[] = [
  "fel1_assessment",
  "feedstock_validation",
  "utility_assessment",
  "feasibility_study",
  "business_case_development",
  "feed_package",
  "engineering_services",
  "equipment_sale",
  "service_agreement",
  "expansion_projects",
];

export type BusinessModel = "equipment_sale" | "project_development" | "hybrid";

export type RevenuePathStep = {
  id: RevenuePathId;
  label: string;
  status: "completed" | "current" | "recommended" | "future";
  probability: number;
  rationale: string;
};

export type RevenuePathAssessment = {
  businessModel: BusinessModel;
  businessModelLabel: string;
  currentPath: RevenuePathId;
  currentPathLabel: string;
  recommendedNext: RevenuePathId;
  recommendedNextLabel: string;
  recommendedProbability: number;
  fastestPathToRevenue: string;
  sequence: RevenuePathStep[];
  sequenceSummary: string;
  whatToSellNext: string;
  highestProbabilityPath: string;
  ladderToEquipment: string;
};

export type CommercialViabilityDimensionId =
  | "buying_drivers"
  | "business_case_strength"
  | "financial_readiness"
  | "feedstock_readiness"
  | "project_readiness"
  | "offtake_readiness"
  | "delivery_readiness"
  | "decision_readiness"
  | "competitive_position"
  | "commercial_momentum"
  | "strategic_value"
  | "resource_efficiency"
  | "revenue_path";

export type ViabilityStatus = "strong" | "moderate" | "weak" | "critical";

export type ViabilityRecommendation = "pursue" | "qualify" | "deprioritize" | "walk_away";

export type CommercialViabilityDimension = {
  id: CommercialViabilityDimensionId;
  label: string;
  purpose: string;
  scoreLabel: string;
  score: number;
  status: ViabilityStatus;
  summary: string;
  impact: string[];
  criteria: string[];
  questions: string[];
};

export type CommercialViabilityAction = {
  action: string;
  reason: string;
  href: string;
  priority: "High" | "Medium" | "Low";
};

export type ProjectMaturityStage =
  | "fel1"
  | "fel2"
  | "fel3"
  | "proposal_ready"
  | "contract_ready";

export type ProjectMaturityStageScore = {
  id: ProjectMaturityStage;
  label: string;
  percentage: number;
};

export type ProjectMaturityAssessment = {
  stages: ProjectMaturityStageScore[];
  currentStage: ProjectMaturityStage;
  currentStageLabel: string;
  summary: string;
  question: string;
};

export type ContractReadinessContributor = {
  dimensionId: CommercialViabilityDimensionId;
  label: string;
  score: number;
  weight: number;
};

export type ContractReadinessAssessment = {
  percent: number;
  label: string;
  question: string;
  builtFrom: ContractReadinessContributor[];
  summary: string;
};

export type FatalFlawId =
  | "no_site"
  | "no_feedstock"
  | "no_financing"
  | "no_offtake"
  | "no_sponsor"
  | "no_decision_maker"
  | "technology_mismatch"
  | "utility_constraints"
  | "unrealistic_permitting"
  | "no_engagement"
  | "commercial_stall";

export type FatalFlawSeverity = "critical" | "high" | "medium";

export type FatalFlawAlert = {
  id: FatalFlawId;
  label: string;
  detail: string;
  severity: FatalFlawSeverity;
  impact: string[];
  recommendedAction: string;
  href: string;
};

export type CommercialViabilityCoreQuestions = {
  shouldInvestResources: string;
  whyAttractive: string;
  whyWillTheyBuy: string;
  canTheyBuy: string;
  canTheyImplement: string;
  canWeDeliver: string;
  isWorthOurResources: string;
  preventingSignedContract: string;
  whatToSellNext: string;
  bestRevenuePath: string;
  fastestPathToRevenue: string;
  /** Legacy aliases */
  isBestUseOfTime: string;
  canProjectOperate: string;
  canProjectBeBuilt: string;
  canOutputsBeSold: string;
  canCustomerDecide: string;
  isDealProgressing: string;
  shouldWeWantThis: string;
  isBestUseOfResources: string;
};

export type CommercialViabilityAssessment = {
  moduleVersion: string;
  moduleName: string;
  engineLabel: string;
  northStar: readonly string[];
  dealId: string;
  dealName: string;
  companyId: string | null;
  companyName: string | null;
  salesValueLabel: string;
  businessModel: BusinessModel;
  businessModelLabel: string;
  /** Composite commercial viability score */
  viabilityScore: number;
  contractProbability: number;
  contractProbabilityLabel: string;
  recommendation: ViabilityRecommendation;
  recommendationLabel: string;
  estimatedPurchaseWindow: string;
  projectMaturity: ProjectMaturityAssessment;
  contractReadiness: ContractReadinessAssessment;
  /** @deprecated Use contractReadiness.percent */
  estimatedContractReadiness: number;
  estimatedContractReadinessLabel: string;
  detectedBuyingDrivers: BuyingDriverId[];
  dimensions: CommercialViabilityDimension[];
  revenuePath: RevenuePathAssessment;
  coreQuestions: CommercialViabilityCoreQuestions;
  risks: ImpactSignal[];
  fatalFlawAlerts: FatalFlawAlert[];
  /** Derived from fatalFlawAlerts for backward compatibility */
  fatalFlaws: ImpactSignal[];
  nextActions: CommercialViabilityAction[];
};

export type CommercialViabilityBrief = {
  dealId: string;
  dealName: string;
  companyName: string | null;
  viabilityScore: number;
  contractProbability: number;
  contractProbabilityLabel: string;
  recommendation: ViabilityRecommendation;
  recommendationLabel: string;
  estimatedPurchaseWindow: string;
  estimatedContractReadinessLabel: string;
  projectMaturitySummary: string;
  revenuePathNext: string;
  businessModelLabel: string;
  headline: string;
  recommendedNextAction: string;
  href: string;
  hasFatalFlaws: boolean;
};

export const COMMERCIAL_VIABILITY_DIMENSION_LABELS: Record<
  CommercialViabilityDimensionId,
  string
> = {
  buying_drivers: "Buying Drivers",
  business_case_strength: "Business Case Strength",
  financial_readiness: "Financial Readiness",
  feedstock_readiness: "Feedstock Readiness",
  project_readiness: "Project Readiness",
  offtake_readiness: "Offtake Readiness",
  delivery_readiness: "Delivery Readiness",
  decision_readiness: "Decision Readiness",
  competitive_position: "Competitive Position",
  commercial_momentum: "Commercial Momentum",
  strategic_value: "Strategic Value",
  resource_efficiency: "Resource Efficiency",
  revenue_path: "Revenue Path",
};

export const VIABILITY_RECOMMENDATION_LABELS: Record<ViabilityRecommendation, string> = {
  pursue: "Pursue — invest resources toward signed contract",
  qualify: "Qualify — validate viability before additional investment",
  deprioritize: "Deprioritize — protect sales and engineering capacity",
  walk_away: "Walk away — effort exceeds likely return",
};
