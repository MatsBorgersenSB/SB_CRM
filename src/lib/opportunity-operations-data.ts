import type { InsightCategory } from "@/types/smartassist-intelligence";
import type { Activity } from "@/types/activity";
import type { AuthUser } from "@/types/auth";
import type { Company } from "@/types/company";
import type { AttentionSeverity } from "@/types/attention-item";
import type { PipelineRow } from "@/types/pipeline";
import { formatDealValue } from "@/types/pipeline";
import { findCompanyForDeal } from "@/lib/opportunity-intelligence-engine";
import { resolveOpportunityOwner } from "@/lib/opportunity-owner";
import {
  computeOpportunityIntelligence,
  type OpportunityIntelligence,
} from "@/lib/opportunity-intelligence-engine";
import {
  getCloseDateStatus,
  opportunityStageLabel,
} from "@/lib/opportunity-overview";
import type { AttentionItem } from "@/types/attention-item";
import type { CommercialPackage } from "@/types/commercial-package";
import { computeCommercialViability } from "@/lib/commercial-viability-engine";
import {
  buildOpportunityUnderstanding,
  type ConfidenceLevel,
  type OpportunityUnderstanding,
  type RecommendedAttention,
} from "@/lib/opportunity-workspace-intelligence";
import {
  confidenceToCategory,
  gapToCategory,
} from "@/lib/smartassist-intelligence-layer";
import { buildAttentionItems } from "@/lib/smart-attention-engine";
import { companyHref, deal360Href } from "@/types/relationship-navigation";

export type OpportunityOperationsFilter =
  | "my_opportunities"
  | "my_team"
  | "needs_attention"
  | "healthy"
  | "closing_soon"
  | "high_value"
  | "all";

export const OPPORTUNITY_OPERATIONS_FILTERS: Array<{
  id: OpportunityOperationsFilter;
  label: string;
}> = [
  { id: "my_opportunities", label: "My Opportunities" },
  { id: "my_team", label: "My Team" },
  { id: "needs_attention", label: "Requires Attention" },
  { id: "healthy", label: "Healthy" },
  { id: "closing_soon", label: "Closing Soon" },
  { id: "high_value", label: "High Value" },
  { id: "all", label: "All Opportunities" },
];

export type OpportunityOperationsRow = {
  dealId: string;
  dealName: string;
  companyId: string | null;
  companyName: string | null;
  ownerLabel: string | null;
  valueLabel: string;
  salesValue: number;
  expectedCloseDate?: string;
  closeDateLabel: string;
  stageLabel: string;
  probability: number;
  probabilityLabel: string;
  attentionSeverity: AttentionSeverity;
  attentionLabel: string;
  dealHref: string;
  companyHref: string | null;
  ownerQueueHref: string | null;
  needsAttention: boolean;
  isHealthy: boolean;
  isClosingSoon: boolean;
  isClosingThisMonth: boolean;
  isHighValue: boolean;
  isOwnedByUser: boolean;
  /** Understanding-first fields */
  clientObjective: string;
  clientObjectiveCategory: InsightCategory;
  clientObjectiveConfidence: ConfidenceLevel;
  biggestUnknown: string;
  biggestUnknownCategory: InsightCategory;
  validationGapsCount: number;
  recommendedAttention: RecommendedAttention;
  attentionReason: string;
  nextStep: string;
  /** @deprecated Use recommendedAttention */
  understandingAttention: RecommendedAttention;
  /** @deprecated Use validationGapsCount */
  openGapsCount: number;
  /** @deprecated Use clientObjective */
  clientObjectiveHint: string;
  /** @deprecated Use nextStep */
  nextUnderstandingAction: string;
};

export type OpportunityUnderstandingSnapshot = {
  headline: string;
  subline: string;
  requiresAttentionCount: number;
  validationGapsCount: number;
  primaryFocus: OpportunityOperationsRow | null;
};

/** @deprecated Use understanding snapshot — kept for search compatibility */
export type OpportunityOperationsSummary = {
  totalOpportunities: number;
  totalPipelineValueLabel: string;
  needsAttentionCount: number;
  closingThisMonthCount: number;
};

