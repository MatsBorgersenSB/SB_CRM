"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { computeCommercialViability } from "@/lib/commercial-viability-engine";
import { CVM_PRIMARY_QUESTIONS } from "@/lib/cvm-config";
import {
  BUYING_DRIVER_LABELS,
  COMMERCIAL_VIABILITY_DIMENSION_LABELS,
  VIABILITY_RECOMMENDATION_LABELS,
  type ViabilityRecommendation,
} from "@/types/commercial-viability";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { IntelligenceLead } from "@/components/ui/intelligence-lead";

const RECOMMENDATION_STYLES: Record<ViabilityRecommendation, string> = {
  pursue: "border-emerald-500/25 bg-emerald-500/5 text-emerald-800",
  qualify: "border-amber-500/25 bg-amber-500/5 text-amber-900",
  deprioritize: "border-carbon-blue/15 bg-carbon-blue/[0.03] text-carbon-blue/70",
  walk_away: "border-red-500/25 bg-red-500/5 text-red-800",
};

const PATH_STATUS_STYLES = {
  completed: "border-emerald-200 bg-emerald-50/50 text-emerald-800",
  current: "border-carbon-blue/15 bg-carbon-blue/[0.03]",
  recommended: "border-upcycle-orange/30 bg-upcycle-orange/[0.06] text-carbon-blue font-semibold",
  future: "border-carbon-blue/8 text-carbon-blue/40",
} as const;

const PRIMARY_QUESTION_ANSWERS: Record<
  string,
  (q: ReturnType<typeof computeCommercialViability>["coreQuestions"]) => string
> = {
  "Should Standard Bio invest more resources?": (q) => q.shouldInvestResources,
  "Why is this opportunity attractive?": (q) => q.whyAttractive,
  "Why will the customer buy?": (q) => q.whyWillTheyBuy,
  "Can the customer buy?": (q) => q.canTheyBuy,
  "Can the customer implement?": (q) => q.canTheyImplement,
  "Can Standard Bio deliver?": (q) => q.canWeDeliver,
  "Is this worth our resources?": (q) => q.isWorthOurResources,
  "What is preventing a signed contract?": (q) => q.preventingSignedContract,
  "What should we sell next?": (q) => q.whatToSellNext,
  "What is the best revenue path?": (q) => q.bestRevenuePath,
  "What is the fastest path to revenue?": (q) => q.fastestPathToRevenue,
};

const SEVERITY_STYLES = {
  critical: "border-red-300 bg-red-50 text-red-900",
  high: "border-orange-200 bg-orange-50 text-orange-900",
  medium: "border-amber-200 bg-amber-50 text-amber-900",
} as const;

