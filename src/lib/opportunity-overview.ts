import type { CommercialPackage } from "@/types/commercial-package";
import { inferCommercialStage } from "@/lib/deal-document-context";
import type { PipelineRow } from "@/types/pipeline";
import {
  formatDealValue,
  formatProbability,
  PIPELINE_STATUSES,
} from "@/types/pipeline";

export type OpportunitySortKey =
  | "value"
  | "expectedCloseDate"
  | "stage"
  | "probability"
  | "id";

export type CloseDateStatus = "overdue" | "due_soon" | "on_track";

export type ProbabilityStatus = "high" | "medium" | "low";

export const CLOSE_DATE_STATUS_ICON: Record<CloseDateStatus, string> = {
  overdue: "🔴",
  due_soon: "🟠",
  on_track: "🟢",
};

export const CLOSE_DATE_STATUS_LABEL: Record<CloseDateStatus, string> = {
  overdue: "Overdue",
  due_soon: "Due Soon",
  on_track: "On Track",
};

export const PROBABILITY_STATUS_ICON: Record<ProbabilityStatus, string> = {
  high: "🟢",
  medium: "🟡",
  low: "🔴",
};

export const PROBABILITY_STATUS_LABEL: Record<ProbabilityStatus, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const DUE_SOON_DAYS = 14;
const PROBABILITY_HIGH = 70;
const PROBABILITY_MEDIUM = 40;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getCloseDateStatus(
  expectedCloseDate: string | undefined,
  referenceDate: Date = new Date(),
): CloseDateStatus | null {
  if (!expectedCloseDate) return null;

  const close = startOfDay(new Date(expectedCloseDate));
  const today = startOfDay(referenceDate);
  const diffDays = Math.floor((close.getTime() - today.getTime()) / 86_400_000);

  if (diffDays < 0) return "overdue";
  if (diffDays <= DUE_SOON_DAYS) return "due_soon";
  return "on_track";
}

export function getProbabilityStatus(probability: number): ProbabilityStatus {
  if (probability >= PROBABILITY_HIGH) return "high";
  if (probability >= PROBABILITY_MEDIUM) return "medium";
  return "low";
}

export function formatExpectedCloseDate(value: string | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function opportunityStageLabel(
  deal: PipelineRow,
  commercialPackages: CommercialPackage[],
): string {
  return inferCommercialStage(deal, commercialPackages);
}

export function sortOpportunities(
  deals: PipelineRow[],
  sortKey: OpportunitySortKey,
  direction: "asc" | "desc",
): PipelineRow[] {
  const factor = direction === "asc" ? 1 : -1;

  return [...deals].sort((a, b) => {
    switch (sortKey) {
      case "value":
        return factor * (a.salesValue - b.salesValue);
      case "expectedCloseDate": {
        const aTime = a.expectedCloseDate
          ? new Date(a.expectedCloseDate).getTime()
          : direction === "asc"
            ? Infinity
            : -Infinity;
        const bTime = b.expectedCloseDate
          ? new Date(b.expectedCloseDate).getTime()
          : direction === "asc"
            ? Infinity
            : -Infinity;
        return factor * (aTime - bTime);
      }
      case "stage":
        return (
          factor *
          (PIPELINE_STATUSES.indexOf(a.status) - PIPELINE_STATUSES.indexOf(b.status))
        );
      case "probability":
        return factor * (a.probability - b.probability);
      case "id":
        return factor * a.id.localeCompare(b.id);
      default:
        return 0;
    }
  });
}

export const OPPORTUNITY_SORT_COLUMNS: Array<{
  key: OpportunitySortKey;
  label: string;
}> = [
  { key: "value", label: "Value" },
  { key: "expectedCloseDate", label: "Expected Close" },
  { key: "stage", label: "Stage" },
  { key: "probability", label: "Probability" },
  { key: "id", label: "Opportunity #" },
];
