import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import { isQuotationKind } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import { normalizeCompanyTypes } from "@/lib/company-classification";
import { formatSectorRoiHint, normalizeCompanySectors } from "@/lib/company-sectors";
import {
  computeOpportunityIntelligence,
  findCompanyForDeal,
  type OpportunityMomentum,
} from "@/lib/opportunity-intelligence-engine";
import {
  computeContractReadiness,
  computeProjectMaturity,
  detectFatalFlawAlerts,
  fatalFlawsToImpactSignals,
} from "@/lib/cvm-advanced-engine";
import {
  CVM_DIMENSION_META,
  CVM_ENGINE_LABEL,
  CVM_MODULE_NAME,
  CVM_NORTH_STAR,
  CVM_VERSION,
} from "@/lib/cvm-config";
import { daysBetween } from "@/lib/relative-time";
import { getActivitiesForDeal, isFollowUpOverdue, isFollowUpOpen } from "@/lib/activity-utils";
import type { PipelineRow } from "@/types/pipeline";
import { formatDealValue, getLifecycleStage } from "@/types/pipeline";
import { deal360Href } from "@/types/relationship-navigation";
import type {
  BuyingDriverId,
  CommercialViabilityAction,
  CommercialViabilityAssessment,
  CommercialViabilityBrief,
  CommercialViabilityCoreQuestions,
  CommercialViabilityDimension,
  CommercialViabilityDimensionId,
  ViabilityRecommendation,
  ViabilityStatus,
} from "@/types/commercial-viability";
import {
  BUYING_DRIVER_LABELS,
  COMMERCIAL_VIABILITY_DIMENSION_LABELS,
  VIABILITY_RECOMMENDATION_LABELS,
} from "@/types/commercial-viability";
import {
  buildBuyingDriverSummary,
  detectBuyingDriversFromText,
  evaluateRevenuePath,
  inferBusinessModel,
  scoreRevenuePathDimension,
} from "@/lib/revenue-path-engine";
import type { ImpactSignal } from "@/types/impact";

const DIMENSION_WEIGHTS: Record<CommercialViabilityDimensionId, number> = {
  buying_drivers: 0.08,
  business_case_strength: 0.09,
  financial_readiness: 0.09,
  feedstock_readiness: 0.08,
  project_readiness: 0.07,
  offtake_readiness: 0.07,
  delivery_readiness: 0.07,
  decision_readiness: 0.07,
  competitive_position: 0.06,
  commercial_momentum: 0.08,
  strategic_value: 0.07,
  resource_efficiency: 0.07,
  revenue_path: 0.1,
};

const SALES_STAGES: PipelineRow["status"][] = [
  "Prospecting",
  "Feedstock Analysis",
  "Contract Negotiation",
];

type Scored = { score: number; summary: string; impact: string[]; criteria?: string[] };

function clampScore(score: number): number {
  return Math.round(Math.max(0, Math.min(100, score)));
}

function statusFromScore(score: number): ViabilityStatus {
  if (score >= 75) return "strong";
  if (score >= 55) return "moderate";
  if (score >= 35) return "weak";
  return "critical";
}

function packagesForDeal(packages: CommercialPackage[], dealId: string): CommercialPackage[] {
  return packages.filter((pkg) => pkg.DealId === dealId);
}

function hasActivityType(activities: Activity[], types: string[]): boolean {
  return activities.some((a) => types.includes(a.ActivityType));
}

function collectActivityText(activities: Activity[]): string {
  return activities
    .map(
      (a) =>
        `${a.Subject} ${a.ActivityDescription ?? ""} ${a.Summary ?? ""} ${(a.Risks ?? []).join(" ")} ${(a.KeyDecisions ?? []).join(" ")}`,
    )
    .join(" ");
}

