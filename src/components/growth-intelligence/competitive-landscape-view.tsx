"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { CompetitiveLandscapeSummary } from "@/types/competitive-intelligence";
import { competitiveIntelligenceHref } from "@/types/competitive-intelligence";
import { buildCompetitiveLandscape } from "@/lib/growth-competitive-intelligence-engine";
import { overflowLabel } from "@/lib/signal-extraction";
import { SmartAssistConfidenceLabel } from "@/components/smartassist/smartassist-intelligence-display";
import { WorkspaceIntelContextLayout } from "@/components/ui/workspace-intel-context-layout";
import {
  EDITORIAL_BODY,
  EDITORIAL_FIELD_LABEL,
  EDITORIAL_HERO,
  EDITORIAL_LABEL,
  EDITORIAL_META,
} from "@/lib/editorial-design-system";
import {
  WORKSPACE_INTEL_METRICS_GRID,
  WORKSPACE_PANEL_SURFACE,
  WORKSPACE_SURFACE,
} from "@/lib/workspace-design-system";

const THREAT_COLORS = {
  critical: "text-red-700",
  high: "text-amber-700",
  medium: "text-carbon-blue/60",
  low: "text-carbon-blue/40",
} as const;

const INTENSITY_COLORS = {
  high: "text-red-700",
  medium: "text-amber-700",
  low: "text-carbon-blue/50",
} as const;

