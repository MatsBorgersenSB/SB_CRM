"use client";

import Link from "next/link";
import { IntelligenceLead } from "@/components/ui/intelligence-lead";
import { WorkspaceStack } from "@/components/ui/workspace-main";
import { GrowthImpactBlock } from "@/components/growth-intelligence/growth-recommendation-card";
import { GrowthRecommendationCard } from "@/components/growth-intelligence/growth-recommendation-card";
import type { GrowthIntelligenceSnapshot } from "@/types/growth-intelligence";
import { competitiveIntelligenceHref } from "@/types/competitive-intelligence";
import { eventPlanningHref } from "@/types/event-planning";

const SEVERITY_STYLES = {
  critical: "border-red-500/30 bg-red-500/[0.04]",
  warning: "border-amber-500/30 bg-amber-500/[0.04]",
  info: "border-carbon-blue/10 bg-carbon-blue/[0.02]",
} as const;

export function GrowthDashboard({ snapshot }: { snapshot: GrowthIntelligenceSnapshot }) {
  const { metrics } = snapshot;

  return (
    <WorkspaceStack>
      <IntelligenceLead
        eyebrow="Growth Intelligence · StandardBio"
        title="What requires attention right now?"
        summary="Strategic pulse across competitors, events, opportunities and recommended actions — every signal filtered by contribution to machinery sales and paid professional services."
        vitals={[
          { label: "Competitors tracked", value: String(metrics.competitorCount) },
          {
            label: "Events need planning",
            value: String(metrics.eventsNeedingPlanning),
            highlight: metrics.eventsNeedingPlanning > 0,
          },
          {
            label: "Priority recommendations",
            value: String(metrics.highPriorityRecommendations),
            highlight: true,
          },
          { label: "Ecosystem partners", value: String(metrics.partnerCount) },
        ]}
        action={
          <Link
            href="/growth/recommendations"
            className="text-[11px] font-semibold text-upcycle-orange hover:underline"
          >
            View all recommendations →
          </Link>
        }
      />

      <section className="dashboard-card p-4 sm:p-5">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-carbon-blue/40">
          What requires attention?
        </h2>
        <ul className="mt-3 space-y-2">
          {snapshot.attention.map((item) => (
            <li key={item.id}>
              {item.href ? (
                <Link
                  href={item.href}
                  className={`block rounded-lg border px-3 py-2.5 transition-colors hover:border-upcycle-orange/25 ${SEVERITY_STYLES[item.severity]}`}
                >
                  <AttentionRow item={item} />
                </Link>
              ) : (
                <div className={`rounded-lg border px-3 py-2.5 ${SEVERITY_STYLES[item.severity]}`}>
                  <AttentionRow item={item} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="dashboard-card p-4 sm:p-5">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-carbon-blue/40">
              Emerging opportunities
            </h2>
            <Link
              href="/growth/market-segments"
              className="text-[10px] font-semibold text-upcycle-orange hover:underline"
            >
              Segments
            </Link>
          </header>
          <ul className="space-y-2">
            {snapshot.emergingOpportunities.map((opp) => (
              <li key={opp.id}>
                {opp.href ? (
                  <Link
                    href={opp.href}
                    className="block rounded-lg border border-carbon-blue/10 px-3 py-2.5 hover:border-upcycle-orange/20"
                  >
                    <OpportunityRow opp={opp} />
                  </Link>
                ) : (
                  <div className="rounded-lg border border-carbon-blue/10 px-3 py-2.5">
                    <OpportunityRow opp={opp} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="dashboard-card p-4 sm:p-5">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-carbon-blue/40">
              Active competitors
            </h2>
            <Link
              href="/growth/competitors"
              className="text-[10px] font-semibold text-upcycle-orange hover:underline"
            >
              Full analysis
            </Link>
          </header>
          <ul className="space-y-2">
            {snapshot.activeCompetitors.map((competitor) => (
              <li key={competitor.companyId}>
                <Link
                  href={competitiveIntelligenceHref(competitor.companyId)}
                  className="block rounded-lg border border-carbon-blue/10 px-3 py-2.5 hover:border-upcycle-orange/20"
                >
                  <p className="text-[11px] font-semibold text-carbon-blue">{competitor.companyName}</p>
                  <p className="mt-0.5 text-[10px] text-carbon-blue/55">{competitor.recentActivity}</p>
                  <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-carbon-blue/35">
                    Threat: {competitor.threatLevel}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="dashboard-card p-4 sm:p-5">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-carbon-blue/40">
            Events requiring planning
          </h2>
          <Link
            href="/growth/events"
            className="text-[10px] font-semibold text-upcycle-orange hover:underline"
          >
            All events
          </Link>
        </header>
        <ul className="space-y-2">
          {snapshot.eventsRequiringPlanning.map((event) => (
            <li
              key={event.id}
              className="rounded-lg border border-carbon-blue/10 px-3 py-2.5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link
                    href={eventPlanningHref(event.id)}
                    className="text-[11px] font-semibold text-carbon-blue hover:text-upcycle-orange"
                  >
                    {event.name}
                  </Link>
                  <p className="text-[10px] text-carbon-blue/50">
                    {event.location} · {event.dateLabel}
                  </p>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700">
                  Needs planning
                </span>
              </div>
              <GrowthImpactBlock items={event.impact} />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <header className="mb-3">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-carbon-blue/40">
            Top strategic recommendations
          </h2>
        </header>
        <div className="grid gap-3 lg:grid-cols-2">
          {snapshot.recommendations.slice(0, 2).map((rec) => (
            <GrowthRecommendationCard key={rec.id} recommendation={rec} />
          ))}
        </div>
      </section>
    </WorkspaceStack>
  );
}

function AttentionRow({
  item,
}: {
  item: GrowthIntelligenceSnapshot["attention"][number];
}) {
  return (
    <>
      <p className="text-[11px] font-semibold text-carbon-blue">{item.label}</p>
      <p className="mt-0.5 text-[10px] text-carbon-blue/55">{item.detail}</p>
      <GrowthImpactBlock items={item.impact} />
    </>
  );
}

function OpportunityRow({
  opp,
}: {
  opp: GrowthIntelligenceSnapshot["emergingOpportunities"][number];
}) {
  return (
    <>
      <p className="text-[11px] font-semibold text-carbon-blue">{opp.label}</p>
      <p className="text-[10px] text-carbon-blue/50">
        {opp.segment} · {opp.horizon} · {opp.potential} potential
      </p>
      <GrowthImpactBlock items={opp.impact} />
    </>
  );
}