function detectBuyingDrivers(
  deal: PipelineRow,
  dealActivities: Activity[],
): { scored: Scored; drivers: BuyingDriverId[] } {
  const fromText = detectBuyingDriversFromText(collectActivityText(dealActivities));
  const inferred: BuyingDriverId[] = [...fromText];

  if (deal.companyRole === "Technology Buyer") inferred.push("strategic_growth");
  if (deal.targetFeedstock) inferred.push("waste_reduction");
  if (deal.status === "Feedstock Analysis") inferred.push("sustainability_goals", "cost_reduction");

  const built = buildBuyingDriverSummary(inferred, deal);
  return {
    drivers: built.drivers,
    scored: {
      score: built.score,
      summary: built.summary,
      impact: built.impact,
      criteria: built.drivers.map((d) => BUYING_DRIVER_LABELS[d]),
    },
  };
}

function scoreBusinessCase(
  deal: PipelineRow,
  winProbability: number,
  packages: CommercialPackage[],
  company?: Company,
): Scored {
  let score = winProbability * 0.5;
  const criteria: string[] = [];
  const signals: string[] = [];

  if (deal.salesValue > 0) {
    criteria.push("CAPEX");
    signals.push(`Project CAPEX ~${formatDealValue(deal.currency, deal.salesValue)}`);
    score += 8;
  }
  if (packages.some((p) => p.kind === "commercial_baseline")) {
    criteria.push("ROI", "NPV");
    score += 15;
    signals.push("Commercial baseline supports ROI/NPV case");
  }
  if (packages.some((p) => p.kind === "budget_quotation" || p.kind === "formal_quotation")) {
    criteria.push("Payback");
    score += 10;
  }
  if (winProbability >= 45) criteria.push("IRR");

  const sectorHint = formatSectorRoiHint(company?.Sectors);
  if (sectorHint) {
    criteria.push("Sector ROI");
    signals.push(sectorHint);
    score += 4;
  }

  const sectorLabels = normalizeCompanySectors(company?.Sectors);
  const roiImpact =
    sectorLabels.length > 0
      ? `ROI must be argued in ${sectorLabels.join(" / ")} terms — ${sectorHint || "sector-specific economics"}`
      : "Does this project make economic sense? — ROI and payback must be explicit";

  return {
    score: clampScore(score),
    summary: signals[0] ?? "Business case not yet quantified — develop CAPEX/OPEX/ROI model",
    impact: [
      roiImpact,
      winProbability >= 40 ? "Economic case progressing" : "Build business case before engineering investment",
    ],
    criteria: criteria.length > 0 ? criteria : ["CAPEX", "OPEX", "ROI", "Payback", "NPV", "IRR"],
  };
}

function scoreFinancialReadiness(
  deal: PipelineRow,
  packages: CommercialPackage[],
  company: Company | undefined,
): Scored {
  let score = 40;
  const criteria: string[] = [];
  const signals: string[] = [];

  if (deal.probability >= 40) {
    criteria.push("Investment Committee");
    score += 15;
    signals.push(`Investment confidence ${deal.probability}%`);
  }
  const accepted = packages.find(
    (p) => isQuotationKind(p.kind) && (p.status === "accepted" || p.status === "frozen"),
  );
  const sent = packages.find((p) => isQuotationKind(p.kind) && p.status === "sent");
  if (accepted) {
    criteria.push("Board Approval");
    score += 25;
    signals.push("Commercial terms accepted — financing pathway open");
  } else if (sent) {
    criteria.push("Green Financing");
    score += 12;
    signals.push("Quotation sent — awaiting financial decision");
  }
  if (company?.Status === "Active") {
    criteria.push("Equity");
    score += 5;
  }
  if (deal.salesValue >= 1_000_000) criteria.push("Debt", "Investors");

  return {
    score: clampScore(score),
    summary: signals[0] ?? "Financing pathway not confirmed — validate equity, debt, grants",
    impact: [
      "Can they buy? — confirm budget holder and financing structure",
      accepted ? "Financial pathway open" : "Map equity, debt, grants, and board approval process",
    ],
    criteria: criteria.length > 0 ? criteria : ["Equity", "Debt", "Grants", "Green Financing", "Investors", "Board Approval"],
  };
}

