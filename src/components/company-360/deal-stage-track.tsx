import { PIPELINE_STATUSES, type PipelineStatus } from "@/types/pipeline";
import { getLifecycleStage } from "@/types/pipeline";

const LIFECYCLE_LABELS = {
  sales: "Sales",
  delivery: "Delivery",
  production: "Production",
} as const;

export function DealStageTrack({ status }: { status: PipelineStatus }) {
  const currentIndex = PIPELINE_STATUSES.indexOf(status);
  const lifecycle = getLifecycleStage(status);
  const progress =
    currentIndex >= 0 ? ((currentIndex + 1) / PIPELINE_STATUSES.length) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-upcycle-orange">
          {status}
        </span>
        <span className="text-[9px] font-medium text-carbon-blue/40">
          {LIFECYCLE_LABELS[lifecycle]} phase
        </span>
      </div>

      <div className="relative h-1.5 overflow-hidden bg-carbon-blue/8">
        <div
          className="absolute inset-y-0 left-0 bg-upcycle-orange transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="hidden gap-1 sm:flex">
        {PIPELINE_STATUSES.map((stage, index) => (
          <div
            key={stage}
            className={`h-1 flex-1 ${
              index <= currentIndex ? "bg-upcycle-orange/80" : "bg-carbon-blue/8"
            }`}
            title={stage}
          />
        ))}
      </div>
    </div>
  );
}
