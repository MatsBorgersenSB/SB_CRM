"use client";

import Link from "next/link";
import type { ActionableRecommendationView } from "@/lib/assistant-actionability";

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
    <article className="dashboard-card overflow-hidden">
      <header className="border-b border-carbon-blue/8 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-carbon-blue/40">
              {recommendation.eyebrow}
            </p>
            <h3 className="mt-1 text-sm font-semibold text-carbon-blue">{recommendation.title}</h3>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${SEVERITY_STYLES[recommendation.severity]}`}
            >
              {recommendation.severity}
            </span>
            {recommendation.confidencePercent !== undefined ? (
              <span className="rounded-full bg-carbon-blue/5 px-2 py-0.5 text-[10px] font-bold tabular-nums text-carbon-blue/55">
                {recommendation.confidencePercent}%
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <dl className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5">
        {(
          [
            ["Why", recommendation.why],
            ["Impact", recommendation.impact],
            ["Recommended action", recommendation.recommendedAction],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className={`min-w-0 ${label === "Recommended action" ? "sm:col-span-2" : ""}`}
          >
            <dt className="text-[9px] font-bold uppercase tracking-[0.1em] text-carbon-blue/35">
              {label}
            </dt>
            <dd
              className={`mt-0.5 text-[11px] leading-relaxed ${
                label === "Recommended action"
                  ? "font-medium text-upcycle-orange"
                  : "text-carbon-blue/70"
              }`}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="border-t border-carbon-blue/8 bg-upcycle-orange/[0.03] px-4 py-3 sm:px-5">
        <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-carbon-blue/35">
          Direct resolution path
        </p>
        <Link
          href={recommendation.resolutionHref}
          className="mt-1.5 inline-flex items-center gap-1.5 border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90"
        >
          {recommendation.resolutionLabel} →
        </Link>
      </div>
    </article>
  );
}
