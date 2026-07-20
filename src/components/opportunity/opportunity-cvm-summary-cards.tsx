"use client";

import type { CommercialViabilityAssessment } from "@/types/commercial-viability";
import { VIABILITY_RECOMMENDATION_LABELS } from "@/types/commercial-viability";

export function OpportunityCvmSummaryCards({
  assessment,
}: {
  assessment: CommercialViabilityAssessment;
}) {
  const fatalCount = assessment.fatalFlawAlerts.length;
  const topFatal = assessment.fatalFlawAlerts[0];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <SummaryCard
        label="Commercial Viability"
        value={`${assessment.viabilityScore}/100`}
        detail={VIABILITY_RECOMMENDATION_LABELS[assessment.recommendation]}
        tone={
          assessment.recommendation === "pursue"
            ? "positive"
            : assessment.recommendation === "walk_away"
              ? "critical"
              : "neutral"
        }
        sub={`Contract probability ${assessment.contractProbabilityLabel}`}
      />
      <SummaryCard
        label="Contract Readiness"
        value={`${assessment.contractReadiness.percent}%`}
        detail={assessment.contractReadiness.summary}
        tone={assessment.contractReadiness.percent < 50 ? "warning" : "neutral"}
        sub={assessment.contractReadiness.question}
      />
      <SummaryCard
        label="Fatal Flaws"
        value={fatalCount === 0 ? "None" : String(fatalCount)}
        detail={
          topFatal
            ? topFatal.label
            : fatalCount === 0
              ? "No blocking commercial flaws detected"
              : `${fatalCount} issue${fatalCount === 1 ? "" : "s"} blocking contract path`}
        tone={fatalCount > 0 ? "critical" : "positive"}
        sub={topFatal?.recommendedAction}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  sub,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  sub?: string;
  tone: "positive" | "warning" | "critical" | "neutral";
}) {
  const border =
    tone === "critical"
      ? "border-red-500/25 bg-red-500/[0.03]"
      : tone === "warning"
        ? "border-amber-500/25 bg-amber-500/[0.03]"
        : tone === "positive"
          ? "border-emerald-500/25 bg-emerald-500/[0.03]"
          : "border-carbon-blue/10 bg-carbon-blue/[0.02]";

  return (
    <article className={`rounded-lg border p-3 ${border}`}>
      <p className="text-[9px] font-bold uppercase tracking-wider text-carbon-blue/40">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-carbon-blue">{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-carbon-blue/70">{detail}</p>
      {sub ? (
        <p className="mt-1 line-clamp-2 text-[10px] text-carbon-blue/45">{sub}</p>
      ) : null}
    </article>
  );
}
