"use client";

import Link from "next/link";
import { CompetitiveLandscapeView } from "@/components/growth-intelligence/competitive-landscape-view";
import { CompanyTypeBadges } from "@/components/companies/company-type-badges";
import { GrowthImpactBlock, GrowthRecommendationCard } from "@/components/growth-intelligence/growth-recommendation-card";
import { WorkspaceStack } from "@/components/ui/workspace-main";
import { eventPlanningHref } from "@/types/event-planning";
import { isEventPast } from "@/lib/growth-event-timing";
import type { GrowthIntelligenceSnapshot } from "@/types/growth-intelligence";
import { offerLabel, type GrowthMeetingTarget } from "@/types/growth-super-skills";

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
  const upcoming = snapshot.events.filter((event) => !isEventPast(event));
  const passed = snapshot.events.filter((event) => isEventPast(event));
  const meetings = snapshot.superSkills.meetingMachine;

  return (
    <WorkspaceStack>
      {upcoming.length === 0 ? (
        <p className="dashboard-card px-4 py-6 text-[13px] text-carbon-blue/50">
          No upcoming events. Passed shows stay in Watch until outcomes are captured.
        </p>
      ) : null}
      {upcoming.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          passed={false}
          meetings={meetings.filter((target) => target.eventId === event.id)}
        />
      ))}
      {passed.length > 0 ? (
        <section>
          <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-carbon-blue/40">
            Passed — review or archive
          </h2>
          <div className="flex flex-col gap-3">
            {passed.map((event) => (
              <EventCard key={event.id} event={event} passed meetings={[]} />
            ))}
          </div>
        </section>
      ) : null}
    </WorkspaceStack>
  );
}

function EventCard({
  event,
  passed,
  meetings,
}: {
  event: GrowthIntelligenceSnapshot["events"][number];
  passed: boolean;
  meetings: GrowthMeetingTarget[];
}) {
  return (
    <article className="dashboard-card p-4 sm:p-5">
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
        <span
          className={`text-[10px] font-bold uppercase tracking-wider ${
            passed ? "text-carbon-blue/40" : RECOMMENDATION_COLORS[event.recommendation]
          }`}
        >
          {passed ? "Passed" : event.recommendation}
        </span>
      </header>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Metric label="Audience" value={event.audienceQuality} />
        <Metric label="Decision makers" value={event.decisionMakerDensity} />
        <Metric label="Cost" value={event.estimatedCost} />
        <Metric label="Return potential" value={event.returnPotential} />
        <Metric
          label="Planning"
          value={passed ? "Capture outcomes" : event.planningStatus.replace(/_/g, " ")}
          highlight={!passed && event.planningStatus === "needs_planning"}
        />
      </div>

      {meetings.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {meetings.map((target) => (
            <li
              key={`${target.eventId}-${target.companyName}-${target.contactName ?? "unnamed"}`}
              className="rounded-lg border border-carbon-blue/10 px-3 py-2"
            >
              <p className="text-[12px] font-semibold text-carbon-blue">
                {target.contactName ?? "Name a person first"}
                <span className="font-normal text-carbon-blue/55"> · {target.companyName}</span>
              </p>
              {target.contactRole ? (
                <p className="text-[11px] text-carbon-blue/50">{target.contactRole}</p>
              ) : null}
              <p className="mt-1 text-[11px] text-upcycle-orange">{offerLabel(target.offer)}</p>
              <p className="mt-0.5 text-[11px] text-carbon-blue/65">{target.agenda}</p>
            </li>
          ))}
        </ul>
      ) : !passed && event.recommendation === "attend" ? (
        <p className="mt-3 text-[11px] text-carbon-blue/50">
          No named meeting targets yet. Classify sell-to companies and add contacts before requesting meetings.
        </p>
      ) : null}

      {event.competitivePresence.length > 0 ? (
        <p className="mt-3 text-[10px] text-carbon-blue/50">
          Competitive presence (strategy note): {event.competitivePresence.join(" · ")}
        </p>
      ) : null}

      <GrowthImpactBlock items={event.impact} />

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-carbon-blue/8 pt-4">
        <Link
          href={eventPlanningHref(event.id)}
          className="text-[12px] font-semibold text-upcycle-orange hover:text-carbon-blue"
        >
          {passed ? "Open for outcome capture →" : "Open planning workspace →"}
        </Link>
        <span className="text-[10px] text-carbon-blue/40">Named CRM companies only</span>
      </div>
    </article>
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
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
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
      {snapshot.liveDeals.length > 0 ? (
        <section className="dashboard-card p-4 sm:p-5">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-carbon-blue/40">
            Named opportunities in the registry
          </h2>
          <ul className="mt-3 space-y-2">
            {snapshot.liveDeals.map((deal) => (
              <li key={deal.id}>
                <Link
                  href={deal.href}
                  className="block text-[12px] font-medium text-carbon-blue hover:text-upcycle-orange"
                >
                  {deal.name}
                  <span className="font-normal text-carbon-blue/50"> · {deal.companyName}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="dashboard-card px-4 py-6 text-[13px] text-carbon-blue/50">
          No open sales opportunities to map onto segments yet.
        </p>
      )}
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
          <p className="mt-2 text-[10px] font-medium uppercase tracking-wider text-carbon-blue/40">
            Strategy note — not a live pipeline count
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Metric label="Machinery potential" value={segment.machineryPotential} />
            <Metric label="Services potential" value={segment.servicesPotential} />
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
          <GrowthImpactBlock items={channel.impact} />
        </article>
      ))}
    </WorkspaceStack>
  );
}