export type OpportunityOperationsWorkspace = {
  rows: OpportunityOperationsRow[];
  understanding: OpportunityUnderstandingSnapshot;
  /** @deprecated Use understanding */
  summary: OpportunityOperationsSummary;
};

const HEALTHY_STATUSES = new Set(["Strategic", "Strong", "Healthy"]);

function attentionFromIntelligence(intelligence: OpportunityIntelligence): {
  severity: AttentionSeverity;
  label: string;
  needsAttention: boolean;
} {
  if (
    intelligence.healthStatus === "At Risk" ||
    intelligence.overdueCommitments > 0 ||
    intelligence.isAtRiskRevenue
  ) {
    return {
      severity: "urgent",
      label: intelligence.nextBestAction.action,
      needsAttention: true,
    };
  }

  if (
    intelligence.healthStatus === "Weak" ||
    intelligence.momentum === "Stalled" ||
    intelligence.openCommitments > 0
  ) {
    return {
      severity: "needs_attention",
      label: intelligence.nextBestAction.action,
      needsAttention: true,
    };
  }

  if (intelligence.momentum === "Slowing" || intelligence.daysSinceLastActivity > 21) {
    return {
      severity: "waiting",
      label: intelligence.nextBestAction.action,
      needsAttention: false,
    };
  }

  return {
    severity: "healthy",
    label: "On track",
    needsAttention: false,
  };
}

function isClosingThisMonth(expectedCloseDate: string | undefined, reference = new Date()): boolean {
  if (!expectedCloseDate) return false;
  const close = new Date(expectedCloseDate);
  return (
    close.getFullYear() === reference.getFullYear() &&
    close.getMonth() === reference.getMonth()
  );
}

function buildBiggestUnknown(understanding: OpportunityUnderstanding): {
  text: string;
  category: InsightCategory;
} {
  const topGap =
    understanding.knowledgeModel.criticalGaps.find((gap) => gap.priority === "high") ??
    understanding.knowledgeModel.criticalGaps[0];

  if (topGap) {
    return {
      text: topGap.missingInformation,
      category: gapToCategory(topGap),
    };
  }

  const assessmentGap = understanding.assessment.gapsInUnderstanding[0];
  if (assessmentGap) {
    return { text: assessmentGap, category: "unknown" };
  }

  return {
    text: "No critical unknowns flagged — validate assumptions before advancing.",
    category: "known",
  };
}

function buildRow(
  deal: PipelineRow,
  intelligence: OpportunityIntelligence,
  company: Company | undefined,
  commercialPackages: CommercialPackage[],
  companies: Company[],
  activities: Activity[],
  pipelines: PipelineRow[],
  attentionItems: AttentionItem[],
): OpportunityOperationsRow {
  const ownerLabel = resolveOpportunityOwner(deal, company)?.Title ?? null;
  const attention = attentionFromIntelligence(intelligence);
  const closeStatus = getCloseDateStatus(deal.expectedCloseDate);
  const assessment = computeCommercialViability(
    deal,
    companies,
    activities,
    pipelines,
    commercialPackages,
  );
  const understanding = buildOpportunityUnderstanding(
    deal,
    companies,
    assessment,
    activities,
    attentionItems.filter(
      (item) => item.objectType === "Opportunity" && item.sourceObjectId === deal.id,
    ),
  );

  const biggestUnknown = buildBiggestUnknown(understanding);
  const objectiveCategory = confidenceToCategory(understanding.clientObjective.confidence);
  const validationGapsCount = understanding.knowledgeModel.criticalGaps.length;
  const clientObjective = understanding.clientObjective.statement;
  const nextStep = understanding.nextBestAction.action;

  return {
    dealId: deal.id,
    dealName: deal.assetName,
    companyId: intelligence.companyId,
    companyName: intelligence.companyName,
    ownerLabel,
    valueLabel: formatDealValue(deal.currency, deal.salesValue),
    salesValue: deal.salesValue,
    expectedCloseDate: deal.expectedCloseDate,
    closeDateLabel: deal.expectedCloseDate
      ? new Date(deal.expectedCloseDate).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—",
    stageLabel: opportunityStageLabel(deal, commercialPackages),
    probability: deal.probability,
    probabilityLabel: `${deal.probability}%`,
    attentionSeverity: attention.severity,
    attentionLabel: nextStep,
    dealHref: deal360Href(deal.id),
    companyHref: intelligence.companyId ? companyHref(intelligence.companyId) : null,
    ownerQueueHref: ownerLabel ? `/?owner=${encodeURIComponent(ownerLabel)}` : null,
    needsAttention:
      attention.needsAttention || understanding.recommendedAttention === "HIGH",
    isHealthy: HEALTHY_STATUSES.has(intelligence.healthStatus),
    isClosingSoon: closeStatus === "due_soon" || closeStatus === "overdue",
    isClosingThisMonth: isClosingThisMonth(deal.expectedCloseDate),
    isHighValue: false,
    isOwnedByUser: false,
    clientObjective,
    clientObjectiveCategory: objectiveCategory,
    clientObjectiveConfidence: understanding.clientObjective.confidence,
    biggestUnknown: biggestUnknown.text,
    biggestUnknownCategory: biggestUnknown.category,
    validationGapsCount,
    recommendedAttention: understanding.recommendedAttention,
    attentionReason: understanding.attentionReason,
    nextStep,
    understandingAttention: understanding.recommendedAttention,
    openGapsCount: validationGapsCount,
    clientObjectiveHint: clientObjective,
    nextUnderstandingAction: nextStep,
  };
}

