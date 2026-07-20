import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import { isQuotationKind } from "@/types/commercial-package";
import type { PipelineRow } from "@/types/pipeline";
import { getLifecycleStage } from "@/types/pipeline";
import type { CommercialViabilityDimension } from "@/types/commercial-viability";
import type {
  BusinessModel,
  BuyingDriverId,
  RevenuePathAssessment,
  RevenuePathId,
  RevenuePathStep,
} from "@/types/commercial-viability";
import {
  BUYING_DRIVER_LABELS,
  REVENUE_PATH_LABELS,
  REVENUE_PATH_LADDER,
} from "@/types/commercial-viability";

const BUSINESS_MODEL_LABELS: Record<BusinessModel, string> = {
  equipment_sale: "Direct Equipment Sale",
  project_development: "Project Development Services",
  hybrid: "Development → Equipment Path",
};

function hasActivityType(activities: Activity[], types: string[]): boolean {
  return activities.some((a) => types.includes(a.ActivityType));
}

export function inferBusinessModel(
  deal: PipelineRow,
  packages: CommercialPackage[],
): BusinessModel {
  if (deal.status === "Contract Negotiation") return "equipment_sale";
  if (packages.some((p) => p.kind === "formal_quotation")) return "hybrid";
  if (deal.status === "Prospecting" || deal.status === "Feedstock Analysis") {
    return "project_development";
  }
  return "hybrid";
}

function inferCompletedPaths(
  deal: PipelineRow,
  packages: CommercialPackage[],
  activities: Activity[],
): Set<RevenuePathId> {
  const completed = new Set<RevenuePathId>();

  if (deal.targetFeedstock && deal.targetFeedstock !== "—") {
    completed.add("feedstock_validation");
  }
  if (deal.status === "Feedstock Analysis" || deal.status === "Contract Negotiation") {
    completed.add("feedstock_validation");
  }
  if (hasActivityType(activities, ["Technical Review", "Commercial Review"])) {
    completed.add("fel1_assessment");
    completed.add("feasibility_study");
  }
  if (packages.some((p) => p.kind === "price_indication")) {
    completed.add("fel1_assessment");
  }
  if (packages.some((p) => p.kind === "budget_quotation")) {
    completed.add("business_case_development");
    completed.add("feasibility_study");
  }
  if (packages.some((p) => p.kind === "formal_quotation")) {
    completed.add("feed_package");
    completed.add("engineering_services");
  }
  if (deal.status === "Contract Negotiation") {
    completed.add("equipment_sale");
  }
  if (deal.status === "Won" || getLifecycleStage(deal.status) !== "sales") {
    completed.add("equipment_sale");
    completed.add("service_agreement");
  }

  return completed;
}

function recommendNextPath(
  deal: PipelineRow,
  completed: Set<RevenuePathId>,
  dimensions: CommercialViabilityDimension[],
): RevenuePathId {
  const byId = Object.fromEntries(dimensions.map((d) => [d.id, d])) as Record<
    string,
    CommercialViabilityDimension
  >;

  if (deal.status === "Contract Negotiation") return "equipment_sale";

  if (!completed.has("fel1_assessment") && deal.status === "Prospecting") {
    return "fel1_assessment";
  }
  if (
    !completed.has("feedstock_validation") ||
    (byId.feedstock_readiness?.score ?? 0) < 50
  ) {
    return "feedstock_validation";
  }
  if ((byId.project_readiness?.score ?? 0) < 55) {
    return "utility_assessment";
  }
  if ((byId.business_case_strength?.score ?? 0) < 55) {
    return "business_case_development";
  }
  if ((byId.offtake_readiness?.score ?? 0) < 50) {
    return "feasibility_study";
  }
  if (!completed.has("feed_package")) {
    return "feed_package";
  }
  if ((byId.financial_readiness?.score ?? 0) < 50) {
    return "business_case_development";
  }
  if (!completed.has("engineering_services")) {
    return "engineering_services";
  }
  return "equipment_sale";
}

