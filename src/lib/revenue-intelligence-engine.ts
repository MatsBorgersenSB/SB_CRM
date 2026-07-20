import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import { isQuotationKind } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import { findCompanyForDeal } from "@/lib/opportunity-intelligence-engine";
import {
  computeOpportunityIntelligence,
  computePortfolioRevenueForecast,
} from "@/lib/opportunity-intelligence-engine";
import { computeOpportunityQualification } from "@/lib/opportunity-qualification-engine";
import { computeCommercialViability } from "@/lib/commercial-viability-engine";
import { daysBetween } from "@/lib/relative-time";
import type { PipelineRow } from "@/types/pipeline";
import { formatDealValue, getLifecycleStage } from "@/types/pipeline";
import { deal360Href } from "@/types/relationship-navigation";
import type {
  ForecastBucket,
  HorizonForecast,
  MarketReturnSummary,
  OpportunityRevenueAssessment,
  RevenueHorizon,
  RevenueIntelligenceSnapshot,
  SalesPathStage,
  SalesPathStageId,
} from "@/types/revenue-intelligence";
import { SALES_PATH_STAGES } from "@/types/revenue-intelligence";

const HORIZON_DAYS: Record<RevenueHorizon, number> = {
  "30d": 30,
  "90d": 90,
  "12m": 365,
  "36m": 1095,
};

const HORIZON_LABELS: Record<RevenueHorizon, string> = {
  "30d": "30-Day Revenue Forecast",
  "90d": "90-Day Revenue Forecast",
  "12m": "12-Month Revenue Forecast",
  "36m": "36-Month Revenue Forecast",
};

const STAGE_BASE_PROBABILITY: Record<SalesPathStageId, number> = {
  relationship: 85,
  consulting: 72,
  engineering: 58,
  proposal: 45,
  machinery_contract: 38,
};

function clamp(n: number, min = 0, max = 100): number {
  return Math.round(Math.max(min, Math.min(max, n)));
}

function resolveCurrentSalesStage(
  deal: PipelineRow,
  packages: CommercialPackage[],
): SalesPathStageId {
  if (deal.status === "Contract Negotiation" || deal.status === "Won") {
    return "machinery_contract";
  }
  if (packages.some((p) => isQuotationKind(p.kind))) {
    return "proposal";
  }
  if (
    packages.some((p) => p.kind === "commercial_baseline") ||
    deal.status === "Feedstock Analysis"
  ) {
    return "engineering";
  }
  if (packages.length > 0 || deal.status !== "Prospecting") {
    return "consulting";
  }
  return "relationship";
}

function buildSalesPath(
  deal: PipelineRow,
  packages: CommercialPackage[],
  successProbability: number,
): SalesPathStage[] {
  const current = resolveCurrentSalesStage(deal, packages);
  const currentIndex = SALES_PATH_STAGES.findIndex((s) => s.id === current);

  return SALES_PATH_STAGES.map((stage, index) => {
    let status: SalesPathStage["status"] = "future";
    if (index < currentIndex) status = "completed";
    else if (index === currentIndex) status = "current";

    const stageDecay = (SALES_PATH_STAGES.length - index) * 8;
    const probability = clamp(
      STAGE_BASE_PROBABILITY[stage.id] * 0.5 +
        successProbability * 0.5 -
        stageDecay,
      12,
      92,
    );

    return { id: stage.id, label: stage.label, status, probability };
  });
}

function estimateEconomics(
  deal: PipelineRow,
  stage: SalesPathStageId,
  qualificationScore: number,
): OpportunityRevenueAssessment["economics"] {
  const projectValue = deal.salesValue || 0;
  const machineryShare =
    stage === "machinery_contract" || stage === "proposal" ? 0.72 : 0.65;
  const serviceShare =
    stage === "relationship" ? 0.25 : stage === "consulting" ? 0.22 : 0.15;
  const recurringShare = 0.08;

  const expectedMachineryValue = Math.round(projectValue * machineryShare);
  const estimatedServiceValue = Math.round(
    projectValue * serviceShare * (qualificationScore / 100),
  );
  const expectedLifetimeValue = Math.round(
    projectValue + projectValue * recurringShare * 5,
  );
  const expectedPartnershipValue = Math.round(
    projectValue * 0.05 * (qualificationScore / 100),
  );

  return {
    estimatedProjectValue: projectValue,
    estimatedServiceValue,
    expectedMachineryValue,
    expectedLifetimeValue,
    expectedPartnershipValue,
    currency: deal.currency ?? "EUR",
  };
}

