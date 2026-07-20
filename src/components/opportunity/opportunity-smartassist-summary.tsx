"use client";

import Link from "next/link";
import { Bot } from "lucide-react";
import type { CommercialViabilityAssessment } from "@/types/commercial-viability";
import { VIABILITY_RECOMMENDATION_LABELS } from "@/types/commercial-viability";
import { SMARTASSIST_BUSINESS_IMPACT } from "@/lib/smart-assist-config";

export function OpportunitySmartAssistSummary({
  assessment,
  dealName,
}: {
  assessment: CommercialViabilityAssessment;
  dealName: string;
}) {
  const primaryAction = assessment.nextActions[0];
  const fatalCount = assessment.fatalFlawAlerts.length;

  return (
    <section className="dashboard-card border-l-4 border-l-upcycle-orange p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-upcycle-orange/10 text-upcycle-orange">
          <Bot className="size-4" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold uppercase tracking-wider text-upcycle-orange">
            SmartAssist · {dealName}
          </p>
          <p className="mt-1 text-sm font-semibold leading-snug text-carbon-blue">
            {assessment.coreQuestions.shouldInvestResources}
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-carbon-blue/60">
            {assessment.recommendation === "pursue" || assessment.recommendation === "qualify"
              ? `Commercial recommendation: ${VIABILITY_RECOMMENDATION_LABELS[assessment.recommendation]}. Contract probability ${assessment.contractProbabilityLabel}.`
              : `Commercial recommendation: ${VIABILITY_RECOMMENDATION_LABELS[assessment.recommendation]}. Review before investing more resources.`}
            {fatalCount > 0
              ? ` ${fatalCount} fatal flaw${fatalCount === 1 ? "" : "s"} require attention before contract.`
              : ""}
          </p>
          {primaryAction ? (
            <p className="mt-2 text-[11px] font-medium text-upcycle-orange">
              Highest-impact next step: {primaryAction.action}
            </p>
          ) : null}
          <p className="mt-2 text-[9px] text-carbon-blue/35">{SMARTASSIST_BUSINESS_IMPACT.advisorNote}</p>
        </div>
      </div>
    </section>
  );
}
