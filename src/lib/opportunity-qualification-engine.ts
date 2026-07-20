import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import { computeCommercialViability } from "@/lib/commercial-viability-engine";
import {
  computeOpportunityIntelligence,
  findCompanyForDeal,
} from "@/lib/opportunity-intelligence-engine";
import { getActivitiesForDeal } from "@/lib/activity-utils";
import { daysBetween } from "@/lib/relative-time";
import type { PipelineRow } from "@/types/pipeline";
import { getLifecycleStage } from "@/types/pipeline";
import { deal360Href } from "@/types/relationship-navigation";
import type {
  OpportunityQualification,
  OpportunityQualificationBrief,
  OpportunityQualificationTier,
  PaidServiceSignal,
  QualificationCommercialPotential,
  QualificationDimensionScore,
  QualificationPriority,
} from "@/types/opportunity-qualification";
import {
  QUALIFICATION_COMMERCIAL_POTENTIAL_LABELS,
  QUALIFICATION_TIER_META,
} from "@/types/opportunity-qualification";

const DIMENSION_WEIGHTS = {
  project_maturity: 0.1,
  budget_availability: 0.1,
  decision_maker_access: 0.09,
  feedstock_availability: 0.08,
  business_case_potential: 0.1,
  funding_availability: 0.08,
  technical_fit: 0.08,
  geographical_fit: 0.05,
  strategic_fit: 0.08,
  competitive_position: 0.07,
  timeline: 0.09,
  relationship_strength: 0.08,
} as const;

const PAID_SERVICE_PATTERNS: Array<{ pattern: RegExp; trigger: string }> = [
  { pattern: /\bfeasibility\b/i, trigger: "Feasibility study requested" },
  { pattern: /\bengineering study\b/i, trigger: "Engineering study requested" },
  { pattern: /\bbusiness case\b/i, trigger: "Business case development requested" },
  { pattern: /\bproject development\b/i, trigger: "Project development support requested" },
  { pattern: /\btechnical assessment\b/i, trigger: "Technical assessment requested" },
  { pattern: /\bbankability\b/i, trigger: "Bankability analysis requested" },
  { pattern: /\bfront[- ]end engineering\b|\bfeed\b/i, trigger: "FEED / engineering scope discussed" },
  { pattern: /\bsite assessment\b/i, trigger: "Site assessment requested" },
];

const INFORMATION_SEEKER_PATTERNS = [
  /\bjust (looking|exploring|curious)\b/i,
  /\bearly (stage|phase|days)\b/i,
  /\binformation (only|gathering)\b/i,
  /\bno budget\b/i,
  /\bexploratory\b/i,
];

function clamp(score: number): number {
  return Math.round(Math.max(0, Math.min(100, score)));
}

function dimById(
  dimensions: ReturnType<typeof computeCommercialViability>["dimensions"],
  id: string,
): number {
  return dimensions.find((d) => d.id === id)?.score ?? 40;
}

function scoreGeographicalFit(company: Company | undefined): { score: number; summary: string } {
  const country = company?.Country?.Title?.toLowerCase() ?? "";
  const nordic = ["sweden", "norway", "denmark", "finland", "iceland"];
  const euCore = ["germany", "france", "netherlands", "belgium", "italy", "spain", "austria"];

  if (nordic.some((c) => country.includes(c))) {
    return { score: 90, summary: "Nordic market — primary StandardBio geography" };
  }
  if (euCore.some((c) => country.includes(c))) {
    return { score: 78, summary: "EU core market — strong commercial fit" };
  }
  if (country.includes("united kingdom") || country.includes("uk")) {
    return { score: 72, summary: "UK market — viable with regulatory alignment" };
  }
  if (country) {
    return { score: 55, summary: `${company?.Country?.Title} — evaluate strategic priority` };
  }
  return { score: 45, summary: "Geography not confirmed — validate market priority" };
}

function scoreTimeline(
  deal: PipelineRow,
  momentum: string,
  daysSinceActivity: number,
): { score: number; summary: string } {
  let score = 40;
  const signals: string[] = [];

  if (deal.expectedCloseDate) {
    const daysToClose = daysBetween(
      new Date().toISOString(),
      new Date(deal.expectedCloseDate),
    );
    if (daysToClose >= 0 && daysToClose <= 90) {
      score += 35;
      signals.push(`Close date within ${daysToClose} days`);
    } else if (daysToClose > 90 && daysToClose <= 180) {
      score += 20;
      signals.push("Medium-term close window");
    } else if (daysToClose < 0) {
      score += 5;
      signals.push("Close date passed — revalidate timeline");
    }
  }

  if (deal.status === "Contract Negotiation") {
    score += 25;
    signals.push("In contract negotiation — near-term");
  } else if (deal.status === "Feedstock Analysis") {
    score += 15;
    signals.push("Active technical qualification");
  }

  if (momentum === "Accelerating") {
    score += 15;
    signals.push("Momentum accelerating");
  } else if (momentum === "Stalled") {
    score -= 15;
    signals.push("Timeline stalled");
  }

  if (daysSinceActivity > 45) {
    score -= 10;
    signals.push(`${daysSinceActivity}d since last activity`);
  }

  return {
    score: clamp(score),
    summary: signals[0] ?? "Timeline not established — confirm purchase window",
  };
}