function scoreFeedstockReadiness(deal: PipelineRow): Scored {
  let score = 30;
  const criteria: string[] = [];
  const signals: string[] = [];

  if (deal.targetFeedstock && deal.targetFeedstock !== "—") {
    criteria.push("Feedstock Type");
    score += 25;
    signals.push(`Feedstock: ${deal.targetFeedstock}`);
  } else {
    signals.push("Feedstock type not defined");
  }
  if (deal.reactorDesignCapacity > 0) {
    criteria.push("Annual Volume");
    score += 20;
    signals.push(`Design capacity ${deal.reactorDesignCapacity} t/day`);
  }
  if (deal.status === "Feedstock Analysis") {
    criteria.push("Quality", "Security of Supply");
    score += 20;
    signals.push("Feedstock analysis validates supply security");
  }
  if (deal.companyRole === "Feedstock Supplier") {
    criteria.push("Contract Status");
    score += 15;
    signals.push("Feedstock supplier role — supply pathway identified");
  }

  return {
    score: clampScore(score),
    summary: signals[0] ?? "Feedstock readiness incomplete",
    impact: [
      "Can the project sustain long-term operation? — feedstock security is foundational",
      deal.targetFeedstock ? "Feedstock pathway defined" : "Validate feedstock type, volume, and contract status",
    ],
    criteria: criteria.length > 0 ? criteria : ["Feedstock Type", "Annual Volume", "Quality", "Security of Supply"],
  };
}

function scoreProjectReadiness(deal: PipelineRow): Scored {
  let score = 35;
  const signals: string[] = [];

  if (deal.currentMilestone && deal.currentMilestone !== "—") {
    score += 15;
    signals.push(`Milestone: ${deal.currentMilestone}`);
  }
  if (deal.status === "Contract Negotiation") {
    score += 25;
    signals.push("Site and infrastructure validated — in commercial closure");
  }
  if (deal.FileLeafRef) {
    score += 10;
    signals.push("Technical/site documentation linked");
  }

  return {
    score: clampScore(score),
    summary: signals[0] ?? "Site, utilities, and permits not yet assessed",
    impact: [
      "Can the project actually be built? — site, power, water, logistics, permits",
      "Commission utility assessment before FEED investment",
    ],
    criteria: ["Site", "Utilities", "Power", "Water", "Infrastructure", "Logistics", "Permits"],
  };
}

function scoreOfftakeReadiness(deal: PipelineRow, company: Company | undefined): Scored {
  let score = 35;
  const signals: string[] = [];

  if (deal.companyRole === "Off-take Partner") {
    score += 25;
    signals.push("Off-take partner identified");
  }
  if (deal.companyRole === "Technology Buyer") {
    score += 10;
    signals.push("Technology buyer — may internalize offtake");
  }
  if (deal.status !== "Prospecting") {
    score += 15;
    signals.push("Project progressed beyond initial qualification");
  }

  return {
    score: clampScore(score),
    summary: signals[0] ?? "Offtake agreements and revenue security not validated",
    impact: [
      "Can outputs be sold? — biochar, carbon credits, thermal offtake",
      "Secure offtake or credit pathway before equipment commitment",
    ],
    criteria: ["Biochar Market", "Carbon Credits", "Thermal Offtake", "Offtake Agreements"],
  };
}

function scoreDeliveryReadiness(
  deal: PipelineRow,
  packages: CommercialPackage[],
): Scored {
  const lifecycle = getLifecycleStage(deal.status);
  let score = lifecycle === "production" ? 90 : lifecycle === "delivery" ? 75 : 35;
  const signals: string[] = [];

  if (lifecycle === "sales") {
    signals.push("Pre-contract — confirm Standard Bio delivery capacity");
    if (deal.team && deal.team.length > 0) {
      score += 15;
      signals.push(`${deal.team.length} team members assigned`);
    }
    if (packages.some((p) => p.kind === "execution")) score += 15;
  } else {
    signals.push(`Delivery phase: ${deal.status}`);
  }

  return {
    score: clampScore(score),
    summary: signals[0] ?? "Delivery capacity not confirmed",
    impact: [
      "Can Standard Bio successfully deliver? — technology fit, engineering, manufacturing",
      "Protect margin by confirming capacity before contract signature",
    ],
    criteria: ["Technology Fit", "Engineering Capacity", "Manufacturing", "Timeline", "References"],
  };
}

