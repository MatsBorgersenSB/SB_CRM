"use client";

import type { WorkspaceArchitectDesign } from "@/types/workspace-architect";
import { ConfigRecommendationCard } from "@/components/administration/config-recommendation-card";
import { WORKSPACE_ARCHITECT } from "@/lib/smart-assist-config";

function ReadinessBadge({ score }: { score: number }) {
  const tone =
    score >= 85
      ? "border-upcycle-orange/30 bg-upcycle-orange/10 text-upcycle-orange"
      : score >= 65
        ? "border-carbon-blue/15 bg-carbon-blue/[0.04] text-carbon-blue"
        : "border-thermal-red/25 bg-thermal-red/[0.06] text-thermal-red";

  return (
    <span className={`border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${tone}`}>
      {score}% ready
    </span>
  );
}

export function WorkspaceDesignPreviewPanel({
  design,
  onApprove,
  approving,
}: {
  design: WorkspaceArchitectDesign;
  onApprove?: () => void;
  approving?: boolean;
}) {
  return (
    <div className="flex flex-col gap-5 border border-upcycle-orange/20 bg-upcycle-orange/[0.03] p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-upcycle-orange">
            SmartAssist · Workspace Design
          </p>
          <h3 className="mt-1 text-base font-semibold text-carbon-blue">{design.readinessLabel}</h3>
        </div>
        <ReadinessBadge score={design.readinessScore} />
      </header>

      <p className="text-sm leading-relaxed text-carbon-blue/70">{design.businessSummary}</p>
      <p className="text-[13px] text-carbon-blue/55">
        <span className="font-medium text-carbon-blue">Objective: </span>
        {design.workspaceObjective}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {design.vitals.map((vital) => (
          <div
            key={vital.label}
            className={`border px-3 py-2 ${
              vital.highlight
                ? "border-upcycle-orange/25 bg-white"
                : "border-carbon-blue/10 bg-white/80"
            }`}
          >
            <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              {vital.label}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-carbon-blue">{vital.value}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          Architecture layers
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {design.layers.map((layer) => (
            <article
              key={layer.id}
              className={`border px-3 py-2.5 ${
                layer.configured
                  ? "border-carbon-blue/10 bg-white"
                  : "border-upcycle-orange/20 bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-carbon-blue">{layer.label}</p>
                <span className="text-[9px] font-bold uppercase tracking-wider text-carbon-blue/45">
                  {layer.configured ? "Aligned" : "Configure"}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/60">{layer.summary}</p>
            </article>
          ))}
        </div>
      </div>

      {design.recommendations.length > 0 ? (
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Recommended actions
          </p>
          <div className="grid gap-3 xl:grid-cols-2">
            {design.recommendations.map((recommendation) => (
              <ConfigRecommendationCard key={recommendation.id} recommendation={recommendation} />
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          Next steps
        </p>
        <ul className="space-y-1.5">
          {design.nextSteps.map((step) => (
            <li key={step} className="text-[12px] text-carbon-blue/65">
              · {step}
            </li>
          ))}
        </ul>
      </div>

      {onApprove ? (
        <div className="border-t border-carbon-blue/10 pt-4">
          <p className="mb-3 text-[12px] text-carbon-blue/55">{WORKSPACE_ARCHITECT.mantra}</p>
          <button
            type="button"
            disabled={approving || design.approved}
            onClick={onApprove}
            className="border border-upcycle-orange bg-upcycle-orange px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {design.approved
              ? "Design approved"
              : approving
                ? "Applying…"
                : "Approve workspace design"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