function pathProbability(
  pathId: RevenuePathId,
  deal: PipelineRow,
  dimensions: CommercialViabilityDimension[],
): number {
  const avg =
    dimensions.reduce((sum, d) => sum + d.score, 0) / Math.max(dimensions.length, 1);
  const base: Record<RevenuePathId, number> = {
    fel1_assessment: 75,
    feedstock_validation: 70,
    utility_assessment: 65,
    feasibility_study: 60,
    business_case_development: 55,
    feed_package: 50,
    engineering_services: 45,
    equipment_sale: 40,
    service_agreement: 35,
    expansion_projects: 30,
  };
  let prob = base[pathId] ?? 50;
  if (deal.status === "Contract Negotiation" && pathId === "equipment_sale") prob = 72;
  if (deal.status === "Feedstock Analysis" && pathId === "feedstock_validation") prob = 78;
  prob = prob * 0.6 + avg * 0.4;
  return Math.round(Math.max(15, Math.min(92, prob)));
}

function computeFastestPathToRevenue(
  deal: PipelineRow,
  sequence: RevenuePathStep[],
  businessModel: BusinessModel,
  recommendedNext: RevenuePathId,
): string {
  if (deal.status === "Contract Negotiation") {
    return "Equipment Sale — contract negotiation in progress";
  }
  if (businessModel === "equipment_sale") {
    return "Equipment Sale — direct path to revenue";
  }

  const nearTerm = sequence.filter(
    (step) =>
      step.status !== "completed" &&
      step.id !== "expansion_projects" &&
      step.id !== "service_agreement",
  );
  const fastest = [...nearTerm].sort((a, b) => b.probability - a.probability)[0];
  if (fastest && fastest.id !== recommendedNext) {
    return `${fastest.label} (${fastest.probability}% — fastest near-term revenue)`;
  }
  return `${REVENUE_PATH_LABELS[recommendedNext]} — highest-probability next engagement`;
}

export function evaluateRevenuePath(
  deal: PipelineRow,
  packages: CommercialPackage[],
  activities: Activity[],
  dimensions: CommercialViabilityDimension[],
): RevenuePathAssessment {
  const businessModel = inferBusinessModel(deal, packages);
  const completed = inferCompletedPaths(deal, packages, activities);
  const recommendedNext = recommendNextPath(deal, completed, dimensions);
  const recommendedProbability = pathProbability(recommendedNext, deal, dimensions);

  const currentPath =
    [...REVENUE_PATH_LADDER].reverse().find((id) => completed.has(id)) ??
    (deal.status === "Prospecting" ? "fel1_assessment" : "feedstock_validation");

  const sequence: RevenuePathStep[] = REVENUE_PATH_LADDER.map((id) => {
    let status: RevenuePathStep["status"] = "future";
    if (completed.has(id)) status = "completed";
    else if (id === recommendedNext) status = "recommended";
    else if (id === currentPath && !completed.has(id)) status = "current";

    return {
      id,
      label: REVENUE_PATH_LABELS[id],
      status,
      probability: pathProbability(id, deal, dimensions),
      rationale:
        id === recommendedNext
          ? "Highest-probability next engagement for this opportunity"
          : completed.has(id)
            ? "Engagement completed or in progress"
            : "Future step on path to equipment contract",
    };
  });

  const whatToSellNext = REVENUE_PATH_LABELS[recommendedNext];
  const highestProbabilityPath = `${whatToSellNext} (${recommendedProbability}% path probability)`;
  const fastestPathToRevenue = computeFastestPathToRevenue(
    deal,
    sequence,
    businessModel,
    recommendedNext,
  );

  return {
    businessModel,
    businessModelLabel: BUSINESS_MODEL_LABELS[businessModel],
    currentPath,
    currentPathLabel: REVENUE_PATH_LABELS[currentPath],
    recommendedNext,
    recommendedNextLabel: whatToSellNext,
    recommendedProbability,
    fastestPathToRevenue,
    sequence,
    sequenceSummary: "Lead → Feedstock Assessment → Feasibility Study → FEED Package → Equipment Sale → Service Contract",
    whatToSellNext,
    highestProbabilityPath,
    ladderToEquipment:
      businessModel === "equipment_sale"
        ? "Direct path to equipment contract negotiation"
        : `Lead → ${whatToSellNext} → FEED Package → Equipment Sale → Service Contract`,
  };
}