function scoreDecisionReadiness(
  deal: PipelineRow,
  dealActivities: Activity[],
  stakeholderCount: number,
  overdueCount: number,
): Scored {
  let score = 40;
  const signals: string[] = [];

  if (deal.status === "Contract Negotiation") {
    score += 25;
    signals.push("Contract negotiation — decision process active");
  }
  if (stakeholderCount >= 3) {
    score += 20;
    signals.push(`${stakeholderCount} stakeholders — economic buyer and champion likely engaged`);
  } else if (stakeholderCount <= 1) {
    score -= 15;
    signals.push("Single-threaded — map economic buyer and sponsor");
  }
  if (hasActivityType(dealActivities, ["Commercial Review"])) {
    score += 10;
    signals.push("Commercial review with decision makers");
  }
  if (overdueCount > 0) score -= overdueCount * 10;

  return {
    score: clampScore(score),
    summary: signals[0] ?? "Decision committee not mapped",
    impact: [
      "Can the customer make a purchasing decision? — sponsor, economic buyer, board",
      stakeholderCount <= 1 ? "Map procurement and investment committee process" : "Maintain multi-stakeholder alignment",
    ],
    criteria: ["Economic Buyer", "Sponsor", "Champion", "Board Approval", "Procurement", "Investment Committee"],
  };
}

function scoreCompetitivePosition(
  packages: CommercialPackage[],
  stakeholderCount: number,
  daysSince: number,
  activityCount: number,
): Scored {
  let score = 55;
  const signals: string[] = [];

  const sentQuote = packages.find((p) => isQuotationKind(p.kind) && p.status === "sent");
  const accepted = packages.find(
    (p) => isQuotationKind(p.kind) && (p.status === "accepted" || p.status === "frozen"),
  );
  if (accepted) {
    score += 25;
    signals.push("Quotation accepted — winning position");
  } else if (sentQuote?.sentAt && daysBetween(sentQuote.sentAt) > 21) {
    score -= 20;
    signals.push("Quotation aging — competitive displacement risk");
  }
  if (stakeholderCount <= 1 && activityCount > 2) {
    score -= 12;
    signals.push("Single-threaded — competitor bypass risk");
  }
  if (daysSince > 21) {
    score -= 12;
    signals.push("Silence creates competitive opening");
  }

  return {
    score: clampScore(score),
    summary: signals[0] ?? "Competitive position not assessed",
    impact: [
      "Why are we winning or losing? — defend differentiators and engagement breadth",
      score >= 60 ? "Competitive position supports closure" : "Strengthen win themes and stakeholder coverage",
    ],
    criteria: ["Competitors", "Win Themes", "Differentiators", "Strengths", "Weaknesses"],
  };
}

function scoreCommercialMomentum(
  momentum: OpportunityMomentum,
  recent30: number,
  daysSince: number,
): Scored {
  let score = 50;
  const signals: string[] = [];

  if (momentum === "Accelerating") {
    score = 90;
    signals.push("Deal progressing — momentum accelerating");
  } else if (momentum === "Stable") {
    score = 70;
    signals.push("Stable engagement cadence");
  } else if (momentum === "Slowing") {
    score = 45;
    signals.push("Momentum slowing — deal may be quietly dying");
  } else {
    score = 20;
    signals.push("Stalled — deal quietly dying without intervention");
  }
  if (recent30 >= 3) score = Math.min(100, score + 8);
  if (daysSince > 28) score = Math.max(10, score - 12);

  return {
    score: clampScore(score),
    summary: signals[0] ?? "Commercial momentum unknown",
    impact: [
      "Is the deal progressing or quietly dying?",
      momentum === "Stalled" ? "Re-engage immediately or deprioritize" : "Maintain meeting and proposal cadence",
    ],
    criteria: ["Recent Meetings", "Stakeholder Engagement", "Proposal Activity", "Communication Frequency"],
  };
}

