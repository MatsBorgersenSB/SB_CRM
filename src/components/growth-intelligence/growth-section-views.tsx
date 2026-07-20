"use client";

import Link from "next/link";
import { CompetitiveLandscapeView } from "@/components/growth-intelligence/competitive-landscape-view";
import { CompanyTypeBadges } from "@/components/companies/company-type-badges";
import { GrowthImpactBlock, GrowthRecommendationCard } from "@/components/growth-intelligence/growth-recommendation-card";
import { WorkspaceStack } from "@/components/ui/workspace-main";
import { eventPlanningHref } from "@/types/event-planning";
import type { GrowthIntelligenceSnapshot } from "@/types/growth-intelligence";

const RECOMMENDATION_COLORS = {
  attend: "text-green-700",
  monitor: "text-amber-700",
  skip: "text-carbon-blue/40",
  join: "text-green-700",
  evaluate: "text-amber-700",
  decline: "text-carbon-blue/40",
} as const;

export function GrowthCompetitorsView({ snapshot }: { snapshot: GrowthIntelligenceSnapshot }) {
  return <CompetitiveLandscapeView landscape={snapshot.competitiveLandscape} />;
}

export function GrowthEventsView({ snapshot }: { snapshot: GrowthIntelligenceSnapshot }) {
  return (
    <WorkspaceStack>
      {snapshot.events.map((event) => (
        <article key={event.id} className="dashboard-card p-4 sm:p-5">
          <header className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <Link
                href={eventPlanningHref(event.id)}
                className="text-sm font-semibold text-carbon-blue hover:text-upcycle-orange"
              >
                {event.name}
              </Link>
              <p className="text-[11px] text-carbon-blue/50">
                {event.location} · {event.dateLabel}
              </p>
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${RECOMMENDATION_COLORS[event.recommendation]}`}>
              {event.recommendation}
            </span>
          </header>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Metric label="Relevance" value={`${event.strategicRelevance}%`} />
            <Metric label="Audience" value={event.audienceQuality} />
            <Metric label="Decision makers" value={event.decisionMakerDensity} />
            <Metric label="Cost" value={event.estimatedCost} />
            <Metric label="Return potential" value={event.returnPotential} />
            <Metric
              label="Planning"
              value={event.planningStatus.replace(/_/g, " ")}
              highlight={event.planningStatus === "needs_planning"}
            />
          </div>

          {event.competitivePresence.length > 0 ? (
            <p className="mt-3 text-[10px] text-carbon-blue/50">
              Competitive presence: {event.competitivePresence.join(" · ")}
            </p>
          ) : null}

          <GrowthImpactBlock items={event.impact} />

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-carbon-blue/8 pt-4">
            <Link
              href={eventPlanningHref(event.id)}
              className="text-[12px] font-semibold text-upcycle-orange hover:text-carbon-blue"
            >
              Open planning workspace →
            </Link>
            <span className="text-[10px] text-carbon-blue/40">
              Companies · contacts · outreach · tracking
            </span>
          </div>
        </article>
      ))}
    </WorkspaceStack>
  );
}

export function GrowthMembershipsView({ snapshot }: { snapshot: GrowthIntelligenceSnapshot }) {
  return (
    <WorkspaceStack>
      {snapshot.memberships.map((membership) => (
        <article key={membership.id} className="dashboard-card p-4 sm:p-5">
          <header className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-carbon-blue">{membership.name}</h3>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${RECOMMENDATION_COLORS[membership.recommendation]}`}>
              {membership.recommendation}
            </span>
          </header>
          <p className="mt-2 text-[11px] text-carbon-blue/60">{membership.commercialPotential}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <Metric label="Relevance" value={`${membership.strategicRelevance}%`} />
            <Metric label="Decision makers" value={membership.decisionMakerAccess} />
            <Metric label="Partners" value={membership.partnerAccess} />
            <Metric label="Influence" value={membership.marketInfluence} />
          </div>
          <p className="mt-2 text-[10px] text-carbon-blue/45">Timing: {membership.timing}</p>
          <GrowthImpactBlock items={membership.impact} />
        </article>
      ))}
    </WorkspaceStack>
  );
}

export function GrowthMarketSegmentsView({ snapshot }: { snapshot: GrowthIntelligenceSnapshot }) {
  return (
    <WorkspaceStack>
      {snapshot.marketSegments.map((segment) => (
        <article key={segment.id} className="dashboard-card p-4 sm:p-5">
          <header className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-carbon-blue">{segment.name}</h3>
              <p className="text-[11px] text-carbon-blue/50">{segment.geography}</p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/40">
              {segment.trend}
            </span>
          </header>
          <p className="mt-2 text-[11px] text-carbon-blue/65">{segment.summary}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Metric label="Machinery potential" value={segment.machineryPotential} />
            <Metric label="Services potential" value={segment.servicesPotential} />
            <Metric label="CRM opportunities" value={String(segment.opportunityCount)} />
          </div>
          <GrowthImpactBlock items={segment.impact} />
        </article>
      ))}
    </WorkspaceStack>
  );
}