function detectPaidServiceSignals(
  activities: Activity[],
  packages: CommercialPackage[],
): PaidServiceSignal {
  const text = activities
    .map((a) => `${a.Subject} ${a.Summary ?? ""} ${a.ActivityDescription ?? ""}`)
    .join(" ");

  const triggers = PAID_SERVICE_PATTERNS.filter((p) => p.pattern.test(text)).map(
    (p) => p.trigger,
  );

  const hasPaidPackage = packages.some(
    (p) =>
      p.kind === "commercial_baseline" ||
      p.status === "sent" ||
      p.status === "accepted" ||
      p.status === "frozen",
  );

  if (triggers.length === 0) {
    return { detected: false, triggers: [], recommendation: "", rationale: "" };
  }

  if (hasPaidPackage) {
    return {
      detected: true,
      triggers,
      recommendation: "Continue under existing paid commercial scope",
      rationale:
        "Paid commercial package already in place — avoid scope creep without contract amendment.",
    };
  }

  return {
    detected: true,
    triggers,
    recommendation: "Move to paid Project Bankability Assessment",
    rationale:
      "Detailed feasibility, engineering or business case work requested without paid engagement — convert to paid consulting before investing further resources.",
  };
}

function isInformationSeeker(
  activities: Activity[],
  deal: PipelineRow,
  businessCaseScore: number,
  budgetScore: number,
): boolean {
  const text = activities
    .map((a) => `${a.Subject} ${a.Summary ?? ""} ${a.ActivityDescription ?? ""}`)
    .join(" ");

  if (INFORMATION_SEEKER_PATTERNS.some((p) => p.test(text))) return true;
  if (deal.status === "Prospecting" && businessCaseScore < 40 && budgetScore < 40) return true;
  if (deal.probability < 15 && businessCaseScore < 35) return true;
  return false;
}

function classifyTier(
  score: number,
  params: {
    decisionScore: number;
    budgetScore: number;
    informationSeeker: boolean;
    hasFatalFlaws: boolean;
  },
): OpportunityQualificationTier {
  if (params.informationSeeker || (score < 35 && params.budgetScore < 40)) return "D";
  if (params.hasFatalFlaws && score < 50) return "D";
  if (score >= 75 && params.decisionScore >= 55 && params.budgetScore >= 50 && !params.informationSeeker) {
    return "A";
  }
  if (score >= 55) return "B";
  if (score >= 35) return "C";
  return "D";
}

function resolveCommercialPotential(
  deal: PipelineRow,
  assessment: ReturnType<typeof computeCommercialViability>,
  paidDetected: boolean,
): QualificationCommercialPotential {
  if (deal.status === "Contract Negotiation" || assessment.contractReadiness.percent >= 60) {
    return "machinery_sale";
  }
  if (paidDetected || assessment.businessModel === "project_development") {
    return assessment.businessModel === "project_development"
      ? "project_development"
      : "paid_consulting";
  }
  const engineeringScore =
    (dimById(assessment.dimensions, "project_readiness") +
      dimById(assessment.dimensions, "delivery_readiness")) /
    2;
  if (engineeringScore >= 60) return "engineering_contract";
  return "mixed";
}