function scoreStrategicValue(
  deal: PipelineRow,
  company: Company | undefined,
  relationshipScore: number,
): Scored {
  let score = 40;
  const signals: string[] = [];
  const types = company ? normalizeCompanyTypes(company) : [];

  if (types.includes("Customer")) {
    score += 20;
    signals.push("Strategic customer — reference and expansion potential");
  }
  if (deal.salesValue >= 2_000_000) {
    score += 12;
    signals.push("High-value reference project");
  }
  if (relationshipScore >= 70) score += 15;

  return {
    score: clampScore(score),
    summary: signals[0] ?? "Strategic value not yet established",
    impact: [
      "Should Standard Bio want this project? — reference, geography, long-term service revenue",
      types.includes("Customer") ? "Expansion and service revenue potential" : "Validate strategic fit",
    ],
    criteria: ["Reference Potential", "Geographic Expansion", "Strategic Customer", "Future Service Revenue"],
  };
}

function scoreResourceEfficiency(
  momentum: OpportunityMomentum,
  overdueCount: number,
  daysSince: number,
  activityCount: number,
  dealValue: number,
): Scored {
  let score = 70;
  const signals: string[] = [];

  if (momentum === "Stalled") {
    score -= 30;
    signals.push("Stalled — sales and engineering hours not converting");
  }
  if (overdueCount > 0) {
    score -= overdueCount * 12;
    signals.push("Overdue commitments drain management time");
  }
  if (daysSince > 21 && activityCount > 3) {
    score -= 15;
    signals.push("High activity without progress — poor resource efficiency");
  }
  if (dealValue < 300_000 && activityCount > 5) {
    score -= 10;
    signals.push("Disproportionate effort for deal size");
  }

  return {
    score: clampScore(score),
    summary: signals[0] ?? "Resource use acceptable for deal potential",
    impact: [
      "Is this the best use of scarce sales and engineering resources?",
      score < 50 ? "Deprioritize until efficiency improves" : "Resource investment aligned with progress",
    ],
    criteria: ["Sales Hours", "Engineering Hours", "Travel Cost", "Management Time", "Proposal Cost"],
  };
}

function buildDimension(id: CommercialViabilityDimensionId, scored: Scored): CommercialViabilityDimension {
  const meta = CVM_DIMENSION_META[id];
  return {
    id,
    label: COMMERCIAL_VIABILITY_DIMENSION_LABELS[id],
    purpose: meta.purpose,
    scoreLabel: meta.scoreLabel,
    score: scored.score,
    status: statusFromScore(scored.score),
    summary: scored.summary,
    impact: scored.impact,
    criteria: scored.criteria && scored.criteria.length > 0 ? scored.criteria : meta.criteria,
    questions: meta.questions,
  };
}

function buildCoreQuestions(
  dimensions: CommercialViabilityDimension[],
  revenuePath: ReturnType<typeof evaluateRevenuePath>,
  recommendation: ViabilityRecommendation,
  fatalFlawAlerts: ReturnType<typeof detectFatalFlawAlerts>,
  risks: ImpactSignal[],
): CommercialViabilityCoreQuestions {
  const byId = Object.fromEntries(dimensions.map((d) => [d.id, d])) as Record<
    string,
    CommercialViabilityDimension
  >;

  const investAnswer =
    recommendation === "pursue"
      ? "Yes — additional resources are justified toward a profitable signed contract"
      : recommendation === "qualify"
        ? "Qualify first — invest only in validation engagements until viability improves"
        : recommendation === "deprioritize"
          ? "Not now — protect resources for higher-probability opportunities"
          : "No — further investment is unlikely to produce a signed contract";

  const implementSignals = [
    byId.feedstock_readiness?.summary,
    byId.project_readiness?.summary,
    byId.offtake_readiness?.summary,
  ].filter(Boolean);

  const preventing =
    fatalFlawAlerts[0]?.detail ??
    fatalFlawAlerts[0]?.label ??
    risks[0]?.detail ??
    "No critical blockers identified — focus on revenue path progression";

  const whyAttractive = [
    byId.strategic_value?.summary,
    byId.buying_drivers?.summary,
    byId.business_case_strength?.summary,
  ]
    .filter(Boolean)
    .join(" · ");

  const worthResources = byId.resource_efficiency?.summary ?? "—";

  return {
    shouldInvestResources: investAnswer,
    whyAttractive: whyAttractive || "Strategic and economic attractiveness not yet validated",
    whyWillTheyBuy: byId.buying_drivers?.summary ?? "—",
    canTheyBuy: byId.financial_readiness?.summary ?? "—",
    canTheyImplement:
      implementSignals.length > 0
        ? implementSignals.join(" · ")
        : "Feedstock, site, and offtake readiness not yet validated",
    canWeDeliver: byId.delivery_readiness?.summary ?? "—",
    isWorthOurResources: worthResources,
    preventingSignedContract: preventing,
    whatToSellNext: revenuePath.whatToSellNext,
    bestRevenuePath: revenuePath.highestProbabilityPath,
    fastestPathToRevenue: revenuePath.fastestPathToRevenue,
    isBestUseOfTime: worthResources,
    canProjectOperate: byId.feedstock_readiness?.summary ?? "—",
    canProjectBeBuilt: byId.project_readiness?.summary ?? "—",
    canOutputsBeSold: byId.offtake_readiness?.summary ?? "—",
    canCustomerDecide: byId.decision_readiness?.summary ?? "—",
    isDealProgressing: byId.commercial_momentum?.summary ?? "—",
    shouldWeWantThis: byId.strategic_value?.summary ?? "—",
    isBestUseOfResources: worthResources,
  };
}

