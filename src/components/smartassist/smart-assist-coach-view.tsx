"use client";

import Link from "next/link";
import { useMemo } from "react";
import { computeCommercialViability } from "@/lib/commercial-viability-engine";
import {
  COMMERCIAL_VIABILITY_DIMENSION_LABELS,
  REVENUE_PATH_LABELS,
  VIABILITY_RECOMMENDATION_LABELS,
  type CommercialViabilityAssessment,
  type CommercialViabilityBrief,
  type CommercialViabilityDimension,
  type ViabilityRecommendation,
} from "@/types/commercial-viability";
import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";

const STATUS_COLORS: Record<CommercialViabilityDimension["status"], string> = {
  strong: "text-emerald-700 bg-emerald-50",
  moderate: "text-carbon-blue bg-carbon-blue/[0.06]",
  weak: "text-amber-700 bg-amber-50",
  critical: "text-red-700 bg-red-50",
};

const RECOMMENDATION_COLORS: Record<ViabilityRecommendation, string> = {
  pursue: "border-emerald-200 bg-emerald-50 text-emerald-800",
  qualify: "border-amber-200 bg-amber-50 text-amber-900",
  deprioritize: "border-carbon-blue/15 bg-carbon-blue/[0.04] text-carbon-blue/70",
  walk_away: "border-red-200 bg-red-50 text-red-800",
};

const PATH_STATUS_STYLES = {
  completed: "text-emerald-700 bg-emerald-50 border-emerald-100",
  current: "text-carbon-blue bg-carbon-blue/[0.06] border-carbon-blue/15",
  recommended: "text-upcycle-orange bg-upcycle-orange/[0.08] border-upcycle-orange/25 font-semibold",
  future: "text-carbon-blue/40 bg-transparent border-carbon-blue/8",
} as const;

