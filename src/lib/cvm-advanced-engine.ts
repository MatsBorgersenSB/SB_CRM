import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import { isQuotationKind } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { getLifecycleStage } from "@/types/pipeline";
import {
  CVM_CONTRACT_READINESS_SOURCES,
  CVM_CONTRACT_READINESS_WEIGHTS,
} from "@/lib/cvm-config";
import type { OpportunityMomentum } from "@/lib/opportunity-intelligence-engine";
import type {
  CommercialViabilityDimension,
  CommercialViabilityDimensionId,
  ContractReadinessAssessment,
  FatalFlawAlert,
  FatalFlawId,
  ProjectMaturityAssessment,
  ProjectMaturityStage,
} from "@/types/commercial-viability";
import { deal360Href } from "@/types/relationship-navigation";

type MaturityDistribution = Record<ProjectMaturityStage, number>;

function normalizeMaturity(dist: MaturityDistribution): MaturityDistribution {
  const total = Object.values(dist).reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return { fel1: 70, fel2: 20, fel3: 10, proposal_ready: 0, contract_ready: 0 };
  }
  const normalized = {} as MaturityDistribution;
  for (const key of Object.keys(dist) as ProjectMaturityStage[]) {
    normalized[key] = Math.round((dist[key] / total) * 100);
  }
  const drift = 100 - Object.values(normalized).reduce((sum, value) => sum + value, 0);
  if (drift !== 0) {
    const peak = (Object.entries(normalized).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      "fel1") as ProjectMaturityStage;
    normalized[peak] = Math.max(0, normalized[peak] + drift);
  }
  return normalized;
}

function maturityFromDeal(
  deal: PipelineRow,
  packages: CommercialPackage[],
): MaturityDistribution {
  const hasPriceIndication = packages.some((p) => p.kind === "price_indication");
  const hasBudgetQuote = packages.some((p) => p.kind === "budget_quotation");
  const hasFormalQuote = packages.some((p) => p.kind === "formal_quotation");
  const hasAccepted = packages.some(
    (p) => isQuotationKind(p.kind) && (p.status === "accepted" || p.status === "frozen"),
  );

  if (deal.status === "Contract Negotiation" || hasAccepted) {
    return { fel1: 0, fel2: 5, fel3: 15, proposal_ready: 30, contract_ready: 50 };
  }
  if (hasFormalQuote) {
    return { fel1: 5, fel2: 10, fel3: 25, proposal_ready: 35, contract_ready: 25 };
  }
  if (hasBudgetQuote) {
    return { fel1: 10, fel2: 25, fel3: 40, proposal_ready: 20, contract_ready: 5 };
  }
  if (deal.status === "Feedstock Analysis" || hasPriceIndication) {
    return { fel1: 25, fel2: 45, fel3: 25, proposal_ready: 5, contract_ready: 0 };
  }
  if (deal.status === "Prospecting") {
    return { fel1: 70, fel2: 20, fel3: 10, proposal_ready: 0, contract_ready: 0 };
  }
  if (getLifecycleStage(deal.status) !== "sales") {
    return { fel1: 0, fel2: 0, fel3: 10, proposal_ready: 20, contract_ready: 70 };
  }
  return { fel1: 40, fel2: 35, fel3: 20, proposal_ready: 5, contract_ready: 0 };
}

const MATURITY_STAGE_LABELS: Record<ProjectMaturityStage, string> = {
  fel1: "FEL-1",
  fel2: "FEL-2",
  fel3: "FEL-3",
  proposal_ready: "Proposal Ready",
  contract_ready: "Contract Ready",
};

export function computeProjectMaturity(
  deal: PipelineRow,
  packages: CommercialPackage[],
): ProjectMaturityAssessment {
  const distribution = normalizeMaturity(maturityFromDeal(deal, packages));
  const stages = (Object.keys(distribution) as ProjectMaturityStage[]).map((id) => ({
    id,
    label: MATURITY_STAGE_LABELS[id],
    percentage: distribution[id],
  }));
  const currentStage =
    stages.reduce((best, stage) => (stage.percentage > best.percentage ? stage : best), stages[0]!)
      .id ?? "fel1";

  const summary = stages
    .filter((stage) => stage.percentage > 0)
    .map((stage) => `${stage.label} ${stage.percentage}%`)
    .join(" · ");

  return {
    stages,
    currentStage,
    currentStageLabel: MATURITY_STAGE_LABELS[currentStage],
    summary,
    question: "Where is this project in its development maturity?",
  };
}