function buildRisks(
  dimensions: CommercialViabilityDimension[],
  intelRisks: { label: string; detail: string; severity: string }[],
): ImpactSignal[] {
  const risks: ImpactSignal[] = [];
  for (const dim of dimensions) {
    if ((dim.status === "weak" || dim.status === "critical") && dim.score >= 25) {
      risks.push({ label: dim.label, detail: dim.summary, impact: dim.impact });
    }
  }
  for (const risk of intelRisks.filter((r) => r.severity !== "info")) {
    risks.push({
      label: risk.label,
      detail: risk.detail,
      impact: ["Reduces contract probability and wastes pursuit effort"],
    });
  }
  return risks.slice(0, 6);
}

function buildNextActions(
  dealId: string,
  revenuePath: ReturnType<typeof evaluateRevenuePath>,
  intelAction: { action: string; reason: string; priority: "High" | "Medium" | "Low" },
  dimensions: CommercialViabilityDimension[],
  fatalFlawAlerts: ReturnType<typeof detectFatalFlawAlerts>,
): CommercialViabilityAction[] {
  const actions: CommercialViabilityAction[] = [];

  actions.push({
    action: `Propose ${revenuePath.whatToSellNext}`,
    reason: revenuePath.highestProbabilityPath,
    href: deal360Href(dealId, "commercial"),
    priority: "High",
  });

  actions.push({
    action: intelAction.action,
    reason: intelAction.reason,
    href: deal360Href(dealId, "intelligence"),
    priority: intelAction.priority,
  });

  const weakest = [...dimensions].sort((a, b) => a.score - b.score)[0];
  if (weakest && weakest.score < 50) {
    actions.push({
      action: `Address ${weakest.label.toLowerCase()}`,
      reason: weakest.summary,
      href: `${deal360Href(dealId)}#viability`,
      priority: weakest.status === "critical" ? "High" : "Medium",
    });
  }
  if (fatalFlawAlerts.length > 0) {
    const top = fatalFlawAlerts[0]!;
    actions.push({
      action: top.recommendedAction,
      reason: top.detail,
      href: top.href,
      priority: top.severity === "critical" ? "High" : "Medium",
    });
  }
  return actions.slice(0, 4);
}