function expectedSalesCycleMonths(deal: PipelineRow, stage: SalesPathStageId): number {
  if (deal.status === "Contract Negotiation") return 2;
  const base: Record<SalesPathStageId, number> = {
    relationship: 14,
    consulting: 10,
    engineering: 7,
    proposal: 4,
    machinery_contract: 2,
  };
  return base[stage];
}

function expectedRevenueWindow(deal: PipelineRow, cycleMonths: number): string {
  if (deal.expectedCloseDate) {
    const d = new Date(deal.expectedCloseDate);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
    }
  }
  const future = new Date();
  future.setMonth(future.getMonth() + cycleMonths);
  return future.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function assignForecastBucket(
  deal: PipelineRow,
  tier: string,
  probability: number,
  lifecycle: ReturnType<typeof getLifecycleStage>,
): ForecastBucket {
  if (
    lifecycle !== "sales" ||
    deal.status === "Won" ||
    deal.status === "Contract Negotiation"
  ) {
    return "committed";
  }
  if (tier === "A" && probability >= 55) return "likely";
  if (tier === "B" && probability >= 35) return "likely";
  if (tier === "B" || tier === "C") return "possible";
  if (tier === "D") return "strategic";
  return "possible";
}

function primaryServiceCategory(stage: SalesPathStageId): string {
  switch (stage) {
    case "relationship":
      return "Project Bankability Assessment";
    case "consulting":
      return "Feasibility Studies";
    case "engineering":
      return "Engineering Services";
    case "proposal":
      return "Project Development";
    default:
      return "Commissioning";
  }
}

function assessOpportunityRevenue(
  deal: PipelineRow,
  companies: Company[],
  activities: Activity[],
  pipelines: PipelineRow[],
  commercialPackages: CommercialPackage[],
): OpportunityRevenueAssessment {
  const company = findCompanyForDeal(deal.id, companies);
  const packages = commercialPackages.filter((p) => p.DealId === deal.id);
  const qualification = computeOpportunityQualification(
    deal,
    companies,
    activities,
    pipelines,
    commercialPackages,
  );
  const intel = computeOpportunityIntelligence(deal, companies, activities, pipelines);
  const assessment = computeCommercialViability(
    deal,
    companies,
    activities,
    pipelines,
    commercialPackages,
  );

  const successProbability = clamp(
    qualification.qualificationScore * 0.45 +
      deal.probability * 0.35 +
      intel.winProbability * 0.2,
  );

  const stage = resolveCurrentSalesStage(deal, packages);
  const economics = estimateEconomics(deal, stage, qualification.qualificationScore);
  const lifecycle = getLifecycleStage(deal.status);
  const forecastBucket = assignForecastBucket(
    deal,
    qualification.tier,
    successProbability,
    lifecycle,
  );

  const strategicValue = clamp(
    (assessment.dimensions.find((d) => d.id === "strategic_value")?.score ?? 40) *
      (deal.salesValue / 1_000_000) *
      10,
    0,
    100,
  );

  const cycleMonths = expectedSalesCycleMonths(deal, stage);
  const daysToClose = deal.expectedCloseDate
    ? daysBetween(new Date().toISOString(), new Date(deal.expectedCloseDate))
    : cycleMonths * 30;

  return {
    dealId: deal.id,
    dealName: deal.assetName ?? deal.id,
    companyName: company?.Title ?? null,
    href: deal360Href(deal.id),
    qualificationScore: qualification.qualificationScore,
    qualificationTier: qualification.tier,
    revenuePotential: economics.expectedLifetimeValue,
    professionalServicePotential: economics.estimatedServiceValue,
    machineryPotential: economics.expectedMachineryValue,
    partnershipValue: economics.expectedPartnershipValue,
    strategicValue,
    probabilityOfSuccess: successProbability,
    expectedRevenueWindow: expectedRevenueWindow(deal, cycleMonths),
    expectedSalesCycleMonths: cycleMonths,
    salesPath: buildSalesPath(deal, packages, successProbability),
    economics,
    forecastBucket,
    revenueAtRisk: intel.isAtRiskRevenue || intel.momentum === "Stalled",
    fastestRevenue:
      daysToClose <= 90 &&
      (stage === "consulting" || stage === "engineering") &&
      qualification.tier !== "D",
    primaryServiceCategory: primaryServiceCategory(stage),
    currency: deal.currency ?? "EUR",
  };
}

