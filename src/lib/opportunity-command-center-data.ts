import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { formatDealValue } from "@/types/pipeline";
import {
  computeOpportunityIntelligence,
  computePortfolioRevenueForecast,
  type OpportunityHealthStatus,
  type OpportunityIntelligence,
  type RevenueForecast,
} from "@/lib/opportunity-intelligence-engine";

export type { RevenueForecast };

export type OpportunityCommandCenterItem = OpportunityIntelligence & {
  href: string;
  subtitle: string;
};

export type OpportunityHealthDistribution = Array<{
  status: OpportunityHealthStatus;
  count: number;
}>;

export type OpportunityCommandCenterSnapshot = {
  generatedAt: string;
  revenueForecast: RevenueForecast;
  healthDistribution: OpportunityHealthDistribution;
  largestOpportunities: OpportunityCommandCenterItem[];
  dealsAtRisk: OpportunityCommandCenterItem[];
  fastestMovingDeals: OpportunityCommandCenterItem[];
  allOpportunities: OpportunityCommandCenterItem[];
};

const HEALTH_ORDER: OpportunityHealthStatus[] = [
  "Strategic",
  "Strong",
  "Healthy",
  "Weak",
  "At Risk",
];

function toCommandCenterItem(intelligence: OpportunityIntelligence): OpportunityCommandCenterItem {
  return {
    ...intelligence,
    href: `/deals/${encodeURIComponent(intelligence.dealId)}`,
    subtitle: [
      intelligence.stage,
      intelligence.companyName ?? "Unlinked",
      formatDealValue(intelligence.currency, intelligence.salesValue),
    ].join(" · "),
  };
}

export function buildOpportunityCommandCenter(
  pipelines: PipelineRow[],
  companies: Company[],
  activities: Activity[],
): OpportunityCommandCenterSnapshot {
  const salesAndDelivery = pipelines.filter(
    (p) => p.status !== "Live Production" && p.status !== "Scheduled Maintenance",
  );

  const intelligences = salesAndDelivery.map((deal) =>
    computeOpportunityIntelligence(deal, companies, activities, pipelines),
  );

  const items = intelligences.map(toCommandCenterItem);
  const dominantCurrency = pipelines.find((p) => p.currency)?.currency ?? "EUR";
  const revenueForecast = computePortfolioRevenueForecast(intelligences, dominantCurrency);

  const healthDistribution = HEALTH_ORDER.map((status) => ({
    status,
    count: items.filter((i) => i.healthStatus === status).length,
  }));

  const largestOpportunities = [...items]
    .sort((a, b) => b.salesValue - a.salesValue)
    .slice(0, 8);

  const dealsAtRisk = items
    .filter(
      (i) =>
        i.healthStatus === "At Risk" ||
        i.healthStatus === "Weak" ||
        i.isAtRiskRevenue ||
        i.momentum === "Stalled",
    )
    .sort((a, b) => a.healthScore - b.healthScore)
    .slice(0, 8);

  const fastestMoving = items
    .filter((i) => i.momentum === "Accelerating")
    .sort((a, b) => b.winProbability - a.winProbability || b.healthScore - a.healthScore)
    .slice(0, 8);

  return {
    generatedAt: new Date().toISOString(),
    revenueForecast,
    healthDistribution,
    largestOpportunities,
    dealsAtRisk,
    fastestMovingDeals: fastestMoving,
    allOpportunities: items,
  };
}

export function formatOpportunityCommandCenterTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
