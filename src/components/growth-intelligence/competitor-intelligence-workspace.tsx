"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { CompetitorUnderstanding } from "@/types/competitive-intelligence";
import { competitiveLandscapeHref } from "@/types/competitive-intelligence";
import { buildCompetitorUnderstanding } from "@/lib/growth-competitive-intelligence-engine";
import { SmartAssistCategoryBadge, SmartAssistConfidenceLabel } from "@/components/smartassist/smartassist-intelligence-display";
import { dimensionLabel, type CompetitorOverlapDimension } from "@/lib/signal-extraction";
import { WorkspaceIntelContextLayout } from "@/components/ui/workspace-intel-context-layout";
import {
  EDITORIAL_BODY,
  EDITORIAL_FIELD_LABEL,
  EDITORIAL_GAP_BLOCK,
  EDITORIAL_HERO,
  EDITORIAL_LABEL,
  EDITORIAL_META,
} from "@/lib/editorial-design-system";
import { WORKSPACE_PANEL_SURFACE, WORKSPACE_SURFACE } from "@/lib/workspace-design-system";

const THREAT_COLORS = {
  critical: "text-red-700",
  high: "text-amber-700",
  medium: "text-carbon-blue/60",
  low: "text-carbon-blue/40",
} as const;

export function CompetitorIntelligenceWorkspaceView({
  companyId,
  companies,
  pipelines,
}: {
  companyId: string;
  companies: Company[];
  pipelines: PipelineRow[];
}) {
  const understanding = useMemo(
    () => buildCompetitorUnderstanding(companyId, companies, pipelines),
    [companyId, companies, pipelines],
  );

  if (!understanding) {
    return (
      <div className={WORKSPACE_SURFACE}>
        <Link
          href={competitiveLandscapeHref()}
          className="text-[11px] font-medium text-carbon-blue/45 transition-colors hover:text-upcycle-orange"
        >
          ← Competitive landscape
        </Link>
        <p className="mt-4 text-sm text-carbon-blue/60">Competitor not found.</p>
      </div>
    );
  }

  return (
    <div className={`${WORKSPACE_SURFACE} ${EDITORIAL_GAP_BLOCK}`}>
      <Link
        href={competitiveLandscapeHref()}
        className="text-[11px] font-medium text-carbon-blue/45 transition-colors hover:text-upcycle-orange"
      >
        ← Competitive landscape
      </Link>

      <CompetitorWorkspace understanding={understanding} />
    </div>
  );
}