export function CompetitiveLandscapeView({
  landscape,
}: {
  landscape: CompetitiveLandscapeSummary;
}) {
  return (
    <div className={WORKSPACE_SURFACE}>
      <WorkspaceIntelContextLayout
        header={
          <header>
            <p className={EDITORIAL_LABEL}>Competitive intelligence</p>
            <h1 className={`mt-2 ${EDITORIAL_HERO}`}>{landscape.headline}</h1>
            <p className={`mt-3 max-w-3xl ${EDITORIAL_BODY}`}>
              Signals only — aggressively filtered. The system does the thinking. You make the decision.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {landscape.focusQuestions.map((question) => (
                <span
                  key={question}
                  className="border border-carbon-blue/10 bg-carbon-blue/[0.03] px-2.5 py-1 text-[11px] font-medium text-carbon-blue/65"
                >
                  {question}
                </span>
              ))}
            </div>
          </header>
        }
        intelligence={
          <>
            <section className={WORKSPACE_PANEL_SURFACE}>
              <p className={EDITORIAL_LABEL}>Landscape pulse</p>
              <div className={`mt-4 ${WORKSPACE_INTEL_METRICS_GRID}`}>
                <Metric label="Competitors tracked" value={landscape.metrics.competitorCount} />
                <Metric label="Critical threats" value={landscape.metrics.criticalThreats} />
                <Metric label="High-intensity markets" value={landscape.metrics.activeMarkets} />
                <Metric label="Recent changes" value={landscape.metrics.recentChanges} />
              </div>
            </section>

            <section className={WORKSPACE_PANEL_SURFACE}>
              <p className={EDITORIAL_LABEL}>What is changing</p>
              <div className="mt-4 space-y-3">
                {landscape.landscapeShifts.map((shift) => (
                  <article key={`${shift.change}-${shift.dateLabel}`} className="border-l-2 border-upcycle-orange/40 pl-3">
                    <p className="text-[13px] font-medium text-carbon-blue">{shift.change}</p>
                    <p className={`mt-1 ${EDITORIAL_META}`}>{shift.implication}</p>
                    <p className={`mt-0.5 ${EDITORIAL_META}`}>{shift.dateLabel}</p>
                  </article>
                ))}
              </div>
            </section>

            {landscape.primaryAction ? (
              <section className={`${WORKSPACE_PANEL_SURFACE} border-upcycle-orange/20 bg-upcycle-orange/[0.03]`}>
                <p className={EDITORIAL_LABEL}>What should happen next</p>
                <p className="mt-3 text-[16px] font-medium text-carbon-blue">{landscape.primaryAction.action}</p>
                <p className={`mt-2 ${EDITORIAL_META}`}>{landscape.primaryAction.why}</p>
                <div className="mt-2">
                  <SmartAssistConfidenceLabel confidence={landscape.primaryAction.confidence} />
                </div>
              </section>
            ) : null}

            <section className={WORKSPACE_PANEL_SURFACE}>
              <p className={EDITORIAL_LABEL}>Top competitors</p>
              <p className={`mt-1 ${EDITORIAL_META}`}>
                {overflowLabel(landscape.competitors.length, landscape.totalCompetitorsIdentified) ??
                  "Ranked by overlap relevance — not a database."}
              </p>
              <div className="mt-4 space-y-3">
                {landscape.competitors.map((competitor) => (
                  <article key={competitor.profile.companyId} className="border border-carbon-blue/8 px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <Link
                          href={competitiveIntelligenceHref(competitor.profile.companyId)}
                          className="text-[15px] font-semibold text-carbon-blue hover:text-upcycle-orange"
                        >
                          {competitor.profile.companyName}
                        </Link>
                        <p className={`mt-0.5 ${EDITORIAL_META}`}>{competitor.profile.positioning}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <SmartAssistConfidenceLabel confidence={competitor.signalAssessment.confidence} />
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${THREAT_COLORS[competitor.profile.threatLevel]}`}>
                          {competitor.profile.threatLevel}
                        </span>
                      </div>
                    </div>

                    <p className={`mt-1 ${EDITORIAL_META}`}>{competitor.signalAssessment.confidenceReason}</p>

                    <p className={`mt-3 ${EDITORIAL_BODY}`}>
                      <span className="text-carbon-blue/40">Why: </span>
                      {competitor.whyWeCompete}
                    </p>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className={EDITORIAL_FIELD_LABEL}>Where</p>
                        <p className={`mt-0.5 ${EDITORIAL_META}`}>
                          {competitor.whereWeCompete.markets.slice(0, 2).join(" · ")}
                        </p>
                      </div>
                      <div>
                        <p className={EDITORIAL_FIELD_LABEL}>How we counter</p>
                        <p className={`mt-0.5 ${EDITORIAL_META}`}>{competitor.howWeCompete.ourCounter}</p>
                      </div>
                    </div>

                    <Link
                      href={competitiveIntelligenceHref(competitor.profile.companyId)}
                      className="mt-3 inline-block text-[12px] font-semibold text-upcycle-orange hover:text-carbon-blue"
                    >
                      Open understanding workspace →
                    </Link>
                  </article>
                ))}
              </div>
            </section>

            {landscape.potentialMissingCompetitors.length > 0 ? (
              <section className={WORKSPACE_PANEL_SURFACE}>
                <p className={EDITORIAL_LABEL}>Potential missing competitors</p>
                <p className={`mt-1 ${EDITORIAL_META}`}>The model is never assumed complete.</p>
                <div className="mt-4 space-y-3">
                  {landscape.potentialMissingCompetitors.map((missing) => (
                    <article key={missing.name} className="border border-carbon-blue/8 px-4 py-3">
                      <p className="text-[14px] font-medium text-carbon-blue">{missing.name}</p>
                      <p className={`mt-1 ${EDITORIAL_META}`}>
                        Status: {missing.status.replace(/_/g, " ")}
                      </p>
                      <p className={`mt-1 ${EDITORIAL_META}`}>{missing.reason}</p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {landscape.nextBestDecisions.length > 1 ? (
              <section className={WORKSPACE_PANEL_SURFACE}>
                <p className={EDITORIAL_LABEL}>Recommended decisions</p>
                <p className={`mt-1 ${EDITORIAL_META}`}>The system recommends — you decide.</p>
                <div className="mt-4 space-y-3">
                  {landscape.nextBestDecisions.map((decision) => (
                    <article key={decision.action} className="border border-carbon-blue/10 bg-carbon-blue/[0.02] px-4 py-3">
                      <p className="text-[14px] font-medium text-carbon-blue">{decision.action}</p>
                      <p className={`mt-2 ${EDITORIAL_META}`}>
                        <span className="text-carbon-blue/40">Why: </span>
                        {decision.why}
                      </p>
                      <p className={`mt-1 ${EDITORIAL_META}`}>
                        <span className="text-carbon-blue/40">Impact: </span>
                        {decision.expectedImpact}
                      </p>
                      <div className="mt-2">
                        <SmartAssistConfidenceLabel confidence={decision.confidence} />
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        }
        context={
          <div className="space-y-5">
            <ContextPanel label="Business understanding">
              <p className={EDITORIAL_BODY}>{landscape.context.business.summary}</p>
              <ul className="mt-3 space-y-1">
                {landscape.context.business.focusAreas.map((area) => (
                  <li key={area} className={EDITORIAL_META}>
                    · {area}
                  </li>
                ))}
              </ul>
              <p className={`mt-2 ${EDITORIAL_META}`}>
                Source: SmartAssist {landscape.context.business.derivedFrom} analysis
              </p>
            </ContextPanel>

            <ContextPanel label="Markets">
              <div className="space-y-3">
                {landscape.context.markets.map((market) => (
                  <article key={market.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[13px] font-medium text-carbon-blue">{market.name}</p>
                      <span className={`text-[10px] font-bold uppercase ${INTENSITY_COLORS[market.competitiveIntensity]}`}>
                        {market.competitiveIntensity}
                      </span>
                    </div>
                    <p className={`mt-0.5 ${EDITORIAL_META}`}>{market.geography}</p>
                    <p className={`mt-1 ${EDITORIAL_META}`}>{market.summary}</p>
                  </article>
                ))}
              </div>
            </ContextPanel>

            <ContextPanel label="Technologies">
              <div className="space-y-3">
                {landscape.context.technologies.map((tech) => (
                  <article key={tech.id}>
                    <p className="text-[13px] font-medium text-carbon-blue">{tech.name}</p>
                    <p className={`mt-0.5 ${EDITORIAL_META}`}>{tech.maturity} · {tech.summary}</p>
                  </article>
                ))}
              </div>
            </ContextPanel>
          </div>
        }
      />
    </div>
  );
}

export function CompetitiveLandscapeViewFromData({
  companies,
  pipelines,
}: {
  companies: Company[];
  pipelines: PipelineRow[];
}) {
  const landscape = useMemo(
    () => buildCompetitiveLandscape(companies, pipelines),
    [companies, pipelines],
  );
  return <CompetitiveLandscapeView landscape={landscape} />;
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className={EDITORIAL_FIELD_LABEL}>{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-carbon-blue">{value}</p>
    </div>
  );
}

function ContextPanel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className={WORKSPACE_PANEL_SURFACE}>
      <p className={EDITORIAL_LABEL}>{label}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}