export function computeCommercialViability(
  deal: PipelineRow,
  companies: Company[],
  activities: Activity[],
  pipelines: PipelineRow[],
  commercialPackages: CommercialPackage[],
): CommercialViabilityAssessment {
  const company = findCompanyForDeal(deal.id, companies);
  const dealActivities = getActivitiesForDeal(activities, deal.id);
  const packages = packagesForDeal(commercialPackages, deal.id);
  const intel = computeOpportunityIntelligence(deal, companies, activities, pipelines);

  const sorted = [...dealActivities].sort(
    (a, b) => new Date(b.ActivityDate).getTime() - new Date(a.ActivityDate).getTime(),
  );
  const daysSince = sorted[0] ? daysBetween(sorted[0].ActivityDate) : 999;
  const overdueCount = dealActivities.filter(isFollowUpOpen).filter(isFollowUpOverdue).length;
  const recent30 = dealActivities.filter((a) => daysBetween(a.ActivityDate) <= 30).length;

  const buying = detectBuyingDrivers(deal, dealActivities);

  const baseDimensions: CommercialViabilityDimension[] = [
    buildDimension("buying_drivers", buying.scored),
    buildDimension("business_case_strength", scoreBusinessCase(deal, intel.winProbability, packages, company)),
    buildDimension("financial_readiness", scoreFinancialReadiness(deal, packages, company)),
    buildDimension("feedstock_readiness", scoreFeedstockReadiness(deal)),
    buildDimension("project_readiness", scoreProjectReadiness(deal)),
    buildDimension("offtake_readiness", scoreOfftakeReadiness(deal, company)),
    buildDimension("delivery_readiness", scoreDeliveryReadiness(deal, packages)),
    buildDimension(
      "decision_readiness",
      scoreDecisionReadiness(deal, dealActivities, intel.stakeholderCount, overdueCount),
    ),
    buildDimension(
      "competitive_position",
      scoreCompetitivePosition(packages, intel.stakeholderCount, daysSince, dealActivities.length),
    ),
    buildDimension(
      "commercial_momentum",
      scoreCommercialMomentum(intel.momentum, recent30, daysSince),
    ),
    buildDimension("strategic_value", scoreStrategicValue(deal, company, intel.healthScore)),
    buildDimension(
      "resource_efficiency",
      scoreResourceEfficiency(
        intel.momentum,
        overdueCount,
        daysSince,
        dealActivities.length,
        deal.salesValue,
      ),
    ),
  ];

  const revenuePath = evaluateRevenuePath(deal, packages, dealActivities, baseDimensions);
  const revenuePathScored = scoreRevenuePathDimension(revenuePath);
  const dimensions = [
    ...baseDimensions,
    buildDimension("revenue_path", revenuePathScored),
  ];

  const byId = Object.fromEntries(dimensions.map((d) => [d.id, d])) as Record<
    CommercialViabilityDimensionId,
    CommercialViabilityDimension
  >;

  const viabilityScore = clampScore(
    dimensions.reduce((sum, dim) => sum + dim.score * DIMENSION_WEIGHTS[dim.id], 0),
  );

  const projectMaturity = computeProjectMaturity(deal, packages);
  const contractReadiness = computeContractReadiness(dimensions, packages, deal);
  const estimatedContractReadiness = contractReadiness.percent;

  const contractProbability = clampScore(
    viabilityScore * 0.4 + intel.winProbability * 0.3 + estimatedContractReadiness * 0.3,
  );

  const fatalFlawAlerts = detectFatalFlawAlerts(
    deal,
    company,
    dimensions,
    intel.momentum,
    daysSince,
    dealActivities,
    packages,
    intel.stakeholderCount,
  );
  const fatalFlaws = fatalFlawsToImpactSignals(fatalFlawAlerts);
  const resourceScore = byId.resource_efficiency!.score;

  let recommendation: ViabilityRecommendation = "qualify";
  if (
    fatalFlawAlerts.some((f) => f.severity === "critical") ||
    contractProbability < 20 ||
    resourceScore < 25
  ) {
    recommendation = "walk_away";
  } else if (contractProbability >= 55 && viabilityScore >= 60 && resourceScore >= 45) {
    recommendation = "pursue";
  } else if (contractProbability < 38 || viabilityScore < 42) {
    recommendation = "deprioritize";
  }

  const purchaseWindow =
    deal.expectedCloseDate && !Number.isNaN(new Date(deal.expectedCloseDate).getTime())
      ? new Date(deal.expectedCloseDate).toLocaleDateString("en-GB", {
          month: "short",
          year: "numeric",
        })
      : deal.status === "Contract Negotiation"
        ? "4–8 weeks"
        : deal.status === "Feedstock Analysis"
          ? "2–4 months"
          : contractProbability >= 50
            ? "1–3 months"
            : "6+ months";

  const businessModel = inferBusinessModel(deal, packages);
  const businessModelLabel =
    businessModel === "equipment_sale"
      ? "Direct Equipment Sale"
      : businessModel === "project_development"
        ? "Project Development Services"
        : "Development → Equipment Path";

  const risks = buildRisks(dimensions, intel.risks);
  const nextActions = buildNextActions(
    deal.id,
    revenuePath,
    intel.nextBestAction,
    dimensions,
    fatalFlawAlerts,
  );
  const coreQuestions = buildCoreQuestions(
    dimensions,
    revenuePath,
    recommendation,
    fatalFlawAlerts,
    risks,
  );

  return {
    moduleVersion: CVM_VERSION,
    moduleName: CVM_MODULE_NAME,
    engineLabel: CVM_ENGINE_LABEL,
    northStar: CVM_NORTH_STAR,
    dealId: deal.id,
    dealName: deal.assetName,
    companyId: company?.CompanyID ?? null,
    companyName: company?.Title ?? null,
    salesValueLabel: formatDealValue(deal.currency, deal.salesValue),
    businessModel,
    businessModelLabel,
    viabilityScore,
    contractProbability,
    contractProbabilityLabel: `${contractProbability}%`,
    recommendation,
    recommendationLabel: VIABILITY_RECOMMENDATION_LABELS[recommendation],
    estimatedPurchaseWindow: purchaseWindow,
    projectMaturity,
    contractReadiness,
    estimatedContractReadiness,
    estimatedContractReadinessLabel: `${contractReadiness.percent}% contract readiness`,
    detectedBuyingDrivers: buying.drivers,
    dimensions,
    revenuePath,
    coreQuestions,
    risks,
    fatalFlawAlerts,
    fatalFlaws,
    nextActions,
  };
}