function buildRecommendedAction(
  tier: OpportunityQualificationTier,
  deal: PipelineRow,
  paidService: PaidServiceSignal,
  assessment: ReturnType<typeof computeCommercialViability>,
  intel: ReturnType<typeof computeOpportunityIntelligence>,
  company: Company | undefined,
): {
  action: string;
  reason: string;
  owner: string;
  when: string;
  outcome: string;
  confidence: number;
  priority: QualificationPriority;
} {
  const owner = company?.AccountOwner?.Title ?? "Commercial lead";

  if (tier === "D") {
    return {
      action: paidService.detected
        ? "Offer paid Project Bankability Assessment only — no free advisory"
        : "Deprioritize or qualify with minimal discovery",
      reason: paidService.detected
        ? "Information-seeking pattern with unpaid scope requests — protect consulting margin"
        : "Low commitment, no visible business case — avoid unpaid consulting investment",
      owner,
      when: "This week",
      outcome: paidService.detected
        ? "Paid assessment engagement or clear disqualification"
        : "Resource preserved for higher-tier opportunities",
      confidence: 84,
      priority: "low",
    };
  }

  if (paidService.detected && !paidService.recommendation.includes("existing")) {
    return {
      action: "Offer Project Bankability Assessment (paid)",
      reason: `${paidService.triggers[0] ?? "Advisory scope"} requested — funding and decision makers ${tier === "A" ? "identified" : "emerging"}`,
      owner,
      when: tier === "A" ? "Within 5 business days" : "Within 2 weeks",
      outcome: "Paid consulting engagement → machinery or project development proposal",
      confidence: tier === "A" ? 91 : 78,
      priority: tier === "A" ? "critical" : "high",
    };
  }

  if (tier === "A") {
    const hasQuote = dimById(assessment.dimensions, "delivery_readiness") >= 70;
    return {
      action: hasQuote
        ? "Advance to formal machinery proposal and contract negotiation"
        : "Deliver Project Bankability Assessment then machinery proposal",
      reason: "Funded project with decision-maker access and strong business case drivers",
      owner,
      when: "Within 2 weeks",
      outcome: hasQuote ? "Machinery sale or engineering contract" : "Paid assessment → machinery proposal",
      confidence: 88,
      priority: "critical",
    };
  }

  if (tier === "B") {
    return {
      action: "Propose paid Project Bankability Assessment",
      reason: "Promising project with emerging requirements — validate before engineering investment",
      owner,
      when: "Within 3 weeks",
      outcome: "Paid consulting engagement and qualification to Tier A",
      confidence: 82,
      priority: "high",
    };
  }

  return {
    action: intel.nextBestAction.action || "Schedule qualification call with economic buyer",
    reason:
      intel.nextBestAction.reason ||
      "Early-stage — confirm budget, decision process and feedstock before unpaid work",
    owner,
    when: "Within 30 days",
    outcome: "Qualification to Tier B or paid scoping engagement",
    confidence: 70,
    priority: "medium",
  };
}