function CompetitorWorkspace({ understanding }: { understanding: CompetitorUnderstanding }) {
  const { profile } = understanding;

  return (
    <WorkspaceIntelContextLayout
      header={
        <header>
          <p className={EDITORIAL_LABEL}>Competitor understanding</p>
          <h1 className={`mt-2 ${EDITORIAL_HERO}`}>{profile.companyName}</h1>
          <p className={`mt-2 ${EDITORIAL_META}`}>{profile.positioning}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${THREAT_COLORS[profile.threatLevel]}`}>
              {profile.threatLevel} threat · {profile.competitorClass}
            </span>
            {profile.href.startsWith("/companies/") ? (
              <Link href={profile.href} className="text-[11px] font-medium text-upcycle-orange hover:text-carbon-blue">
                View in CRM →
              </Link>
            ) : null}
          </div>
        </header>
      }
      intelligence={
        <>
          <UnderstandingPanel title="Why we compete" content={understanding.whyWeCompete} />

          <section className={WORKSPACE_PANEL_SURFACE}>
            <p className={EDITORIAL_LABEL}>Signal assessment</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SmartAssistConfidenceLabel confidence={understanding.signalAssessment.confidence} />
            </div>
            <p className={`mt-2 ${EDITORIAL_META}`}>{understanding.signalAssessment.confidenceReason}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {(Object.entries(understanding.signalAssessment.overlapScores) as Array<[string, number]>)
                .filter(([key]) => key !== "overall" && key !== "validatedCount")
                .slice(0, 4)
                .map(([key, score]) => (
                  <div key={key}>
                    <p className={EDITORIAL_FIELD_LABEL}>
                      {dimensionLabel(key as CompetitorOverlapDimension)}
                    </p>
                    <p className={`mt-0.5 ${EDITORIAL_BODY}`}>{score}% overlap</p>
                  </div>
                ))}
            </div>
          </section>

          <section className={WORKSPACE_PANEL_SURFACE}>
            <p className={EDITORIAL_LABEL}>Knowledge transparency</p>
            <div className="mt-4 space-y-3">
              {understanding.knowledgeInsights.map((insight) => (
                <article key={insight.id} className="border border-carbon-blue/8 px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {insight.topic ? (
                      <span className="text-[11px] font-medium text-carbon-blue/45">{insight.topic}</span>
                    ) : null}
                    <SmartAssistCategoryBadge category={insight.category} />
                  </div>
                  <p className={`mt-2 ${EDITORIAL_BODY}`}>{insight.statement}</p>
                  {insight.confidenceReason ? (
                    <p className={`mt-1 ${EDITORIAL_META}`}>{insight.confidenceReason}</p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>

          <section className={WORKSPACE_PANEL_SURFACE}>
            <p className={EDITORIAL_LABEL}>Where we compete</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <ListBlock label="Markets" items={understanding.whereWeCompete.markets} />
              <ListBlock label="Geographies" items={understanding.whereWeCompete.geographies} />
              <ListBlock label="Segments" items={understanding.whereWeCompete.segments} />
              {understanding.whereWeCompete.overlappingEvents && understanding.whereWeCompete.overlappingEvents.length > 0 ? (
                <ListBlock label="Shared events" items={understanding.whereWeCompete.overlappingEvents} />
              ) : null}
            </div>
            {understanding.whereWeCompete.overlappingDeals && understanding.whereWeCompete.overlappingDeals.length > 0 ? (
              <p className={`mt-3 ${EDITORIAL_META}`}>
                Pipeline overlap: {understanding.whereWeCompete.overlappingDeals.join(" · ")}
              </p>
            ) : null}
          </section>

          <section className={WORKSPACE_PANEL_SURFACE}>
            <p className={EDITORIAL_LABEL}>How we compete</p>
            <div className="mt-4 space-y-4">
              <div>
                <p className={EDITORIAL_FIELD_LABEL}>Their approach</p>
                <p className={`mt-1 ${EDITORIAL_BODY}`}>{understanding.howWeCompete.theirApproach}</p>
              </div>
              <div>
                <p className={EDITORIAL_FIELD_LABEL}>Our counter-position</p>
                <p className={`mt-1 ${EDITORIAL_BODY}`}>{understanding.howWeCompete.ourCounter}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <ListBlock label="Win when" items={understanding.howWeCompete.winConditions} />
                <ListBlock label="Lose when" items={understanding.howWeCompete.loseConditions} />
              </div>
            </div>
          </section>

          <section className={WORKSPACE_PANEL_SURFACE}>
            <p className={EDITORIAL_LABEL}>What is changing</p>
            <div className="mt-4 space-y-3">
              {understanding.whatsChanging.map((shift) => (
                <article key={`${shift.change}-${shift.dateLabel}`} className="border-l-2 border-upcycle-orange/40 pl-3">
                  <p className="text-[13px] font-medium text-carbon-blue">{shift.change}</p>
                  <p className={`mt-1 ${EDITORIAL_META}`}>{shift.implication}</p>
                  <p className={`mt-0.5 ${EDITORIAL_META}`}>{shift.dateLabel}</p>
                </article>
              ))}
            </div>
          </section>

          <section className={WORKSPACE_PANEL_SURFACE}>
            <p className={EDITORIAL_LABEL}>Next best decision</p>
            <p className={`mt-1 ${EDITORIAL_META}`}>The system recommends — you decide.</p>
            <div className="mt-4 border border-carbon-blue/10 bg-carbon-blue/[0.02] px-4 py-4">
              <p className="text-[15px] font-medium text-carbon-blue">
                {understanding.nextBestDecision.action}
              </p>
              <p className={`mt-3 ${EDITORIAL_BODY}`}>
                <span className="text-carbon-blue/40">Why: </span>
                {understanding.nextBestDecision.why}
              </p>
              <p className={`mt-2 ${EDITORIAL_BODY}`}>
                <span className="text-carbon-blue/40">Expected impact: </span>
                {understanding.nextBestDecision.expectedImpact}
              </p>
              <div className="mt-3">
                <SmartAssistConfidenceLabel confidence={understanding.nextBestDecision.confidence} />
              </div>
            </div>
          </section>
        </>
      }
      context={
        <div className="space-y-5">
          <section className={WORKSPACE_PANEL_SURFACE}>
            <p className={EDITORIAL_LABEL}>Competitor profile</p>
            <p className={`mt-3 ${EDITORIAL_BODY}`}>{profile.recentActivity}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <ListBlock label="Strengths" items={profile.strengths} />
              <ListBlock label="Weaknesses" items={profile.weaknesses} />
              <ListBlock label="Success factors" items={profile.successFactors} />
              <ListBlock label="Certifications" items={profile.certifications} />
              <ListBlock label="Memberships" items={profile.memberships} />
              <ListBlock label="Event presence" items={profile.eventPresence} />
            </div>
          </section>

          <section className={WORKSPACE_PANEL_SURFACE}>
            <p className={EDITORIAL_LABEL}>What we should learn</p>
            <p className={`mt-3 ${EDITORIAL_BODY}`}>{understanding.whatWeShouldLearn}</p>
          </section>

          {understanding.relatedMarketIntelligence && understanding.relatedMarketIntelligence.length > 0 ? (
            <section className={WORKSPACE_PANEL_SURFACE}>
              <p className={EDITORIAL_LABEL}>Related market intelligence</p>
              <ul className="mt-3 space-y-1">
                {understanding.relatedMarketIntelligence.map((item) => (
                  <li key={item} className={EDITORIAL_META}>
                    · {item}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      }
    />
  );
}

function UnderstandingPanel({ title, content }: { title: string; content: string }) {
  return (
    <section className={WORKSPACE_PANEL_SURFACE}>
      <p className={EDITORIAL_LABEL}>{title}</p>
      <p className={`mt-3 ${EDITORIAL_BODY}`}>{content}</p>
    </section>
  );
}

function ListBlock({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className={EDITORIAL_FIELD_LABEL}>{label}</p>
      <ul className="mt-1 space-y-0.5">
        {items.map((item) => (
          <li key={item} className={EDITORIAL_META}>
            · {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