function weightedValueForHorizon(
  opp: OpportunityRevenueAssessment,
  horizonDays: number,
): { value: number; bucket: ForecastBucket } | null {
  const cycleDays = opp.expectedSalesCycleMonths * 30;
  const withinHorizon = cycleDays <= horizonDays || horizonDays >= 365;

  if (!withinHorizon && horizonDays < 365) return null;

  const base =
    opp.forecastBucket === "committed"
      ? opp.machineryPotential
      : opp.forecastBucket === "likely"
        ? opp.machineryPotential * 0.85 + opp.professionalServicePotential * 0.15
        : opp.forecastBucket === "possible"
          ? opp.machineryPotential * 0.6 + opp.professionalServicePotential * 0.4
          : opp.machineryPotential * 0.35;

  return {
    value: base * (opp.probabilityOfSuccess / 100),
    bucket: opp.forecastBucket,
  };
}

function buildHorizonForecast(
  opportunities: OpportunityRevenueAssessment[],
  horizon: RevenueHorizon,
  currency: string,
): HorizonForecast {
  const horizonDays = HORIZON_DAYS[horizon];
  const totals = { committed: 0, likely: 0, possible: 0, strategic: 0 };

  for (const opp of opportunities) {
    const weighted = weightedValueForHorizon(opp, horizonDays);
    if (!weighted) continue;
    totals[weighted.bucket] += weighted.value;
  }

  const total =
    totals.committed + totals.likely + totals.possible + totals.strategic;

  return {
    horizon,
    horizonLabel: HORIZON_LABELS[horizon],
    committed: Math.round(totals.committed),
    likely: Math.round(totals.likely),
    possible: Math.round(totals.possible),
    strategic: Math.round(totals.strategic),
    total: Math.round(total),
    totalLabel: formatDealValue(currency as PipelineRow["currency"], Math.round(total)),
    currency,
  };
}

function buildMarketReturns(
  opportunities: OpportunityRevenueAssessment[],
  companies: Company[],
  pipelines: PipelineRow[],
  currency: string,
): MarketReturnSummary[] {
  const byMarket = new Map<string, { count: number; potential: number; probSum: number }>();

  for (const opp of opportunities) {
    const deal = pipelines.find((p) => p.id === opp.dealId);
    const company = deal ? findCompanyForDeal(deal.id, companies) : undefined;
    const market = company?.Country?.Title ?? company?.Industry ?? "Unassigned";
    const entry = byMarket.get(market) ?? { count: 0, potential: 0, probSum: 0 };
    entry.count += 1;
    entry.potential += opp.revenuePotential * (opp.probabilityOfSuccess / 100);
    entry.probSum += opp.probabilityOfSuccess;
    byMarket.set(market, entry);
  }

  return [...byMarket.entries()]
    .map(([market, data]) => ({
      market,
      opportunityCount: data.count,
      totalPotential: Math.round(data.potential),
      averageProbability: Math.round(data.probSum / data.count),
      totalPotentialLabel: formatDealValue(
        currency as PipelineRow["currency"],
        Math.round(data.potential),
      ),
    }))
    .sort((a, b) => b.totalPotential - a.totalPotential)
    .slice(0, 6);
}

function buildAiInsights(
  opportunities: OpportunityRevenueAssessment[],
  markets: MarketReturnSummary[],
  atRisk: OpportunityRevenueAssessment[],
): RevenueIntelligenceSnapshot["aiInsights"] {
  const fastest = [...opportunities]
    .filter((o) => o.fastestRevenue)
    .sort((a, b) => a.expectedSalesCycleMonths - b.expectedSalesCycleMonths)[0];
  const highest = [...opportunities].sort(
    (a, b) => b.revenuePotential - a.revenuePotential,
  )[0];
  const topConsulting = [...opportunities].sort(
    (a, b) => b.professionalServicePotential - a.professionalServicePotential,
  )[0];
  const topMarket = markets[0];
  const accelerate = opportunities.find(
    (o) => o.qualificationTier === "A" && o.forecastBucket !== "committed",
  );

  return [
    {
      question: "Which opportunities can generate revenue fastest?",
      answer: fastest
        ? `${fastest.dealName} — ${fastest.primaryServiceCategory} path, ${fastest.expectedSalesCycleMonths} month cycle (${fastest.probabilityOfSuccess}% success probability).`
        : "No near-term consulting paths identified — focus on Tier A opportunities with paid assessments.",
    },
    {
      question: "Which opportunities have the highest expected value?",
      answer: highest
        ? `${highest.dealName} — ${formatDealValue(highest.currency as PipelineRow["currency"], highest.revenuePotential)} lifetime potential at ${highest.probabilityOfSuccess}% probability.`
        : "Pipeline value is concentrated in delivery-stage projects.",
    },
    {
      question: "Which markets are generating the best returns?",
      answer: topMarket
        ? `${topMarket.market} — ${topMarket.totalPotentialLabel} weighted potential across ${topMarket.opportunityCount} opportunities.`
        : "Insufficient market data — link opportunities to companies with geography.",
    },
    {
      question: "Which activities create the highest commercial impact?",
      answer:
        "Paid Project Bankability Assessments and engineering proposals convert highest to machinery revenue — avoid unpaid feasibility scope.",
    },
    {
      question: "Which customers should receive more attention?",
      answer: atRisk.length > 0
        ? `${atRisk[0]!.companyName ?? atRisk[0]!.dealName} — ${formatDealValue(atRisk[0]!.currency as PipelineRow["currency"], atRisk[0]!.machineryPotential)} at risk due to stalled momentum.`
        : "No critical revenue-at-risk accounts — maintain Tier A acceleration.",
    },
    {
      question: "Which opportunities should be accelerated?",
      answer: accelerate
        ? `${accelerate.dealName} (Tier ${accelerate.qualificationTier}) — advance to ${accelerate.salesPath.find((s) => s.status === "current")?.label ?? "proposal"} stage.`
        : topConsulting
          ? `Advance ${topConsulting.dealName} from consulting to engineering proposal.`
          : "Qualify early-stage pipeline before acceleration.",
    },
  ];
}

