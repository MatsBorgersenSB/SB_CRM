import type { PipelineRow } from "@/types/pipeline";
import {
  formatDealValue,
  formatProbability,
  formatReactorCapacity,
  getLifecycleStage,
} from "@/types/pipeline";
import { StatusBadge } from "@/components/ui/status-badge";

const statusVariant = {
  Prospecting: "pending",
  "Feedstock Analysis": "pending",
  "Contract Negotiation": "pending",
  Won: "success",
  "Reactor Manufacturing": "active",
  "Site Installation": "active",
  "Commissioning Phase": "active",
  "Live Production": "success",
  "Scheduled Maintenance": "error",
} as const;

type PipelineDetailProps = {
  pipeline: PipelineRow;
};

export function PipelineDetail({ pipeline }: PipelineDetailProps) {
  const fields = [
    { label: "Enterprise Role", value: pipeline.companyRole },
    { label: "Target Feedstock", value: pipeline.targetFeedstock },
    {
      label: "Design Capacity",
      value: formatReactorCapacity(pipeline.reactorDesignCapacity),
    },
    {
      label: "Deal Value",
      value: formatDealValue(pipeline.currency, pipeline.salesValue),
    },
    { label: "Probability Forecast", value: formatProbability(pipeline.probability) },
    { label: "Milestone Phase-Gate", value: pipeline.currentMilestone },
    { label: "Lifecycle Stage", value: getLifecycleStage(pipeline.status) },
  ];

  return (
    <dl className="grid gap-0 border border-carbon-blue/10">
      <div className="flex items-center justify-between border-b border-carbon-blue/10 px-3 py-2">
        <dt className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          Current Phase-Gate
        </dt>
        <dd>
          <StatusBadge
            label={pipeline.status}
            variant={statusVariant[pipeline.status]}
          />
        </dd>
      </div>
      {fields.map((field) => (
        <div
          key={field.label}
          className="grid grid-cols-[108px_1fr] border-b border-carbon-blue/10 last:border-b-0"
        >
          <dt className="border-r border-carbon-blue/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            {field.label}
          </dt>
          <dd className="px-3 py-2 text-xs text-carbon-blue">{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}
