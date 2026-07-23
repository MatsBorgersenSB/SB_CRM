"use client";

import Link from "next/link";
import type { ActionableRecommendationView } from "@/lib/assistant-actionability";
import { ExplainabilityBlock } from "@/components/ui/explainability-block";

const SEVERITY_STYLES = {
  critical: "border-thermal-red/25 bg-thermal-red/[0.04] text-thermal-red",
  warning: "border-upcycle-orange/25 bg-upcycle-orange/[0.05] text-upcycle-orange",
  healthy: "border-carbon-blue/10 bg-carbon-blue/[0.02] text-carbon-blue/55",
} as const;

export function AssistantRecommendationCard({
  recommendation,
}: {
  recommendation: ActionableRecommendationView;
}) {
  return (
    <div className="space-y-0">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2 px-0.5">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
            {recommendation.eyebrow}
          </p>
          <h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
            {recommendation.title}
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${SEVERITY_STYLES[recommendation.severity]}`}
          >
            {recommendation.severity}
          </span>
        </div>
      </div>

      <ExplainabilityBlock
        observation={recommendation.why}
        reasoning={recommendation.impact}
        recommendedAction={recommendation.recommendedAction}
        expectedOutcome={recommendation.expectedOutcome}
        footer={
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Direct resolution path
            </p>
            <Link
              href={recommendation.resolutionHref}
              className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90"
            >
              {recommendation.resolutionLabel} →
            </Link>
          </div>
        }
      />
    </div>
  );
}