export function computeOpportunityQualification(
  deal: PipelineRow,
  companies: Company[],
  activities: Activity[],
  pipelines: PipelineRow[],
  commercialPackages: CommercialPackage[],
): OpportunityQualification {
  const company = findCompanyForDeal(deal.id, companies);
  const dealActivities = getActivitiesForDeal(activities, deal.id);
  const packages = commercialPackages.filter((p) => p.DealId === deal.id);
  const assessment = computeCommercialViability(
    deal,
    companies,
    activities,
    pipelines,
    commercialPackages,
  );
  const intel = computeOpportunityIntelligence(deal, companies, activities, pipelines);

  const sorted = [...dealActivities].sort(
    (a, b) => new Date(b.ActivityDate).getTime() - new Date(a.ActivityDate).getTime(),
  );
  const daysSince = sorted[0] ? daysBetween(sorted[0].ActivityDate) : 999;

  const projectMaturityScore = assessment.contractReadiness.percent;
  const budgetScore = dimById(assessment.dimensions, "financial_readiness");
  const decisionScore = dimById(assessment.dimensions, "decision_readiness");
  const feedstockScore = dimById(assessment.dimensions, "feedstock_readiness");
  const businessCaseScore = dimById(assessment.dimensions, "business_case_strength");
  const fundingScore = clamp(budgetScore * 0.7 + (deal.probability >= 30 ? 20 : 0));
  const technicalFit = clamp(
    (dimById(assessment.dimensions, "project_readiness") +
      dimById(assessment.dimensions, "delivery_readiness")) /
      2,
  );
  const geo = scoreGeographicalFit(company);
  const strategicScore = dimById(assessment.dimensions, "strategic_value");
  const competitiveScore = dimById(assessment.dimensions, "competitive_position");
  const timeline = scoreTimeline(deal, intel.momentum, daysSince);
  const relationshipScore = intel.healthScore;

  const dimensionScores: QualificationDimensionScore[] = [
    {
      id: "project_maturity",
      label: "Project Maturity",
      score: clamp(projectMaturityScore),
      summary: assessment.projectMaturity.summary,
    },
    {
      id: "budget_availability",
      label: "Budget Availability",
      score: budgetScore,
      summary: assessment.dimensions.find((d) => d.id === "financial_readiness")?.summary ?? "",
    },
    {
      id: "decision_maker_access",
      label: "Decision Maker Access",
      score: decisionScore,
      summary:
        intel.stakeholderCount >= 2
          ? `${intel.stakeholderCount} stakeholders engaged`
          : "Limited decision-maker coverage",
    },
    {
      id: "feedstock_availability",
      label: "Feedstock Availability",
      score: feedstockScore,
      summary: assessment.dimensions.find((d) => d.id === "feedstock_readiness")?.summary ?? "",
    },
    {
      id: "business_case_potential",
      label: "Business Case Potential",
      score: businessCaseScore,
      summary: assessment.dimensions.find((d) => d.id === "business_case_strength")?.summary ?? "",
    },
    {
      id: "funding_availability",
      label: "Funding Availability",
      score: fundingScore,
      summary:
        deal.probability >= 40
          ? `Investment confidence ${deal.probability}%`
          : "Funding pathway not confirmed",
    },
    {
      id: "technical_fit",
      label: "Technical Fit",
      score: technicalFit,
      summary: deal.targetFeedstock
        ? `Feedstock ${deal.targetFeedstock} · capacity ${deal.reactorDesignCapacity || "TBD"} t/day`
        : "Technical parameters need validation",
    },
    {
      id: "geographical_fit",
      label: "Geographical Fit",
      score: geo.score,
      summary: geo.summary,
    },
    {
      id: "strategic_fit",
      label: "Strategic Fit",
      score: strategicScore,
      summary: assessment.dimensions.find((d) => d.id === "strategic_value")?.summary ?? "",
    },
    {
      id: "competitive_position",
      label: "Competitive Position",
      score: competitiveScore,
      summary: assessment.dimensions.find((d) => d.id === "competitive_position")?.summary ?? "",
    },
    {
      id: "timeline",
      label: "Timeline",
      score: timeline.score,
      summary: timeline.summary,
    },
    {
      id: "relationship_strength",
      label: "Relationship Strength",
      score: relationshipScore,
      summary: `${intel.healthStatus} · ${intel.momentum} momentum`,
    },
  ];

  const qualificationScore = clamp(
    dimensionScores.reduce(
      (sum, dim) => sum + dim.score * DIMENSION_WEIGHTS[dim.id],
      0,
    ),
  );

  const paidService = detectPaidServiceSignals(dealActivities, packages);
  const informationSeeker = isInformationSeeker(
    dealActivities,
    deal,
    businessCaseScore,
    budgetScore,
  );
  const hasFatalFlaws = assessment.fatalFlawAlerts.some((f) => f.severity === "critical");

  const tier = classifyTier(qualificationScore, {
    decisionScore,
    budgetScore,
    informationSeeker,
    hasFatalFlaws,
  });

  const commercialPotential = resolveCommercialPotential(deal, assessment, paidService.detected);
  const action = buildRecommendedAction(tier, deal, paidService, assessment, intel, company);
  const salesOnly = getLifecycleStage(deal.status) === "sales";

  return {
    dealId: deal.id,
    dealName: deal.assetName ?? deal.id,
    qualificationScore,
    tier,
    tierDescription: QUALIFICATION_TIER_META[tier].description,
    recommendedAction: action.action,
    actionReason: action.reason,
    actionOwner: action.owner,
    actionWhen: action.when,
    expectedOutcome: action.outcome,
    confidencePercent: action.confidence,
    priority: salesOnly ? action.priority : "medium",
    commercialPotential,
    commercialPotentialLabel: QUALIFICATION_COMMERCIAL_POTENTIAL_LABELS[commercialPotential],
    paidService,
    dimensions: dimensionScores,
    discourageUnpaidConsulting:
      paidService.detected && !paidService.recommendation.includes("existing"),
    href: deal360Href(deal.id),
  };
}

export function computeAllOpportunityQualifications(
  pipelines: PipelineRow[],
  companies: Company[],
  activities: Activity[],
  commercialPackages: CommercialPackage[],
): OpportunityQualification[] {
  const salesDeals = pipelines.filter((p) => getLifecycleStage(p.status) === "sales");

  return salesDeals
    .map((deal) =>
      computeOpportunityQualification(deal, companies, activities, pipelines, commercialPackages),
    )
    .sort((a, b) => b.qualificationScore - a.qualificationScore);
}

export function toQualificationBrief(
  qualification: OpportunityQualification,
): OpportunityQualificationBrief {
  return {
    dealId: qualification.dealId,
    dealName: qualification.dealName,
    qualificationScore: qualification.qualificationScore,
    tier: qualification.tier,
    recommendedAction: qualification.recommendedAction,
    actionReason: qualification.actionReason,
    expectedOutcome: qualification.expectedOutcome,
    confidencePercent: qualification.confidencePercent,
    commercialPotentialLabel: qualification.commercialPotentialLabel,
    href: qualification.href,
  };
}
