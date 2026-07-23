import type { SignalStatus, SignalType } from "@/generated/prisma";

export type AccountHealthIndexView = {
  id: string;
  companyId: string;
  companyName: string;
  healthScore: number;
  engagementScore: number;
  sentimentScore: number;
  calculatedAt: string;
};

export type ExpansionSignalView = {
  id: string;
  companyId: string;
  companyName: string;
  opportunityId: string | null;
  opportunityName: string | null;
  type: SignalType;
  status: SignalStatus;
  title: string;
  observation: string;
  reasoning: string;
  recommendation: string;
  expectedOutcome: string;
  createdAt: string;
  updatedAt: string;
};

export type WhitespaceCoverage = "pitched" | "partial" | "unpitched";

export type WhitespaceMatrixCell = {
  companyId: string;
  companyName: string;
  categoryId: string;
  categoryLabel: string;
  coverage: WhitespaceCoverage;
  observation: string;
  reasoning: string;
  recommendation: string;
  expectedOutcome: string;
};

export type GrowthIntelligenceWorkspaceData = {
  healthRecords: AccountHealthIndexView[];
  signals: ExpansionSignalView[];
  whitespace: WhitespaceMatrixCell[];
  source: "prisma" | "empty";
};

export type ExpansionSignalFilter =
  | "all"
  | "upsell"
  | "cross_sell"
  | "churn_risk";

export const EXPANSION_SIGNAL_FILTERS: Array<{
  id: ExpansionSignalFilter;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "upsell", label: "Upsell" },
  { id: "cross_sell", label: "Cross-Sell" },
  { id: "churn_risk", label: "Churn Risk" },
];

/** AD-001 / UI: renewal_risk + churn_risk both surface under Churn Risk filter. */
export function signalMatchesFilter(
  type: SignalType,
  filter: ExpansionSignalFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "churn_risk") {
    return type === "churn_risk" || type === "renewal_risk";
  }
  return type === filter;
}

export function healthBand(score: number): "strong" | "stable" | "at_risk" | "critical" {
  if (score >= 75) return "strong";
  if (score >= 50) return "stable";
  if (score >= 25) return "at_risk";
  return "critical";
}

export function healthBandLabel(band: ReturnType<typeof healthBand>): string {
  switch (band) {
    case "strong":
      return "Strong";
    case "stable":
      return "Stable";
    case "at_risk":
      return "At risk";
    default:
      return "Critical";
  }
}
