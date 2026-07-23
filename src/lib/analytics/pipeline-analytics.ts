/**
 * FS-014 — Pipeline analytics calculators
 * Deterministic metrics from known deal outcomes — no invented wins/losses.
 */

import { PIPELINE_STATUSES, type PipelineRow, type PipelineStatus } from "@/types/pipeline";
import { daysBetween } from "@/lib/relative-time";

export type AnalyticsDealOutcome = "open" | "won" | "lost" | "other";

/** Normalized deal shape for analytics (pipeline row or Prisma opportunity). */
export type AnalyticsDeal = {
  id: string;
  name: string;
  /** Display / filter stage label */
  stage: string;
  outcome: AnalyticsDealOutcome;
  salesValue: number;
  currency: string;
  /** 0–100 */
  probability: number;
  ownerId?: string | null;
  ownerName?: string | null;
  createdAt?: string | null;
  /** When the deal closed (won/lost), if known */
  closedAt?: string | null;
  expectedCloseDate?: string | null;
  winReason?: string | null;
  lossReason?: string | null;
};

export type ReasonBreakdown = {
  reason: string;
  count: number;
  revenue: number;
};

export type WinLossMetrics = {
  winCount: number;
  lossCount: number;
  closedCount: number;
  winRatePercent: number;
  lossRatePercent: number;
  totalClosedRevenue: number;
  totalWonRevenue: number;
  totalLostRevenue: number;
  winReasons: ReasonBreakdown[];
  lossReasons: ReasonBreakdown[];
};

export type StageConversionRate = {
  stage: string;
  dealCount: number;
  conversionToNextPercent: number | null;
  nextStage: string | null;
};

export type PipelineVelocityMetrics = {
  averageCycleDays: number | null;
  stageConversionRates: StageConversionRate[];
  /** Closed-won revenue / total cycle days across wins */
  pipelineVelocityPerDay: number;
  closedWonCount: number;
  sampleSize: number;
};

export type WeightedForecastMetrics = {
  totalPipelineValue: number;
  weightedPipelineValue: number;
  openDealCount: number;
  currency: string;
  byStage: Array<{
    stage: string;
    dealCount: number;
    pipelineValue: number;
    weightedValue: number;
  }>;
};

const FUNNEL_STAGES: PipelineStatus[] = [
  "Prospecting",
  "Feedstock Analysis",
  "Contract Negotiation",
  "Won",
];

const WON_STATUSES = new Set<PipelineStatus>([
  "Won",
  "Reactor Manufacturing",
  "Site Installation",
  "Commissioning Phase",
  "Live Production",
  "Scheduled Maintenance",
]);

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