export function rankCommercialViability(
  pipelines: PipelineRow[],
  companies: Company[],
  activities: Activity[],
  commercialPackages: CommercialPackage[],
): CommercialViabilityAssessment[] {
  return pipelines
    .filter((deal) => SALES_STAGES.includes(deal.status))
    .map((deal) =>
      computeCommercialViability(deal, companies, activities, pipelines, commercialPackages),
    )
    .sort((a, b) => {
      const order: Record<ViabilityRecommendation, number> = {
        pursue: 0,
        qualify: 1,
        deprioritize: 2,
        walk_away: 3,
      };
      const diff = order[a.recommendation] - order[b.recommendation];
      if (diff !== 0) return diff;
      return b.contractProbability - a.contractProbability;
    });
}

export function toCommercialViabilityBrief(
  assessment: CommercialViabilityAssessment,
): CommercialViabilityBrief {
  return {
    dealId: assessment.dealId,
    dealName: assessment.dealName,
    companyName: assessment.companyName,
    viabilityScore: assessment.viabilityScore,
    contractProbability: assessment.contractProbability,
    contractProbabilityLabel: assessment.contractProbabilityLabel,
    recommendation: assessment.recommendation,
    recommendationLabel: assessment.recommendationLabel,
    estimatedPurchaseWindow: assessment.estimatedPurchaseWindow,
    estimatedContractReadinessLabel: `${assessment.contractReadiness.percent}% contract readiness`,
    projectMaturitySummary: assessment.projectMaturity.summary,
    revenuePathNext: assessment.revenuePath.whatToSellNext,
    businessModelLabel: assessment.businessModelLabel,
    headline:
      assessment.fatalFlawAlerts[0]?.label ??
      assessment.revenuePath.whatToSellNext ??
      assessment.risks[0]?.label ??
      "Commercial viability assessed",
    recommendedNextAction: assessment.nextActions[0]?.action ?? "Review opportunity",
    href: `${deal360Href(assessment.dealId)}#viability`,
    hasFatalFlaws: assessment.fatalFlawAlerts.length > 0,
  };
}

export function buildPortfolioCommercialViability(
  pipelines: PipelineRow[],
  companies: Company[],
  activities: Activity[],
  commercialPackages: CommercialPackage[],
  limit = 5,
): CommercialViabilityBrief[] {
  return rankCommercialViability(pipelines, companies, activities, commercialPackages)
    .slice(0, limit)
    .map(toCommercialViabilityBrief);
}