export function scoreRevenuePathDimension(assessment: RevenuePathAssessment): {
  score: number;
  summary: string;
  impact: string[];
} {
  const completedCount = assessment.sequence.filter((s) => s.status === "completed").length;
  const progress = (completedCount / REVENUE_PATH_LADDER.length) * 100;
  const nextProb = assessment.recommendedProbability;

  let score = Math.round(progress * 0.4 + nextProb * 0.6);
  if (assessment.businessModel === "equipment_sale") score = Math.min(100, score + 15);

  return {
    score: Math.max(0, Math.min(100, score)),
    summary: `Revenue Path Recommendation: ${assessment.whatToSellNext} (${nextProb}% path probability)`,
    impact: [
      `Best revenue path: ${assessment.highestProbabilityPath}`,
      assessment.ladderToEquipment,
    ],
  };
}

export function detectBuyingDriversFromText(text: string): BuyingDriverId[] {
  const lower = text.toLowerCase();
  const found: BuyingDriverId[] = [];
  const rules: [BuyingDriverId, string[]][] = [
    ["cost_reduction", ["cost", "opex", "capex savings", "reduce cost"]],
    ["waste_reduction", ["waste", "landfill", "diversion", "recycl"]],
    ["sustainability_goals", ["sustainab", "esg", "green", "circular"]],
    ["carbon_reduction", ["carbon", "co2", "reduction", "removal", "credit", "offset"]],
    ["regulatory_compliance", ["regulat", "compliance", "permit", "mandate"]],
    ["revenue_generation", ["revenue", "income", "monetiz", "profit"]],
    ["energy_recovery", ["energy", "thermal", "heat", "recovery"]],
    ["strategic_growth", ["growth", "expansion", "strategic", "market"]],
  ];
  for (const [id, keywords] of rules) {
    if (keywords.some((kw) => lower.includes(kw))) found.push(id);
  }
  return found;
}

export function buildBuyingDriverSummary(
  drivers: BuyingDriverId[],
  deal: PipelineRow,
): { score: number; summary: string; drivers: BuyingDriverId[]; impact: string[] } {
  let score = 25;
  const unique = [...new Set(drivers)];

  if (unique.length >= 3) score += 35;
  else if (unique.length === 2) score += 22;
  else if (unique.length === 1) score += 12;

  if (deal.status === "Contract Negotiation") score += 20;
  if (deal.status === "Feedstock Analysis") score += 12;
  if (deal.companyRole === "Technology Buyer") score += 8;

  const labels = unique.map((d) => BUYING_DRIVER_LABELS[d]).join(", ");
  const summary =
    labels.length > 0
      ? `Drivers: ${labels}`
      : "Buying drivers not yet validated — confirm why they will buy";

  return {
    score: Math.min(100, score),
    summary,
    drivers: unique,
    impact: [
      unique.length > 0
        ? `Strong business driver: ${labels}`
        : "Without verified buying drivers, project development effort may not convert",
      "Why will they buy? — must be explicit before investing engineering resources",
    ],
  };
}

export function computeContractReadinessNorthStar(
  financialScore: number,
  decisionScore: number,
  revenuePathScore: number,
  packages: CommercialPackage[],
  deal: PipelineRow,
): number {
  let score = financialScore * 0.3 + decisionScore * 0.3 + revenuePathScore * 0.25;
  if (
    packages.some(
      (p) => p.kind === "commercial_baseline" && (p.status === "accepted" || p.status === "frozen"),
    )
  ) {
    score += 15;
  }
  if (deal.status === "Contract Negotiation") score += 20;
  if (packages.some((p) => isQuotationKind(p.kind) && p.status === "sent")) score += 8;
  return Math.round(Math.max(0, Math.min(100, score)));
}