function buildUnderstandingSnapshot(
  rows: OpportunityOperationsRow[],
): OpportunityUnderstandingSnapshot {
  const sorted = sortOpportunityOperationsRows(rows);
  const primaryFocus = sorted[0] ?? null;
  const requiresAttentionCount = rows.filter((row) => row.needsAttention).length;
  const validationGapsCount = rows.reduce((sum, row) => sum + row.validationGapsCount, 0);

  if (!primaryFocus) {
    return {
      headline: "No open opportunities",
      subline: "Opportunity understanding will appear as deals are added.",
      requiresAttentionCount: 0,
      validationGapsCount: 0,
      primaryFocus: null,
    };
  }

  if (requiresAttentionCount === 0) {
    return {
      headline: "Understanding is stable across the portfolio",
      subline: `${rows.length} opportunit${rows.length === 1 ? "y" : "ies"} ranked below.`,
      requiresAttentionCount: 0,
      validationGapsCount,
      primaryFocus,
    };
  }

  const headline =
    validationGapsCount > 0
      ? `${requiresAttentionCount} require attention · ${validationGapsCount} validation gap${validationGapsCount === 1 ? "" : "s"}`
      : `${requiresAttentionCount} require attention`;

  return {
    headline,
    subline: `${rows.length} opportunit${rows.length === 1 ? "y" : "ies"} ranked below — detail in table.`,
    requiresAttentionCount,
    validationGapsCount,
    primaryFocus,
  };
}

export function buildOpportunityOperationsWorkspace(
  pipelines: PipelineRow[],
  companies: Company[],
  activities: Activity[],
  commercialPackages: CommercialPackage[],
  user: AuthUser,
): OpportunityOperationsWorkspace {
  const active = pipelines.filter(
    (p) => p.status !== "Live Production" && p.status !== "Scheduled Maintenance",
  );

  const intelligences = active.map((deal) =>
    computeOpportunityIntelligence(deal, companies, activities, pipelines),
  );

  const valueThreshold =
    [...active].sort((a, b) => b.salesValue - a.salesValue)[
      Math.max(0, Math.floor(active.length * 0.25) - 1)
    ]?.salesValue ?? 0;

  const attentionItems = buildAttentionItems({
    companies,
    pipelines,
    activities,
    commercialPackages,
  }).filter((item) => item.status === "open");

  const rows = active.map((deal, index) => {
    const intelligence = intelligences[index]!;
    const company = findCompanyForDeal(deal.id, companies);
    const row = buildRow(
      deal,
      intelligence,
      company,
      commercialPackages,
      companies,
      activities,
      pipelines,
      attentionItems,
    );
    row.isHighValue = deal.salesValue >= valueThreshold && deal.salesValue > 0;
    row.isOwnedByUser =
      row.ownerLabel !== null &&
      row.ownerLabel.toLowerCase() === user.displayName.toLowerCase();
    return row;
  });

  const dominantCurrency = active.find((p) => p.currency)?.currency ?? "EUR";
  const totalPipelineValue = rows.reduce((sum, row) => sum + row.salesValue, 0);
  const understanding = buildUnderstandingSnapshot(rows);

  const summary: OpportunityOperationsSummary = {
    totalOpportunities: rows.length,
    totalPipelineValueLabel: formatDealValue(dominantCurrency, totalPipelineValue),
    needsAttentionCount: understanding.requiresAttentionCount,
    closingThisMonthCount: rows.filter((row) => row.isClosingThisMonth).length,
  };

  return { rows, understanding, summary };
}