function reasonKey(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function accumulateReasons(
  deals: AnalyticsDeal[],
  pick: (deal: AnalyticsDeal) => string,
): ReasonBreakdown[] {
  const map = new Map<string, ReasonBreakdown>();
  for (const deal of deals) {
    const reason = pick(deal);
    const current = map.get(reason) ?? { reason, count: 0, revenue: 0 };
    current.count += 1;
    current.revenue += deal.salesValue || 0;
    map.set(reason, current);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.revenue - a.revenue);
}

function stageIndex(stage: string): number {
  const asStatus = stage as PipelineStatus;
  const funnelIdx = FUNNEL_STAGES.indexOf(asStatus);
  if (funnelIdx >= 0) return funnelIdx;
  const allIdx = PIPELINE_STATUSES.indexOf(asStatus);
  if (allIdx >= 0) {
    if (WON_STATUSES.has(asStatus)) return FUNNEL_STAGES.indexOf("Won");
    return Math.min(funnelIdx >= 0 ? funnelIdx : 0, FUNNEL_STAGES.length - 1);
  }
  return 0;
}

function cycleDays(deal: AnalyticsDeal): number | null {
  if (!deal.createdAt) return null;
  const end =
    deal.closedAt ||
    (deal.outcome === "open" ? deal.expectedCloseDate : null) ||
    null;
  if (!end) return null;
  const days = daysBetween(deal.createdAt, new Date(end));
  return days >= 0 ? days : null;
}

/**
 * Map a pipeline row into analytics input when Prisma outcome is unavailable.
 * Won / post-won stages → won; everything else → open (losses require explicit outcome).
 */
export function pipelineRowToAnalyticsDeal(row: PipelineRow): AnalyticsDeal {
  const outcome: AnalyticsDealOutcome = WON_STATUSES.has(row.status) ? "won" : "open";
  return {
    id: row.id,
    name: row.assetName,
    stage: row.status,
    outcome,
    salesValue: row.salesValue ?? 0,
    currency: row.currency || "EUR",
    probability: row.probability ?? 0,
    ownerId: row.opportunityOwner ? String(row.opportunityOwner.Id) : null,
    ownerName: row.opportunityOwner?.Title ?? null,
    expectedCloseDate: row.expectedCloseDate ?? null,
    winReason: outcome === "won" ? row.currentMilestone || "Closed won" : null,
    lossReason: null,
  };
}

export function calculateWinLossMetrics(deals: AnalyticsDeal[]): WinLossMetrics {
  const wins = deals.filter((deal) => deal.outcome === "won");
  const losses = deals.filter((deal) => deal.outcome === "lost");
  const closedCount = wins.length + losses.length;

  const totalWonRevenue = wins.reduce((sum, deal) => sum + (deal.salesValue || 0), 0);
  const totalLostRevenue = losses.reduce((sum, deal) => sum + (deal.salesValue || 0), 0);

  return {
    winCount: wins.length,
    lossCount: losses.length,
    closedCount,
    winRatePercent: closedCount === 0 ? 0 : clampPercent((wins.length / closedCount) * 100),
    lossRatePercent: closedCount === 0 ? 0 : clampPercent((losses.length / closedCount) * 100),
    totalClosedRevenue: totalWonRevenue + totalLostRevenue,
    totalWonRevenue,
    totalLostRevenue,
    winReasons: accumulateReasons(wins, (deal) =>
      reasonKey(deal.winReason, "Closed won — reason not recorded"),
    ),
    lossReasons: accumulateReasons(losses, (deal) =>
      reasonKey(deal.lossReason, "Closed lost — reason not recorded"),
    ),
  };
}

export function calculatePipelineVelocity(deals: AnalyticsDeal[]): PipelineVelocityMetrics {
  const closed = deals.filter((deal) => deal.outcome === "won" || deal.outcome === "lost");
  const cycleSamples = closed
    .map((deal) => ({ deal, days: cycleDays(deal) }))
    .filter((row): row is { deal: AnalyticsDeal; days: number } => row.days != null);

  const averageCycleDays =
    cycleSamples.length === 0
      ? null
      : Math.round(
          (cycleSamples.reduce((sum, row) => sum + row.days, 0) / cycleSamples.length) * 10,
        ) / 10;

  const winsWithCycle = cycleSamples.filter((row) => row.deal.outcome === "won");
  const wonRevenue = winsWithCycle.reduce((sum, row) => sum + (row.deal.salesValue || 0), 0);
  const wonDays = winsWithCycle.reduce((sum, row) => sum + row.days, 0);
  const pipelineVelocityPerDay =
    wonDays > 0 ? Math.round((wonRevenue / wonDays) * 100) / 100 : 0;

  const reachedOrBeyond = (minIndex: number) =>
    deals.filter((deal) => {
      if (deal.outcome === "lost") {
        return stageIndex(deal.stage) >= minIndex;
      }
      return stageIndex(deal.stage) >= minIndex || deal.outcome === "won";
    }).length;

  const stageConversionRates: StageConversionRate[] = FUNNEL_STAGES.map((stage, index) => {
    const dealCount = reachedOrBeyond(index);
    const nextStage = FUNNEL_STAGES[index + 1] ?? null;
    const nextCount = nextStage ? reachedOrBeyond(index + 1) : null;
    const conversionToNextPercent =
      nextCount == null || dealCount === 0
        ? null
        : clampPercent((nextCount / dealCount) * 100);

    return {
      stage,
      dealCount,
      conversionToNextPercent,
      nextStage,
    };
  });

  return {
    averageCycleDays,
    stageConversionRates,
    pipelineVelocityPerDay,
    closedWonCount: winsWithCycle.length,
    sampleSize: cycleSamples.length,
  };
}

export function calculateWeightedForecast(deals: AnalyticsDeal[]): WeightedForecastMetrics {
  const open = deals.filter((deal) => deal.outcome === "open");
  const currency =
    open.find((deal) => deal.currency)?.currency ||
    deals.find((deal) => deal.currency)?.currency ||
    "EUR";

  const totalPipelineValue = open.reduce((sum, deal) => sum + (deal.salesValue || 0), 0);
  const weightedPipelineValue = open.reduce(
    (sum, deal) => sum + (deal.salesValue || 0) * ((deal.probability || 0) / 100),
    0,
  );

  const byStageMap = new Map<
    string,
    { stage: string; dealCount: number; pipelineValue: number; weightedValue: number }
  >();

  for (const deal of open) {
    const stage = deal.stage || "Unknown";
    const current = byStageMap.get(stage) ?? {
      stage,
      dealCount: 0,
      pipelineValue: 0,
      weightedValue: 0,
    };
    current.dealCount += 1;
    current.pipelineValue += deal.salesValue || 0;
    current.weightedValue += (deal.salesValue || 0) * ((deal.probability || 0) / 100);
    byStageMap.set(stage, current);
  }

  const byStage = [...byStageMap.values()].sort(
    (a, b) => b.pipelineValue - a.pipelineValue,
  );

  return {
    totalPipelineValue: Math.round(totalPipelineValue * 100) / 100,
    weightedPipelineValue: Math.round(weightedPipelineValue * 100) / 100,
    openDealCount: open.length,
    currency,
    byStage,
  };
}

export type AnalyticsOverview = {
  winLoss: WinLossMetrics;
  velocity: PipelineVelocityMetrics;
  forecast: WeightedForecastMetrics;
  dealCount: number;
  generatedAt: string;
};

export function buildAnalyticsOverview(deals: AnalyticsDeal[]): AnalyticsOverview {
  return {
    winLoss: calculateWinLossMetrics(deals),
    velocity: calculatePipelineVelocity(deals),
    forecast: calculateWeightedForecast(deals),
    dealCount: deals.length,
    generatedAt: new Date().toISOString(),
  };
}

export type AnalyticsExportFilters = {
  from?: string | null;
  to?: string | null;
  stage?: string | null;
  owner?: string | null;
};

export function filterAnalyticsDeals(
  deals: AnalyticsDeal[],
  filters: AnalyticsExportFilters,
): AnalyticsDeal[] {
  const fromTs = filters.from ? new Date(filters.from).getTime() : null;
  const toTs = filters.to ? new Date(filters.to).getTime() : null;
  const stage = filters.stage?.trim().toLowerCase() || null;
  const owner = filters.owner?.trim().toLowerCase() || null;

  return deals.filter((deal) => {
    if (stage && deal.stage.toLowerCase() !== stage) return false;
    if (owner) {
      const ownerLabel = `${deal.ownerName ?? ""} ${deal.ownerId ?? ""}`.toLowerCase();
      if (!ownerLabel.includes(owner)) return false;
    }

    const anchor = deal.closedAt || deal.expectedCloseDate || deal.createdAt;
    if (!anchor) return fromTs == null && toTs == null;
    const ts = new Date(anchor).getTime();
    if (!Number.isFinite(ts)) return true;
    if (fromTs != null && ts < fromTs) return false;
    if (toTs != null && ts > toTs + 24 * 60 * 60 * 1000 - 1) return false;
    return true;
  });
}

/** Escape a CSV cell. */
export function csvEscape(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function dealsToCsv(deals: AnalyticsDeal[]): string {
  const header = [
    "Deal ID",
    "Deal Name",
    "Stage",
    "Outcome",
    "Sales Value",
    "Currency",
    "Probability %",
    "Owner",
    "Created At",
    "Closed At",
    "Expected Close",
    "Win Reason",
    "Loss Reason",
  ].join(",");

  const rows = deals.map((deal) =>
    [
      csvEscape(deal.id),
      csvEscape(deal.name),
      csvEscape(deal.stage),
      csvEscape(deal.outcome),
      csvEscape(deal.salesValue),
      csvEscape(deal.currency),
      csvEscape(deal.probability),
      csvEscape(deal.ownerName || deal.ownerId || ""),
      csvEscape(deal.createdAt),
      csvEscape(deal.closedAt),
      csvEscape(deal.expectedCloseDate),
      csvEscape(deal.winReason),
      csvEscape(deal.lossReason),
    ].join(","),
  );

  return [header, ...rows].join("\n");
}