export function buildRevenueIntelligence(
  pipelines: PipelineRow[],
  companies: Company[],
  activities: Activity[],
  commercialPackages: CommercialPackage[],
): RevenueIntelligenceSnapshot {
  const active = pipelines.filter((p) => p.status !== "Scheduled Maintenance");
  const currency = active.find((p) => p.currency)?.currency ?? "EUR";

  const assessments = active.map((deal) =>
    assessOpportunityRevenue(deal, companies, activities, pipelines, commercialPackages),
  );

  const salesAssessments = assessments.filter((a) => {
    const deal = pipelines.find((p) => p.id === a.dealId);
    return deal && getLifecycleStage(deal.status) === "sales";
  });

  const intelligences = active.map((deal) =>
    computeOpportunityIntelligence(deal, companies, activities, pipelines),
  );
  const portfolioForecast = computePortfolioRevenueForecast(intelligences, currency);

  const forecasts: HorizonForecast[] = (
    ["30d", "90d", "12m", "36m"] as RevenueHorizon[]
  ).map((h) => buildHorizonForecast(assessments, h, currency));

  const topRevenue = [...assessments]
    .sort(
      (a, b) =>
        b.revenuePotential * (b.probabilityOfSuccess / 100) -
        a.revenuePotential * (a.probabilityOfSuccess / 100),
    )
    .slice(0, 6);

  const topConsulting = [...assessments]
    .sort((a, b) => b.professionalServicePotential - a.professionalServicePotential)
    .slice(0, 5);

  const topMachinery = [...assessments]
    .sort((a, b) => b.machineryPotential - a.machineryPotential)
    .slice(0, 5);

  const atRisk = assessments.filter((a) => a.revenueAtRisk).slice(0, 5);
  const markets = buildMarketReturns(assessments, companies, pipelines, currency);

  const forecast12 = forecasts.find((f) => f.horizon === "12m")!;
  const growthPct =
    salesAssessments.length > 0
      ? Math.round(
          ((forecast12.likely + forecast12.possible) /
            Math.max(portfolioForecast.pipelineValue, 1)) *
            100,
        )
      : 0;

  return {
    generatedAt: new Date().toISOString(),
    currency,
    forecasts,
    topRevenueOpportunities: topRevenue,
    topConsultingOpportunities: topConsulting,
    topMachineryOpportunities: topMachinery,
    revenueAtRisk: atRisk,
    pipelineGrowthLabel:
      growthPct > 0
        ? `+${growthPct}% weighted pipeline growth potential (12-month horizon)`
        : "Pipeline weighted toward committed delivery revenue",
    metrics: {
      totalPipelineValue: portfolioForecast.pipelineValue,
      totalPipelineLabel: portfolioForecast.pipelineValueLabel,
      weightedForecastLabel: portfolioForecast.weightedForecastLabel,
      atRiskLabel: portfolioForecast.atRiskRevenueLabel,
      salesOpportunityCount: salesAssessments.length,
      committedHorizon12mLabel: forecast12.totalLabel,
    },
    marketReturns: markets,
    aiInsights: buildAiInsights(assessments, markets, atRisk),
  };
}

export function assessDealRevenue(
  deal: PipelineRow,
  companies: Company[],
  activities: Activity[],
  pipelines: PipelineRow[],
  commercialPackages: CommercialPackage[],
): OpportunityRevenueAssessment {
  return assessOpportunityRevenue(
    deal,
    companies,
    activities,
    pipelines,
    commercialPackages,
  );
}