export function searchOpportunityOperationsRows(
  rows: OpportunityOperationsRow[],
  query: string,
): OpportunityOperationsRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (row) =>
      row.dealName.toLowerCase().includes(q) ||
      row.dealId.toLowerCase().includes(q) ||
      (row.companyName?.toLowerCase().includes(q) ?? false) ||
      row.clientObjective.toLowerCase().includes(q) ||
      row.biggestUnknown.toLowerCase().includes(q) ||
      row.nextStep.toLowerCase().includes(q) ||
      (row.ownerLabel?.toLowerCase().includes(q) ?? false),
  );
}

export function filterOpportunityOperationsByOwner(
  rows: OpportunityOperationsRow[],
  owner: string,
): OpportunityOperationsRow[] {
  if (!owner || owner === "all") return rows;
  const needle = owner.toLowerCase();
  return rows.filter((row) => row.ownerLabel?.toLowerCase() === needle);
}

export function filterOpportunityOperationsByStages(
  rows: OpportunityOperationsRow[],
  stages: string[],
): OpportunityOperationsRow[] {
  if (stages.length === 0) return rows;
  return rows.filter((row) =>
    stages.some((stage) => row.stageLabel.toLowerCase().includes(stage.toLowerCase())),
  );
}

export function filterOpportunityOperationsRows(
  rows: OpportunityOperationsRow[],
  filter: OpportunityOperationsFilter,
  user: AuthUser,
): OpportunityOperationsRow[] {
  switch (filter) {
    case "my_opportunities":
      return rows.filter((row) => row.isOwnedByUser);
    case "my_team":
      return rows.filter((row) => row.ownerLabel && !row.isOwnedByUser);
    case "needs_attention":
      return rows.filter((row) => row.needsAttention);
    case "healthy":
      return rows.filter((row) => row.isHealthy);
    case "closing_soon":
      return rows.filter((row) => row.isClosingSoon || row.isClosingThisMonth);
    case "high_value":
      return rows.filter((row) => row.isHighValue);
    case "all":
    default:
      return rows;
  }
}

export function sortOpportunityOperationsRows(
  rows: OpportunityOperationsRow[],
): OpportunityOperationsRow[] {
  const attentionRank: Record<RecommendedAttention, number> = {
    HIGH: 0,
    MEDIUM: 1,
    LOW: 2,
    HOLD: 3,
  };

  return [...rows].sort((a, b) => {
    const attentionDiff =
      attentionRank[a.recommendedAttention] - attentionRank[b.recommendedAttention];
    if (attentionDiff !== 0) return attentionDiff;
    const gapDiff = b.validationGapsCount - a.validationGapsCount;
    if (gapDiff !== 0) return gapDiff;
    const severityRank: Record<AttentionSeverity, number> = {
      urgent: 0,
      needs_attention: 1,
      waiting: 2,
      healthy: 3,
      completed: 4,
    };
    const severityDiff = severityRank[a.attentionSeverity] - severityRank[b.attentionSeverity];
    if (severityDiff !== 0) return severityDiff;
    return b.salesValue - a.salesValue;
  });
}