export function GrowthPartnerEcosystemView({ snapshot }: { snapshot: GrowthIntelligenceSnapshot }) {
  if (snapshot.partnerEcosystem.length === 0) {
    return (
      <WorkspaceStack>
        <p className="dashboard-card px-4 py-6 text-[13px] text-carbon-blue/55">
          No offtakers, investors, universities or partners are classified in the live registry.
          Classify a company first — do not invent an ecosystem.
        </p>
      </WorkspaceStack>
    );
  }
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
  const cards = snapshot.superSkills.marketIntel;
  const unsourced = snapshot.unverifiedMarketNotes;

  return (
    <WorkspaceStack>
      {cards.length === 0 ? (
        <p className="dashboard-card px-4 py-6 text-[13px] text-carbon-blue/50">
          No live market evidence yet. Unknown stays unknown — we will not invent regulation or competitor news.
        </p>
      ) : (
        cards.map((card) => (
          <article key={card.id} className="dashboard-card p-4 sm:p-5">
            <header className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-carbon-blue/35">
                  {card.category.replace(/_/g, " ")} · {card.geography} · {card.asOf}
                </p>
                <h3 className="mt-1 text-sm font-semibold text-carbon-blue">{card.title}</h3>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/40">
                {card.evidence === "observed" ? "Observed in CRM" : "Unverified"}
              </span>
            </header>
            <p className="mt-2 text-[11px] text-carbon-blue/65">{card.fact}</p>
            <p className="mt-2 text-[10px] text-carbon-blue/45">Source: {card.sourceLabel}</p>
            <p className="mt-2 text-[11px] font-medium text-upcycle-orange">
              {offerLabel(card.offerImplication)} — {card.offerWhy}
            </p>
            {card.relatedDeals.length > 0 ? (
              <p className="mt-2 text-[11px] text-carbon-blue/60">
                Pipeline:{" "}
                {card.relatedDeals.map((deal, index) => (
                  <span key={deal.id}>
                    {index > 0 ? " · " : null}
                    <Link href={deal.href} className="font-medium text-carbon-blue hover:text-upcycle-orange">
                      {deal.name}
                    </Link>
                  </span>
                ))}
              </p>
            ) : null}
            <Link
              href={card.nextHref}
              className="mt-3 inline-block text-[11px] font-semibold text-upcycle-orange hover:underline"
            >
              {card.nextAction}
            </Link>
          </article>
        ))
      )}

      {unsourced.length > 0 ? (
        <details className="dashboard-card p-4 sm:p-5">
          <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-[0.12em] text-carbon-blue/40">
            Unsourced strategy notes — not primary intelligence
          </summary>
          <ul className="mt-3 space-y-3">
            {unsourced.map((item) => (
              <li key={item.id}>
                <p className="text-[12px] font-semibold text-carbon-blue/70">{item.title}</p>
                <p className="mt-1 text-[11px] text-carbon-blue/50">{item.summary}</p>
                <p className="mt-1 text-[10px] text-carbon-blue/40">No source. Do not brief from this card.</p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
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

