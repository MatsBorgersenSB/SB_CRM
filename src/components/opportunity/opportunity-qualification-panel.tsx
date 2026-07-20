"use client";

import Link from "next/link";
import type { OpportunityQualification } from "@/types/opportunity-qualification";
import { QUALIFICATION_TIER_META } from "@/types/opportunity-qualification";

const TIER_STYLES = {
  A: "border-green-500/40 bg-green-500/[0.04]",
  B: "border-upcycle-orange/40 bg-upcycle-orange/[0.04]",
  C: "border-amber-500/30 bg-amber-500/[0.04]",
  D: "border-carbon-blue/15 bg-carbon-blue/[0.02]",
} as const;

export function OpportunityQualificationPanel({
  qualification,
  compact,
}: {
  qualification: OpportunityQualification;
  compact?: boolean;
}) {
  const tierMeta = QUALIFICATION_TIER_META[qualification.tier];

  if (compact) {
    return (
      <section className={`dashboard-card border-l-4 border-l-upcycle-orange p-4 sm:p-5 ${TIER_STYLES[qualification.tier]}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-upcycle-orange">
              Opportunity Qualification
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-carbon-blue">
              {qualification.qualificationScore}
              <span className="ml-1 text-sm font-medium text-carbon-blue/40">/ 100</span>
            </p>
          </div>
          <div className="text-right">
            <p className={`text-sm font-bold ${tierMeta.color}`}>{tierMeta.label}</p>
            <p className="mt-0.5 text-[10px] text-carbon-blue/45">{qualification.confidencePercent}% confidence</p>
          </div>
        </div>
        <p className="mt-2 text-[12px] font-semibold text-carbon-blue">
          {qualification.recommendedAction}
        </p>
        <p className="mt-1 text-[11px] text-carbon-blue/55">{qualification.actionReason}</p>
      </section>
    );
  }

  return (
    <section className={`dashboard-card p-4 sm:p-5 ${TIER_STYLES[qualification.tier]}`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-carbon-blue/40">
            Opportunity Qualification Engine
          </p>
          <h2 className="mt-1 text-sm font-semibold text-carbon-blue">{qualification.dealName}</h2>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold tabular-nums text-carbon-blue">
            {qualification.qualificationScore}
          </p>
          <p className="text-[10px] text-carbon-blue/45">Qualification score</p>
        </div>
      </header>

      <div className="mt-4 flex flex-wrap gap-3">
        <Badge label="Tier" value={tierMeta.label} highlight className={tierMeta.color} />
        <Badge label="Priority" value={qualification.priority} />
        <Badge label="Commercial potential" value={qualification.commercialPotentialLabel} />
        <Badge label="Confidence" value={`${qualification.confidencePercent}%`} />
      </div>

      <p className="mt-2 text-[11px] text-carbon-blue/55">{tierMeta.description}</p>

      {qualification.discourageUnpaidConsulting ? (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
            Paid services required
          </p>
          <p className="mt-1 text-[11px] text-amber-900/80">{qualification.paidService.recommendation}</p>
          <p className="mt-1 text-[10px] text-amber-900/60">{qualification.paidService.rationale}</p>
          {qualification.paidService.triggers.length > 0 ? (
            <ul className="mt-2 space-y-0.5">
              {qualification.paidService.triggers.map((t) => (
                <li key={t} className="text-[10px] text-amber-900/70">· {t}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 border-l-2 border-upcycle-orange/40 pl-3">
        <p className="text-[9px] font-bold uppercase tracking-wider text-upcycle-orange/80">
          Recommended next action
        </p>
        <p className="mt-1 text-[13px] font-semibold text-carbon-blue">
          {qualification.recommendedAction}
        </p>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          <ActionField label="Why" value={qualification.actionReason} />
          <ActionField label="Who" value={qualification.actionOwner} />
          <ActionField label="When" value={qualification.actionWhen} />
          <ActionField label="Expected outcome" value={qualification.expectedOutcome} />
        </dl>
      </div>

      {!compact ? (
        <details className="mt-4 group">
          <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40 hover:text-upcycle-orange">
            12 qualification dimensions
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {qualification.dimensions.map((dim) => (
              <div
                key={dim.id}
                className="rounded-lg border border-carbon-blue/8 px-2.5 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-medium text-carbon-blue">{dim.label}</p>
                  <span className="text-[10px] font-bold tabular-nums text-carbon-blue/60">
                    {dim.score}
                  </span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-carbon-blue/8">
                  <div
                    className="h-full rounded-full bg-upcycle-orange/60"
                    style={{ width: `${dim.score}%` }}
                  />
                </div>
                <p className="mt-1 line-clamp-2 text-[9px] text-carbon-blue/45">{dim.summary}</p>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      <Link
        href={`${qualification.href}?tab=commercial`}
        className="mt-4 inline-block text-[10px] font-semibold text-upcycle-orange hover:underline"
      >
        Full commercial analysis →
      </Link>
    </section>
  );
}

export function OpportunityQualificationBadge({
  score,
  tier,
}: {
  score: number;
  tier: OpportunityQualification["tier"];
}) {
  const tierMeta = QUALIFICATION_TIER_META[tier];
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-semibold ${TIER_STYLES[tier]}`}
      title={tierMeta.description}
    >
      <span className={`${tierMeta.color}`}>Tier {tier}</span>
      <span className="tabular-nums text-carbon-blue/60">{score}</span>
    </span>
  );
}

function Badge({
  label,
  value,
  highlight,
  className = "",
}: {
  label: string;
  value: string;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div className="rounded-lg border border-carbon-blue/10 px-2.5 py-1.5">
      <p className="text-[8px] font-bold uppercase tracking-wider text-carbon-blue/35">{label}</p>
      <p className={`text-[11px] font-semibold capitalize ${highlight ? className : "text-carbon-blue"}`}>
        {value}
      </p>
    </div>
  );
}

function ActionField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[9px] font-bold uppercase tracking-wider text-carbon-blue/35">{label}</dt>
      <dd className="mt-0.5 text-[11px] leading-snug text-carbon-blue/70">{value}</dd>
    </div>
  );
}
