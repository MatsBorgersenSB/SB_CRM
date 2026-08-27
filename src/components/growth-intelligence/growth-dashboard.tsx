"use client";

import Link from "next/link";
import { IntelligenceLead } from "@/components/ui/intelligence-lead";
import { WorkspaceStack } from "@/components/ui/workspace-main";
import { GrowthImpactBlock } from "@/components/growth-intelligence/growth-recommendation-card";
import type {
  GrowthEvidenceKind,
  GrowthIntelligenceSnapshot,
  GrowthOperatingAction,
} from "@/types/growth-intelligence";

const EVIDENCE_LABEL: Record<GrowthEvidenceKind, string> = {
  observed: "Observed in CRM",
  unknown: "Unknown — do not invent",
  hypothesis: "Strategy note — not CRM fact",
};

export function GrowthDashboard({ snapshot }: { snapshot: GrowthIntelligenceSnapshot }) {
  const { operatingLoop, liveDeals, metrics } = snapshot;

  return (
    <WorkspaceStack>
      <IntelligenceLead
        eyebrow="Growth Intelligence · This week"
        title="What should we do with live deals and people?"
        summary="Skills read live deals, mail, and understanding fields. Unknown stays unknown. Strategy notes stay in Watch."
        vitals={[
          {
            label: "Open sales deals",
            value: String(liveDeals.length),
            highlight: liveDeals.length > 0,
          },
          {
            label: "This week",
            value: String(operatingLoop.thisWeek.length),
            highlight: operatingLoop.thisWeek.length > 0,
          },
          {
            label: "Events still ahead",
            value: String(metrics.eventsNeedingPlanning),
          },
          {
            label: "Competitors in registry",
            value: String(metrics.competitorCount),
          },
        ]}
      />

      <OperatingSection
        title="This week"
        empty="Nothing in the live registry needs a growth move this week. Classify relationships or open a real opportunity first."
        actions={operatingLoop.thisWeek}
      />

      <OperatingSection
        title="This quarter"
        empty="No upcoming events or classified commercial targets to plan against."
        actions={operatingLoop.thisQuarter}
      />

      <OperatingSection
        title="Watch"
        empty="No watch items. Unknown stays unknown."
        actions={operatingLoop.watch}
      />

      {operatingLoop.unknowns.length > 0 ? (
        <section className="dashboard-card p-4 sm:p-5">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-carbon-blue/40">
            What we don’t know
          </h2>
          <ul className="mt-3 space-y-1.5">
            {operatingLoop.unknowns.map((item) => (
              <li key={item} className="text-[12px] leading-relaxed text-carbon-blue/65">
                {item}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {liveDeals.length > 0 ? (
        <section className="dashboard-card p-4 sm:p-5">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-carbon-blue/40">
              Live pipeline
            </h2>
            <Link
              href="/opportunities"
              className="text-[10px] font-semibold text-upcycle-orange hover:underline"
            >
              All opportunities
            </Link>
          </header>
          <ul className="space-y-2">
            {liveDeals.slice(0, 8).map((deal) => (
              <li key={deal.id}>
                <Link
                  href={deal.href}
                  className="block rounded-lg border border-carbon-blue/10 px-3 py-2.5 hover:border-upcycle-orange/20"
                >
                  <p className="text-[12px] font-semibold text-carbon-blue">{deal.name}</p>
                  <p className="mt-0.5 text-[11px] text-carbon-blue/55">
                    {deal.companyName} · {deal.status}
                  </p>
                  <p className="mt-1 text-[11px] text-carbon-blue/70">Next: {deal.nextStep}</p>
                  {deal.offer ? (
                    <p className="mt-1 text-[11px] font-medium text-upcycle-orange">
                      Offer: {deal.offer}
                      {deal.offerWhy ? ` — ${deal.offerWhy}` : ""}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </WorkspaceStack>
  );
}

function OperatingSection({
  title,
  empty,
  actions,
}: {
  title: string;
  empty: string;
  actions: GrowthOperatingAction[];
}) {
  return (
    <section className="dashboard-card p-4 sm:p-5">
      <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-carbon-blue/40">
        {title}
      </h2>
      {actions.length === 0 ? (
        <p className="mt-3 text-[13px] text-carbon-blue/50">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {actions.map((action) => (
            <li key={action.id}>
              <Link
                href={action.href}
                className="block rounded-lg border border-carbon-blue/10 px-3 py-2.5 hover:border-upcycle-orange/20"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-[12px] font-semibold text-carbon-blue">{action.title}</p>
                  <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-carbon-blue/40">
                    {EVIDENCE_LABEL[action.evidence]}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/60">{action.why}</p>
                <p className="mt-1 text-[11px] font-medium text-upcycle-orange">{action.next}</p>
                <GrowthImpactBlock items={[action.impact]} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
