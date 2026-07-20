"use client";

import type { ProjectIntelligence } from "@/types/project";
import { HealthStatusIcon } from "@/components/ui/smartcrm-icon";
import { PROJECT_WORKSPACE_LIGHT } from "@/lib/smart-assist-config";

export function ProjectIntelligenceSection({
  intelligence,
}: {
  intelligence: ProjectIntelligence;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="border border-upcycle-orange/20 bg-upcycle-orange/[0.04] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-upcycle-orange">
            SmartAssist Project Intelligence
          </p>
          <span className="text-[10px] text-carbon-blue/40">
            {PROJECT_WORKSPACE_LIGHT.roles.join(" · ")}
          </span>
        </div>
        <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-carbon-blue/80">
          <HealthStatusIcon status={intelligence.healthLabel} size="sm" className="mt-0.5" />
          <span>{intelligence.summary}</span>
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <InsightCard title="What changed?" body={intelligence.whatChanged} />
        <InsightCard title="What requires attention?" body={intelligence.requiresAttention} accent />
        <InsightCard title="What should happen next?" body={intelligence.recommendedNext} />
        <InsightCard title="Biggest risk" body={intelligence.biggestRisk} />
        <InsightCard title="Biggest opportunity" body={intelligence.biggestOpportunity} />
      </div>
    </div>
  );
}

function InsightCard({
  title,
  body,
  accent = false,
}: {
  title: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`border p-4 ${
        accent
          ? "border-upcycle-orange/25 bg-upcycle-orange/[0.03]"
          : "border-carbon-blue/10 bg-white"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-carbon-blue/40">
        {title}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-carbon-blue/75">{body}</p>
    </div>
  );
}