export function computeContractReadiness(
  dimensions: CommercialViabilityDimension[],
  packages: CommercialPackage[],
  deal: PipelineRow,
): ContractReadinessAssessment {
  const byId = Object.fromEntries(dimensions.map((d) => [d.id, d])) as Record<
    CommercialViabilityDimensionId,
    CommercialViabilityDimension
  >;

  const contributors = CVM_CONTRACT_READINESS_SOURCES.map((id) => ({
    dimensionId: id,
    label: byId[id]?.scoreLabel ?? id,
    score: byId[id]?.score ?? 0,
    weight: CVM_CONTRACT_READINESS_WEIGHTS[id],
  }));

  let score = contributors.reduce((sum, item) => sum + item.score * item.weight, 0);

  if (
    packages.some(
      (p) => p.kind === "commercial_baseline" && (p.status === "accepted" || p.status === "frozen"),
    )
  ) {
    score += 8;
  }
  if (deal.status === "Contract Negotiation") score += 12;
  if (packages.some((p) => isQuotationKind(p.kind) && p.status === "sent")) score += 5;

  const percent = Math.round(Math.max(0, Math.min(100, score)));

  return {
    percent,
    label: `${percent}%`,
    question: "How close are we to a signed contract?",
    builtFrom: contributors,
    summary:
      percent >= 70
        ? "Contract readiness strong — focus on closure mechanics"
        : percent >= 45
          ? "Mid-stage readiness — close gaps in financing and decision process"
          : "Early readiness — invest in validation before major pursuit",
  };
}

function flaw(
  id: FatalFlawId,
  label: string,
  detail: string,
  severity: FatalFlawAlert["severity"],
  impact: string[],
  recommendedAction: string,
  dealId: string,
): FatalFlawAlert {
  return { id, label, detail, severity, impact, recommendedAction, href: `${deal360Href(dealId)}#viability` };
}