export function GrowthMarketingChannelsView({ snapshot }: { snapshot: GrowthIntelligenceSnapshot }) {
  return (
    <WorkspaceStack>
      {snapshot.marketingChannels.map((channel) => (
        <article key={channel.id} className="dashboard-card p-4 sm:p-5">
          <header className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="flex size-7 items-center justify-center rounded-full bg-upcycle-orange/10 text-[11px] font-bold text-upcycle-orange">
                #{channel.rank}
              </span>
              <h3 className="text-sm font-semibold text-carbon-blue">{channel.name}</h3>
            </div>
          </header>
          <p className="mt-2 text-[11px] text-carbon-blue/60">{channel.summary}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-5">
            <ScoreBar label="Awareness" value={channel.awareness} />
            <ScoreBar label="Credibility" value={channel.credibility} />
            <ScoreBar label="Commercial" value={channel.commercialImpact} />
            <ScoreBar label="Strategic" value={channel.strategicValue} />
            <ScoreBar label="Long-term" value={channel.longTermInfluence} />
          </div>
          <GrowthImpactBlock items={channel.impact} />
        </article>
      ))}
    </WorkspaceStack>
  );
}

export function GrowthPartnerEcosystemView({ snapshot }: { snapshot: GrowthIntelligenceSnapshot }) {
  return (
    <WorkspaceStack>
      {snapshot.partnerEcosystem.map((partner) => (
        <Link
          key={partner.companyId}
          href={partner.href}
          className="dashboard-card block p-4 sm:p-5 transition-colors hover:border-upcycle-orange/20"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-carbon-blue group-hover:text-upcycle-orange">
              {partner.companyName}
            </h3>
            <CompanyTypeBadges types={partner.types} size="sm" />
          </div>
          <p className="mt-2 text-[11px] text-carbon-blue/60">{partner.strategicValue}</p>
        </Link>
      ))}
    </WorkspaceStack>
  );
}

export function GrowthRecommendationsView({ snapshot }: { snapshot: GrowthIntelligenceSnapshot }) {
  return (
    <WorkspaceStack>
      {snapshot.recommendations.map((rec) => (
        <GrowthRecommendationCard key={rec.id} recommendation={rec} />
      ))}
    </WorkspaceStack>
  );
}

export function GrowthStrategicInitiativesView({ snapshot }: { snapshot: GrowthIntelligenceSnapshot }) {
  return (
    <WorkspaceStack>
      {snapshot.strategicInitiatives.map((initiative) => (
        <article key={initiative.id} className="dashboard-card p-4 sm:p-5">
          <header className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-carbon-blue">{initiative.name}</h3>
              <p className="text-[11px] text-carbon-blue/50">
                {initiative.owner} · {initiative.horizon}
              </p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/40">
              {initiative.status}
            </span>
          </header>
          <p className="mt-2 text-[11px] text-carbon-blue/65">{initiative.summary}</p>
          <p className="mt-2 text-[10px] font-medium text-upcycle-orange">
            Next: {initiative.nextMilestone}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {initiative.outcomes.map((outcome) => (
              <span
                key={outcome}
                className="rounded-full border border-carbon-blue/10 px-2 py-0.5 text-[9px] text-carbon-blue/55"
              >
                {outcome}
              </span>
            ))}
          </div>
          <GrowthImpactBlock items={initiative.impact} />
        </article>
      ))}
    </WorkspaceStack>
  );
}

export function GrowthMarketIntelligenceView({ snapshot }: { snapshot: GrowthIntelligenceSnapshot }) {
  return (
    <WorkspaceStack>
      {snapshot.marketIntelligence.map((item) => (
        <article key={item.id} className="dashboard-card p-4 sm:p-5">
          <header className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-carbon-blue/35">
                {item.category.replace(/_/g, " ")} · {item.dateLabel}
              </p>
              <h3 className="mt-1 text-sm font-semibold text-carbon-blue">{item.title}</h3>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/40">
              {item.relevance}
            </span>
          </header>
          <p className="mt-2 text-[11px] text-carbon-blue/65">{item.summary}</p>
          <GrowthImpactBlock items={item.impact} />
        </article>
      ))}
    </WorkspaceStack>
  );
}

function Metric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg border px-2.5 py-2 ${highlight ? "border-amber-500/30 bg-amber-500/[0.04]" : "border-carbon-blue/8"}`}>
      <p className="text-[9px] font-bold uppercase tracking-wider text-carbon-blue/35">{label}</p>
      <p className="mt-0.5 text-[11px] font-medium capitalize text-carbon-blue">{value}</p>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-[9px] text-carbon-blue/45">
        <span>{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-carbon-blue/8">
        <div
          className="h-full rounded-full bg-upcycle-orange/70"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
