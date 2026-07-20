/**
 * Commercial Intelligence — adapter over Commercial Viability module.
 */
import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import {
  buildPortfolioCommercialViability,
  computeCommercialViability,
  rankCommercialViability,
} from "@/lib/commercial-viability-engine";
import type {
  CommercialIntelligenceAssessment,
  CommercialIntelligenceBrief,
  CommercialIntelligenceDimension,
  CommercialIntelligenceDimensionId,
  CommercialStrategicAnswers,
  PursuitRecommendation,
} from "@/types/commercial-intelligence";
import type {
  CommercialViabilityAssessment,
  CommercialViabilityDimensionId,
  ViabilityRecommendation,
} from "@/types/commercial-viability";

const DIMENSION_MAP: Record<CommercialViabilityDimensionId, CommercialIntelligenceDimensionId | null> =
  {
    buying_drivers: "buying_drivers",
    business_case_strength: "business_case_strength",
    financial_readiness: "financial_readiness",
    feedstock_readiness: null,
    project_readiness: "project_readiness",
    offtake_readiness: null,
    delivery_readiness: "delivery_readiness",
    decision_readiness: null,
    competitive_position: null,
    commercial_momentum: null,
    strategic_value: "strategic_fit",
    resource_efficiency: "resource_consumption",
    revenue_path: null,
  };

const PURSUIT_MAP: Record<ViabilityRecommendation, PursuitRecommendation> = {
  pursue: "pursue",
  qualify: "qualify",
  deprioritize: "deprioritize",
  walk_away: "walk_away",
};

function toIntelligenceAssessment(
  viability: CommercialViabilityAssessment,
): CommercialIntelligenceAssessment {
  const dimensions: CommercialIntelligenceDimension[] = viability.dimensions
    .map((dim) => {
      const mappedId = DIMENSION_MAP[dim.id];
      if (!mappedId) return null;
      return {
        id: mappedId,
        label: dim.label,
        score: dim.score,
        status: dim.status,
        summary: dim.summary,
        impact: dim.impact,
      };
    })
    .filter((dim): dim is CommercialIntelligenceDimension => dim !== null);

  const q = viability.coreQuestions;
  const strategicAnswers: CommercialStrategicAnswers = {
    whyWillTheyBuy: q.whyWillTheyBuy,
    canTheyBuy: q.canTheyBuy,
    canTheyImplement: q.canProjectBeBuilt,
    canWeDeliver: q.canWeDeliver,
    shouldWePursue: q.shouldInvestResources,
    whyGoodProject: viability.dimensions.find((d) => d.id === "business_case_strength")?.summary ?? "—",
    preventingSignedContract:
      viability.fatalFlawAlerts[0]?.detail ?? viability.risks[0]?.detail ?? "No critical blockers",
    whenWillTheyBuy: viability.estimatedPurchaseWindow,
    contractProbability: viability.contractProbabilityLabel + " estimated contract probability",
    recommendedNextAction: viability.nextActions[0]?.action ?? "Review opportunity",
  };

  const primary = viability.nextActions[0];

  return {
    dealId: viability.dealId,
    dealName: viability.dealName,
    companyId: viability.companyId,
    companyName: viability.companyName,
    salesValueLabel: viability.salesValueLabel,
    compositeScore: viability.viabilityScore,
    contractProbability: viability.contractProbability,
    contractProbabilityLabel: viability.contractProbabilityLabel,
    pursuitRecommendation: PURSUIT_MAP[viability.recommendation],
    pursuitLabel: viability.recommendationLabel,
    expectedBuyWindow: viability.estimatedPurchaseWindow,
    dimensions,
    strategicAnswers,
    blockers: [...viability.fatalFlaws, ...viability.risks].slice(0, 5),
    recommendedNextAction: primary
      ? {
          action: primary.action,
          reason: primary.reason,
          href: primary.href,
          priority: primary.priority,
        }
      : {
          action: "Review commercial viability",
          reason: q.shouldInvestResources,
          href: `/deals/${viability.dealId}`,
          priority: "Medium",
        },
  };
}

export function computeCommercialIntelligence(
  deal: PipelineRow,
  companies: Company[],
  activities: Activity[],
  pipelines: PipelineRow[],
  commercialPackages: CommercialPackage[],
): CommercialIntelligenceAssessment {
  return toIntelligenceAssessment(
    computeCommercialViability(deal, companies, activities, pipelines, commercialPackages),
  );
}

export function rankCommercialIntelligence(
  pipelines: PipelineRow[],
  companies: Company[],
  activities: Activity[],
  commercialPackages: CommercialPackage[],
): CommercialIntelligenceAssessment[] {
  return rankCommercialViability(pipelines, companies, activities, commercialPackages).map(
    toIntelligenceAssessment,
  );
}

export function toCommercialIntelligenceBrief(
  assessment: CommercialIntelligenceAssessment,
): CommercialIntelligenceBrief {
  return {
    dealId: assessment.dealId,
    dealName: assessment.dealName,
    companyName: assessment.companyName,
    contractProbability: assessment.contractProbability,
    contractProbabilityLabel: assessment.contractProbabilityLabel,
    pursuitRecommendation: assessment.pursuitRecommendation,
    pursuitLabel: assessment.pursuitLabel,
    headline: assessment.blockers[0]?.label ?? assessment.strategicAnswers.whyGoodProject,
    recommendedNextAction: assessment.recommendedNextAction.action,
    href: assessment.recommendedNextAction.href,
    compositeScore: assessment.compositeScore,
  };
}

export function buildPortfolioCommercialCoach(
  pipelines: PipelineRow[],
  companies: Company[],
  activities: Activity[],
  commercialPackages: CommercialPackage[],
  limit = 5,
): CommercialIntelligenceBrief[] {
  return buildPortfolioCommercialViability(
    pipelines,
    companies,
    activities,
    commercialPackages,
    limit,
  ).map((brief) => ({
    dealId: brief.dealId,
    dealName: brief.dealName,
    companyName: brief.companyName,
    contractProbability: brief.contractProbability,
    contractProbabilityLabel: brief.contractProbabilityLabel,
    pursuitRecommendation: PURSUIT_MAP[brief.recommendation],
    pursuitLabel: brief.recommendationLabel,
    headline: brief.headline,
    recommendedNextAction: brief.recommendedNextAction,
    href: brief.href,
    compositeScore: brief.viabilityScore,
  }));
}

export {
  computeCommercialViability,
  rankCommercialViability,
  buildPortfolioCommercialViability,
  toCommercialViabilityBrief,
} from "@/lib/commercial-viability-engine";