export function detectFatalFlawAlerts(
  deal: PipelineRow,
  company: Company | undefined,
  dimensions: CommercialViabilityDimension[],
  momentum: OpportunityMomentum,
  daysSince: number,
  dealActivities: Activity[],
  packages: CommercialPackage[],
  stakeholderCount: number,
): FatalFlawAlert[] {
  const byId = Object.fromEntries(dimensions.map((d) => [d.id, d])) as Record<
    CommercialViabilityDimensionId,
    CommercialViabilityDimension
  >;
  const alerts: FatalFlawAlert[] = [];

  const noFeedstock =
    !deal.targetFeedstock || deal.targetFeedstock === "—" || (byId.feedstock_readiness?.score ?? 0) < 25;
  if (noFeedstock) {
    alerts.push(
      flaw(
        "no_feedstock",
        "No Feedstock",
        "Feedstock type, volume, or supply security not validated",
        "critical",
        ["Project cannot operate without secure feedstock", "Blocks business case and financing"],
        "Run feedstock validation before further engineering investment",
        deal.id,
      ),
    );
  }

  const noSite =
    (byId.project_readiness?.score ?? 0) < 30 &&
    !deal.FileLeafRef &&
    deal.status !== "Contract Negotiation";
  if (noSite) {
    alerts.push(
      flaw(
        "no_site",
        "No Site",
        "Site, utilities, and infrastructure not assessed",
        "critical",
        ["Cannot size equipment or validate permitting path", "Blocks FEED and equipment quotation"],
        "Commission site and utility assessment",
        deal.id,
      ),
    );
  }

  if ((byId.financial_readiness?.score ?? 0) < 30) {
    alerts.push(
      flaw(
        "no_financing",
        "No Financing",
        "Customer financing pathway not confirmed",
        "critical",
        ["Customer may not be able to fund CAPEX", "Delays or kills equipment contract"],
        "Map equity, debt, grants, and board approval process with economic buyer",
        deal.id,
      ),
    );
  }

  if ((byId.offtake_readiness?.score ?? 0) < 30) {
    alerts.push(
      flaw(
        "no_offtake",
        "No Offtake",
        "Biochar, carbon credit, or thermal revenue path not secured",
        "high",
        ["Revenue security weak — business case incomplete", "Investment committee will block"],
        "Validate offtake agreements or carbon credit strategy",
        deal.id,
      ),
    );
  }

  if (stakeholderCount <= 1 && (byId.decision_readiness?.score ?? 0) < 45) {
    alerts.push(
      flaw(
        "no_sponsor",
        "No Sponsor",
        "Executive sponsor and internal champion not identified",
        "high",
        ["Single-threaded deals stall at investment committee", "Competitor bypass risk"],
        "Map executive sponsor, champion, and economic buyer",
        deal.id,
      ),
    );
    alerts.push(
      flaw(
        "no_decision_maker",
        "No Decision Maker",
        "Economic buyer and procurement process not engaged",
        "high",
        ["Cannot progress to signed contract without decision authority", "Proposals go unanswered"],
        "Schedule commercial review with budget holder and procurement",
        deal.id,
      ),
    );
  }

  if ((byId.delivery_readiness?.score ?? 0) < 25) {
    alerts.push(
      flaw(
        "technology_mismatch",
        "Technology Mismatch",
        "Standard Bio delivery capacity or technology fit not confirmed",
        "high",
        ["Risk of margin erosion or failed delivery", "Damages reference value"],
        "Confirm technology fit, engineering capacity, and manufacturing schedule",
        deal.id,
      ),
    );
  }

  const activityText = dealActivities
    .map((a) => `${a.Subject} ${a.ActivityDescription ?? ""} ${a.Summary ?? ""}`)
    .join(" ")
    .toLowerCase();
  const utilityConcern =
    (byId.project_readiness?.score ?? 0) < 40 &&
    (activityText.includes("utility") ||
      activityText.includes("grid") ||
      activityText.includes("power constraint") ||
      (byId.project_readiness?.summary ?? "").toLowerCase().includes("utilit"));
  if (utilityConcern) {
    alerts.push(
      flaw(
        "utility_constraints",
        "Utility Constraints",
        "Grid, power, or utility capacity may block project delivery",
        "medium",
        ["Site may not support reactor capacity", "CAPEX and schedule risk"],
        "Complete utility assessment before FEED investment",
        deal.id,
      ),
    );
  }

  if (
    (byId.project_readiness?.score ?? 0) < 35 &&
    deal.status === "Prospecting" &&
    !packages.some((p) => p.kind === "price_indication")
  ) {
    alerts.push(
      flaw(
        "unrealistic_permitting",
        "Unrealistic Permitting",
        "Permitting and infrastructure timeline not validated for this stage",
        "medium",
        ["Schedule risk to revenue and customer confidence", "May invalidate business case"],
        "Validate permits, logistics, and site constraints in FEL-1",
        deal.id,
      ),
    );
  }

  if (dealActivities.length === 0) {
    alerts.push(
      flaw(
        "no_engagement",
        "No Engagement",
        "No customer activities recorded — cannot qualify opportunity",
        "critical",
        ["Commercial viability cannot be assessed", "Resource investment not justified"],
        "Establish qualified engagement before pursuit investment",
        deal.id,
      ),
    );
  }

  if (momentum === "Stalled" && daysSince > 35 && dealActivities.length > 0) {
    alerts.push(
      flaw(
        "commercial_stall",
        "Commercial Stall",
        `No progress in ${daysSince} days — opportunity quietly dying`,
        "high",
        ["Wasted sales and engineering effort", "Win probability decaying"],
        "Re-engage sponsor with clear next step or deprioritize",
        deal.id,
      ),
    );
  }

  const seen = new Set<FatalFlawId>();
  return alerts.filter((alert) => {
    if (seen.has(alert.id)) return false;
    seen.add(alert.id);
    return true;
  });
}

export function fatalFlawsToImpactSignals(alerts: FatalFlawAlert[]) {
  return alerts.map((alert) => ({
    label: `Fatal: ${alert.label}`,
    detail: alert.detail,
    impact: [...alert.impact, alert.recommendedAction],
  }));
}