export function CommercialViabilityPanel({
  pipeline,
  companies,
  activities,
  allPipelines,
  commercialPackages,
  variant = "full",
}: {
  pipeline: PipelineRow;
  companies: Company[];
  activities: Activity[];
  allPipelines: PipelineRow[];
  commercialPackages: CommercialPackage[];
  /** `detail` — expert analysis only, for collapsed expanders */
  variant?: "full" | "detail";
}) {
  const assessment = useMemo(
    () =>
      computeCommercialViability(
        pipeline,
        companies,
        activities,
        allPipelines,
        commercialPackages,
      ),
    [pipeline, companies, activities, allPipelines, commercialPackages],
  );

  const { revenuePath, coreQuestions } = assessment;
  const primaryAction = assessment.nextActions[0];

  if (variant === "detail") {
    return (
      <div className="flex flex-col gap-3">
        <CollapsibleSection
          title="Contract readiness breakdown"
          description={`${assessment.contractReadiness.percent}% — ${assessment.contractReadiness.summary}`}
          tier="expert"
        >
          <div className="grid gap-1.5 sm:grid-cols-2">
            {assessment.contractReadiness.builtFrom.map((item) => (
              <div
                key={item.dimensionId}
                className="flex items-center justify-between border border-carbon-blue/8 px-2 py-1.5 text-[10px]"
              >
                <span className="text-carbon-blue/60">{item.label}</span>
                <span className="font-semibold tabular-nums text-carbon-blue">{item.score}</span>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Project maturity"
          description={assessment.projectMaturity.currentStageLabel}
          tier="expert"
        >
          <p className="mb-2 text-[11px] text-carbon-blue/55">{assessment.projectMaturity.summary}</p>
          <div className="space-y-1">
            {assessment.projectMaturity.stages
              .filter((stage) => stage.percentage > 0)
              .map((stage) => (
                <div key={stage.id} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-[10px] text-carbon-blue/50">{stage.label}</span>
                  <div className="h-1.5 flex-1 bg-carbon-blue/[0.06]">
                    <div
                      className="h-full bg-upcycle-orange/70"
                      style={{ width: `${stage.percentage}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-[10px] font-semibold tabular-nums text-carbon-blue/60">
                    {stage.percentage}%
                  </span>
                </div>
              ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Revenue path"
          description={revenuePath.whatToSellNext}
          tier="expert"
        >
          <p className="text-[11px] text-carbon-blue/60">{coreQuestions.bestRevenuePath}</p>
          <p className="mt-1 text-[11px] text-carbon-blue/55">
            Fastest path: {coreQuestions.fastestPathToRevenue}
          </p>
          <div className="mt-3 space-y-1">
            {revenuePath.sequence.map((step) => (
              <div
                key={step.id}
                className={`flex items-center justify-between border px-2.5 py-1.5 text-[10px] ${PATH_STATUS_STYLES[step.status]}`}
              >
                <span>{step.label}</span>
                <span className="tabular-nums text-[9px] opacity-70">
                  {step.status === "completed"
                    ? "Done"
                    : step.status === "recommended"
                      ? `${step.probability}%`
                      : step.status === "current"
                        ? "Active"
                        : ""}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {assessment.fatalFlawAlerts.length > 0 ? (
          <CollapsibleSection
            title={`Fatal flaw analysis (${assessment.fatalFlawAlerts.length})`}
            tier="expert"
          >
            <div className="space-y-2">
              {assessment.fatalFlawAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`border px-3 py-2.5 text-[11px] ${SEVERITY_STYLES[alert.severity]}`}
                >
                  <p className="font-semibold">❌ {alert.label}</p>
                  <p className="mt-0.5 opacity-85">{alert.detail}</p>
                  <p className="mt-1.5 text-[10px] font-medium">→ {alert.recommendedAction}</p>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        ) : null}

        {assessment.detectedBuyingDrivers.length > 0 ? (
          <CollapsibleSection title="Buying drivers" tier="nice-to-have">
            <div className="flex flex-wrap gap-1.5">
              {assessment.detectedBuyingDrivers.map((driver) => (
                <span
                  key={driver}
                  className="border border-carbon-blue/10 bg-carbon-blue/[0.03] px-2 py-0.5 text-[10px] text-carbon-blue/70"
                >
                  {BUYING_DRIVER_LABELS[driver]}
                </span>
              ))}
            </div>
          </CollapsibleSection>
        ) : null}

        {assessment.risks.length > 0 ? (
          <CollapsibleSection
            title={`${assessment.risks.length} risk${assessment.risks.length === 1 ? "" : "s"}`}
            tier="nice-to-have"
          >
            <ul className="space-y-2">
              {assessment.risks.map((risk, index) => (
                <li
                  key={index}
                  className="border border-amber-200/60 bg-amber-50/50 px-3 py-2 text-[11px] text-amber-900"
                >
                  <p className="font-semibold">{risk.label}</p>
                  <p className="mt-0.5 opacity-80">{risk.detail}</p>
                </li>
              ))}
            </ul>
          </CollapsibleSection>
        ) : null}

        <CollapsibleSection
          title="13 CVM scoring dimensions"
          description="Commercial decision engine"
          tier="expert"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {assessment.dimensions.map((dim) => (
              <div key={dim.id} className="border border-carbon-blue/10 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold text-carbon-blue">
                    {COMMERCIAL_VIABILITY_DIMENSION_LABELS[dim.id]}
                  </p>
                  <span className="text-[10px] font-bold tabular-nums text-carbon-blue/55">
                    {dim.score}
                  </span>
                </div>
                <p className="mt-0.5 text-[9px] font-medium text-carbon-blue/40">{dim.scoreLabel}</p>
                <p className="mt-1 text-[10px] leading-relaxed text-carbon-blue/50">{dim.summary}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Primary questions" tier="expert">
          <dl className="space-y-2.5 text-[11px]">
            {CVM_PRIMARY_QUESTIONS.map((question) => (
              <div key={question}>
                <dt className="font-semibold text-carbon-blue/60">{question}</dt>
                <dd className="text-carbon-blue/80">
                  {PRIMARY_QUESTION_ANSWERS[question]?.(coreQuestions) ?? "—"}
                </dd>
              </div>
            ))}
          </dl>
        </CollapsibleSection>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <IntelligenceLead
        eyebrow={`CVM v${assessment.moduleVersion} · ${assessment.engineLabel}`}
        title={pipeline.assetName ?? pipeline.id}
        summary={coreQuestions.shouldInvestResources}
        vitals={[
          { label: "Viability", value: `${assessment.viabilityScore}/100` },
          { label: "Contract prob.", value: assessment.contractProbabilityLabel },
          {
            label: "Contract readiness",
            value: `${assessment.contractReadiness.percent}%`,
            highlight: assessment.contractReadiness.percent < 50,
          },
          {
            label: "Purchase window",
            value: assessment.estimatedPurchaseWindow,
          },
        ]}
        action={
          primaryAction ? (
            <Link
              href={primaryAction.href}
              className="text-sm font-semibold text-upcycle-orange hover:underline"
            >
              {primaryAction.action} →
            </Link>
          ) : undefined
        }
      />

      <p className="text-[10px] font-medium text-carbon-blue/50">
        {assessment.businessModelLabel} · North star:{" "}
        {assessment.northStar.join(" → ")}
      </p>

      <section
        className={`border px-4 py-3 ${RECOMMENDATION_STYLES[assessment.recommendation]}`}
      >
        <p className="text-[9px] font-bold uppercase tracking-wider opacity-70">Recommendation</p>
        <p className="mt-1 text-sm font-semibold">
          {VIABILITY_RECOMMENDATION_LABELS[assessment.recommendation]}
        </p>
      </section>

      <section className="border border-carbon-blue/10 px-4 py-3">
        <p className="text-[9px] font-bold uppercase tracking-wider text-carbon-blue/40">
          Contract readiness — {assessment.contractReadiness.question}
        </p>
        <p className="mt-1 text-lg font-bold tabular-nums text-carbon-blue">
          {assessment.contractReadiness.percent}%
        </p>
        <p className="mt-1 text-[11px] text-carbon-blue/55">{assessment.contractReadiness.summary}</p>
        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {assessment.contractReadiness.builtFrom.map((item) => (
            <div
              key={item.dimensionId}
              className="flex items-center justify-between border border-carbon-blue/8 px-2 py-1.5 text-[10px]"
            >
              <span className="text-carbon-blue/60">{item.label}</span>
              <span className="font-semibold tabular-nums text-carbon-blue">{item.score}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="border border-carbon-blue/10 px-4 py-3">
        <p className="text-[9px] font-bold uppercase tracking-wider text-carbon-blue/40">
          Project maturity — {assessment.projectMaturity.question}
        </p>
        <p className="mt-1 text-sm font-semibold text-carbon-blue">
          Current: {assessment.projectMaturity.currentStageLabel}
        </p>
        <p className="mt-1 text-[11px] text-carbon-blue/55">{assessment.projectMaturity.summary}</p>
        <div className="mt-3 space-y-1">
          {assessment.projectMaturity.stages
            .filter((stage) => stage.percentage > 0)
            .map((stage) => (
              <div key={stage.id} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-[10px] text-carbon-blue/50">{stage.label}</span>
                <div className="h-1.5 flex-1 bg-carbon-blue/[0.06]">
                  <div
                    className="h-full bg-upcycle-orange/70"
                    style={{ width: `${stage.percentage}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-[10px] font-semibold tabular-nums text-carbon-blue/60">
                  {stage.percentage}%
                </span>
              </div>
            ))}
        </div>
      </section>

      <section className="border border-upcycle-orange/20 bg-upcycle-orange/[0.03] px-4 py-3">
        <p className="text-[9px] font-bold uppercase tracking-wider text-upcycle-orange">
          Revenue path — what to sell next
        </p>
        <p className="mt-1 text-sm font-semibold text-carbon-blue">
          {revenuePath.whatToSellNext}
        </p>
        <p className="mt-1 text-[11px] text-carbon-blue/60">{coreQuestions.bestRevenuePath}</p>
        <p className="mt-1 text-[11px] text-carbon-blue/55">
          Fastest path: {coreQuestions.fastestPathToRevenue}
        </p>
        <p className="mt-2 text-[10px] text-carbon-blue/45">{revenuePath.ladderToEquipment}</p>

        <div className="mt-3 space-y-1">
          {revenuePath.sequence.map((step) => (
            <div
              key={step.id}
              className={`flex items-center justify-between border px-2.5 py-1.5 text-[10px] ${PATH_STATUS_STYLES[step.status]}`}
            >
              <span>{step.label}</span>
              <span className="tabular-nums text-[9px] opacity-70">
                {step.status === "completed"
                  ? "Done"
                  : step.status === "recommended"
                    ? `${step.probability}%`
                    : step.status === "current"
                      ? "Active"
                      : ""}
              </span>
            </div>
          ))}
        </div>
      </section>

      {assessment.detectedBuyingDrivers.length > 0 ? (
        <section className="border border-carbon-blue/10 px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-wider text-carbon-blue/40">
            Buying drivers
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {assessment.detectedBuyingDrivers.map((driver) => (
              <span
                key={driver}
                className="border border-carbon-blue/10 bg-carbon-blue/[0.03] px-2 py-0.5 text-[10px] text-carbon-blue/70"
              >
                {BUYING_DRIVER_LABELS[driver]}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {assessment.fatalFlawAlerts.length > 0 ? (
        <section className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-red-700">
            Fatal flaw alerts
          </p>
          {assessment.fatalFlawAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`border px-3 py-2.5 text-[11px] ${SEVERITY_STYLES[alert.severity]}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">❌ {alert.label}</p>
                <span className="text-[9px] font-bold uppercase tracking-wide opacity-70">
                  {alert.severity}
                </span>
              </div>
              <p className="mt-0.5 opacity-85">{alert.detail}</p>
              <p className="mt-1.5 text-[10px] font-medium">→ {alert.recommendedAction}</p>
            </div>
          ))}
        </section>
      ) : null}

      {assessment.risks.length > 0 ? (
        <CollapsibleSection
          title={`${assessment.risks.length} risk${assessment.risks.length === 1 ? "" : "s"}`}
          tier="nice-to-have"
        >
          <ul className="space-y-2">
            {assessment.risks.map((risk, index) => (
              <li
                key={index}
                className="border border-amber-200/60 bg-amber-50/50 px-3 py-2 text-[11px] text-amber-900"
              >
                <p className="font-semibold">{risk.label}</p>
                <p className="mt-0.5 opacity-80">{risk.detail}</p>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      ) : null}

      <CollapsibleSection
        title="Next actions"
        description="Highest-impact steps toward signed contract"
        tier="expert"
        defaultOpen
      >
        <ul className="space-y-2">
          {assessment.nextActions.map((action, index) => (
            <li key={index}>
              <Link
                href={action.href}
                className="block border border-carbon-blue/10 px-3 py-2.5 transition-colors hover:border-upcycle-orange/25 hover:bg-upcycle-orange/[0.03]"
              >
                <p className="text-[11px] font-semibold text-carbon-blue">{action.action}</p>
                <p className="mt-0.5 text-[10px] text-carbon-blue/50">{action.reason}</p>
              </Link>
            </li>
          ))}
        </ul>
      </CollapsibleSection>

      <CollapsibleSection
        title="13 CVM scoring dimensions"
        description="Commercial decision engine — not CRM administration"
        tier="expert"
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {assessment.dimensions.map((dim) => (
            <div key={dim.id} className="border border-carbon-blue/10 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold text-carbon-blue">
                  {COMMERCIAL_VIABILITY_DIMENSION_LABELS[dim.id]}
                </p>
                <span className="text-[10px] font-bold tabular-nums text-carbon-blue/55">
                  {dim.score}
                </span>
              </div>
              <p className="mt-0.5 text-[9px] font-medium text-carbon-blue/40">{dim.scoreLabel}</p>
              <p className="mt-1 text-[9px] text-carbon-blue/45">{dim.purpose}</p>
              <p className="mt-1 text-[10px] leading-relaxed text-carbon-blue/50">{dim.summary}</p>
              {dim.questions.length > 0 ? (
                <ul className="mt-1.5 space-y-0.5 text-[9px] text-carbon-blue/40">
                  {dim.questions.map((question) => (
                    <li key={question}>• {question}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Primary questions" tier="expert" defaultOpen>
        <dl className="space-y-2.5 text-[11px]">
          {CVM_PRIMARY_QUESTIONS.map((question) => (
            <div key={question}>
              <dt className="font-semibold text-carbon-blue/60">{question}</dt>
              <dd className="text-carbon-blue/80">
                {PRIMARY_QUESTION_ANSWERS[question]?.(coreQuestions) ?? "—"}
              </dd>
            </div>
          ))}
        </dl>
      </CollapsibleSection>
    </div>
  );
}
