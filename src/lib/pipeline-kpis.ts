import type { PipelineRow, PipelineLifecycleStage } from "@/types/pipeline";
import { formatDealValue, getLifecycleStage } from "@/types/pipeline";

export type DealFunnelBreakdown = Record<PipelineLifecycleStage, number>;

export type ExecutivePipelineKpis = {
  totalWeightedPipelineValue: number;
  totalWeightedPipelineValueLabel: string;
  dealFunnel: DealFunnelBreakdown;
  totalContractedFleetCapacity: number;
  activeSystemCount: number;
};

const ACTIVE_STATUSES = new Set([
  "Prospecting",
  "Feedstock Analysis",
  "Contract Negotiation",
  "Reactor Manufacturing",
  "Site Installation",
  "Commissioning Phase",
  "Live Production",
]);

export function computeExecutivePipelineKpis(
  pipelines: PipelineRow[],
): ExecutivePipelineKpis {
  let totalWeightedPipelineValue = 0;
  let totalContractedFleetCapacity = 0;
  let activeSystemCount = 0;

  const dealFunnel: DealFunnelBreakdown = {
    sales: 0,
    delivery: 0,
    production: 0,
  };

  for (const row of pipelines) {
    totalWeightedPipelineValue += row.salesValue * (row.probability / 100);
    dealFunnel[getLifecycleStage(row.status)] += 1;

    if (ACTIVE_STATUSES.has(row.status) && row.reactorDesignCapacity > 0) {
      totalContractedFleetCapacity += row.reactorDesignCapacity;
      activeSystemCount += 1;
    }
  }

  const dominantCurrency =
    pipelines.find((row) => row.currency)?.currency ?? "EUR";

  return {
    totalWeightedPipelineValue,
    totalWeightedPipelineValueLabel: formatDealValue(
      dominantCurrency,
      Math.round(totalWeightedPipelineValue),
    ),
    dealFunnel,
    totalContractedFleetCapacity,
    activeSystemCount,
  };
}