function DimensionRow({ dimension }: { dimension: CommercialViabilityDimension }) {
  return (
    <div className="rounded-lg border border-carbon-blue/8 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold text-carbon-blue">
          {COMMERCIAL_VIABILITY_DIMENSION_LABELS[dimension.id]}
        </p>
        <span
          className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${STATUS_COLORS[dimension.status]}`}
        >
          {dimension.score}
        </span>
      </div>
      <p className="mt-1 text-[10px] leading-relaxed text-carbon-blue/55">{dimension.summary}</p>
      {dimension.criteria && dimension.criteria.length > 0 ? (
        <p className="mt-1 text-[9px] text-carbon-blue/35">
          {dimension.criteria.slice(0, 4).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

export function SmartAssistCoachBrief({
  brief,
  onClick,
}: {
  brief: CommercialViabilityBrief;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-lg border border-carbon-blue/8 px-2.5 py-2 text-left transition-colors hover:border-upcycle-orange/25 hover:bg-upcycle-orange/[0.03]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold text-carbon-blue">{brief.dealName}</p>
          <p className="truncate text-[10px] text-carbon-blue/45">
            {brief.businessModelLabel}
            {brief.companyName ? ` · ${brief.companyName}` : ""}
          </p>
        </div>
        <span className="shrink-0 text-[11px] font-bold tabular-nums text-upcycle-orange">
          {brief.contractProbabilityLabel}
        </span>
      </div>
      <p className="mt-1 text-[10px] font-medium text-upcycle-orange/80">
        Next: {brief.revenuePathNext}
      </p>
      <p className="mt-0.5 text-[9px] text-carbon-blue/40">{brief.projectMaturitySummary}</p>
      {brief.hasFatalFlaws ? (
        <p className="mt-0.5 text-[9px] font-semibold text-red-600">Fatal flaw detected</p>
      ) : null}
    </button>
  );
}

export function SmartAssistCoachDetail({
  assessment,
  onNavigate,
}: {
  assessment: CommercialViabilityAssessment;
  onNavigate: () => void;
}) {
  const { revenuePath, coreQuestions } = assessment;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[9px] font-bold uppercase tracking-wider text-upcycle-orange">
          CVM v{assessment.moduleVersion} · {assessment.engineLabel}
        </p>
        <h3 className="mt-1 text-[13px] font-semibold text-carbon-blue">{assessment.dealName}</h3>
        <p className="text-[10px] text-carbon-blue/45">
          {assessment.businessModelLabel}
          {assessment.companyName ? ` · ${assessment.companyName}` : ""}
        </p>
        <p className="mt-1 text-[9px] text-carbon-blue/40">
          {assessment.northStar.join(" → ")}
        </p>
      </div>

      <div
        className={`rounded-lg border px-3 py-2 ${RECOMMENDATION_COLORS[assessment.recommendation]}`}
      >
        <p className="text-[10px] font-bold uppercase tracking-wide">Recommendation</p>
        <p className="mt-1 text-[11px] font-semibold">
          {VIABILITY_RECOMMENDATION_LABELS[assessment.recommendation]}
        </p>
        <p className="mt-1.5 text-[10px] opacity-85">{coreQuestions.shouldInvestResources}</p>
      </div>

      <div className="rounded-lg border border-upcycle-orange/20 bg-upcycle-orange/[0.04] px-3 py-2.5">
        <p className="text-[9px] font-bold uppercase tracking-wide text-upcycle-orange">
          Revenue path
        </p>
        <p className="mt-1 text-[11px] font-semibold text-carbon-blue">
          Sell next: {revenuePath.whatToSellNext}
        </p>
        <p className="mt-0.5 text-[10px] text-carbon-blue/55">{coreQuestions.bestRevenuePath}</p>
        <p className="mt-0.5 text-[10px] text-carbon-blue/50">
          Fastest: {coreQuestions.fastestPathToRevenue}
        </p>
        <p className="mt-2 text-[9px] text-carbon-blue/40">{revenuePath.ladderToEquipment}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-carbon-blue/8 bg-carbon-blue/[0.02] px-2.5 py-2">
          <p className="text-[9px] font-bold uppercase tracking-wide text-carbon-blue/40">
            Project maturity
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-carbon-blue">
            {assessment.projectMaturity.currentStageLabel}
          </p>
          <p className="mt-0.5 text-[9px] text-carbon-blue/45">{assessment.projectMaturity.summary}</p>
        </div>
        <div className="rounded-lg border border-carbon-blue/8 bg-carbon-blue/[0.02] px-2.5 py-2">
          <p className="text-[9px] font-bold uppercase tracking-wide text-carbon-blue/40">
            Contract readiness
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-carbon-blue">
            {assessment.contractReadiness.percent}%
          </p>
          <p className="mt-0.5 text-[9px] text-carbon-blue/45">{assessment.contractReadiness.summary}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-carbon-blue/8 bg-carbon-blue/[0.02] px-2.5 py-2">
          <p className="text-[9px] font-bold uppercase tracking-wide text-carbon-blue/40">
            Purchase window
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-carbon-blue">
            {assessment.estimatedPurchaseWindow}
          </p>
        </div>
        <div className="rounded-lg border border-carbon-blue/8 bg-carbon-blue/[0.02] px-2.5 py-2">
          <p className="text-[9px] font-bold uppercase tracking-wide text-carbon-blue/40">
            Viability score
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-carbon-blue">
            {assessment.viabilityScore}/100
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-[9px] font-bold uppercase tracking-wider text-carbon-blue/40">
          Path to signed contract
        </p>
        {revenuePath.sequence
          .filter((step) => step.status !== "future")
          .slice(0, 6)
          .map((step) => (
            <div
              key={step.id}
              className={`rounded border px-2 py-1.5 text-[10px] ${PATH_STATUS_STYLES[step.status]}`}
            >
              <span>{step.label}</span>
              {step.status === "recommended" ? (
                <span className="ml-1 text-[9px]">({step.probability}%)</span>
              ) : null}
            </div>
          ))}
      </div>

      {assessment.fatalFlawAlerts.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-red-600/80">Fatal flaws</p>
          {assessment.fatalFlawAlerts.map((alert) => (
            <div key={alert.id} className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2">
              <p className="text-[10px] font-semibold text-red-800">❌ {alert.label}</p>
              <p className="mt-0.5 text-[10px] text-red-700/70">{alert.detail}</p>
              <p className="mt-1 text-[9px] font-medium text-red-800/80">→ {alert.recommendedAction}</p>
            </div>
          ))}
        </div>
      ) : null}

      {assessment.risks.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-carbon-blue/40">Risks</p>
          {assessment.risks.slice(0, 3).map((risk, i) => (
            <div
              key={i}
              className="rounded-lg border border-amber-100 bg-amber-50/50 px-2.5 py-2"
            >
              <p className="text-[10px] font-semibold text-amber-900">{risk.label}</p>
              <p className="mt-0.5 text-[10px] text-amber-800/70">{risk.detail}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <p className="text-[9px] font-bold uppercase tracking-wider text-carbon-blue/40">
          Next actions
        </p>
        {assessment.nextActions.map((action, i) => (
          <Link
            key={i}
            href={action.href}
            onClick={onNavigate}
            className="block rounded-lg border border-carbon-blue/8 px-2.5 py-2 hover:bg-carbon-blue/[0.03]"
          >
            <p className="text-[10px] font-semibold text-carbon-blue">{action.action}</p>
            <p className="mt-0.5 text-[10px] text-carbon-blue/50">{action.reason}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function useCommercialViabilityAssessment(
  dealId: string | null,
  meta: {
    companies: Company[];
    pipelines: PipelineRow[];
    activities: Activity[];
    commercialPackages: CommercialPackage[];
  } | null,
): CommercialViabilityAssessment | null {
  return useMemo(() => {
    if (!dealId || !meta) return null;
    const deal = meta.pipelines.find((row) => row.id === dealId);
    if (!deal) return null;
    return computeCommercialViability(
      deal,
      meta.companies,
      meta.activities,
      meta.pipelines,
      meta.commercialPackages,
    );
  }, [dealId, meta]);
}

export const useCommercialIntelligenceAssessment = useCommercialViabilityAssessment;
