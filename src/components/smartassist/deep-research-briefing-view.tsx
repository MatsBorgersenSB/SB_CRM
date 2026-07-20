"use client";

import Link from "next/link";
import type { DeepResearchBriefing, DeepResearchPriority } from "@/types/deep-research";
import { ResearchReportActions } from "@/components/smartassist/research-report-actions";

function priorityStyles(priority: DeepResearchPriority): string {
  switch (priority) {
    case "high":
      return "border-upcycle-orange/30 bg-upcycle-orange/[0.06] text-upcycle-orange";
    case "medium":
      return "border-amber-500/25 bg-amber-500/[0.05] text-amber-700";
    default:
      return "border-carbon-blue/15 bg-carbon-blue/[0.03] text-carbon-blue/70";
  }
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-carbon-blue/8 pt-3 first:border-t-0 first:pt-0">
      <h4 className="text-[9px] font-bold uppercase tracking-wider text-carbon-blue/40">{title}</h4>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function BulletList({ items }: { items: DeepResearchBriefing["recentNews"] }) {
  if (items.length === 0) {
    return <p className="text-[10px] text-carbon-blue/45">No signals recorded.</p>;
  }

  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item.id}>
          {item.href ? (
            <Link
              href={item.href}
              className="block rounded-md px-1 py-0.5 text-[10px] font-medium text-carbon-blue hover:bg-carbon-blue/[0.04] hover:text-upcycle-orange"
            >
              {item.label}
              {item.detail ? (
                <span className="mt-0.5 block font-normal text-carbon-blue/50">{item.detail}</span>
              ) : null}
            </Link>
          ) : (
            <div className="text-[10px] text-carbon-blue/75">
              <span className="font-medium text-carbon-blue">{item.label}</span>
              {item.detail ? (
                <p className="mt-0.5 text-carbon-blue/50">{item.detail}</p>
              ) : null}
              <span className="mt-0.5 block text-[9px] uppercase tracking-wide text-carbon-blue/30">
                {item.source}
              </span>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export function DeepResearchBriefingView({
  briefing,
  onNavigate,
  companyId,
  dealId,
  contactId,
}: {
  briefing: DeepResearchBriefing;
  onNavigate?: () => void;
  companyId?: string;
  dealId?: string;
  contactId?: string;
}) {
  const { executiveSummary, overallAssessment } = briefing;

  return (
    <article className="space-y-3">
      <header>
        <p className="text-[9px] font-bold uppercase tracking-wider text-upcycle-orange">
          Deep Research · {briefing.kind}
        </p>
        <h3 className="mt-1 text-[14px] font-semibold tracking-tight text-carbon-blue">
          {briefing.subjectLabel}
        </h3>
        {briefing.href ? (
          <Link
            href={briefing.href}
            onClick={onNavigate}
            className="mt-1 inline-block text-[10px] font-semibold text-upcycle-orange hover:underline"
          >
            Open in CRM →
          </Link>
        ) : null}
      </header>

      <ResearchReportActions
        briefing={briefing}
        companyId={companyId}
        dealId={dealId}
        contactId={contactId}
      />

      <Section title="Executive Summary">
        <dl className="grid gap-1 text-[10px] text-carbon-blue/70">
          <div>
            <dt className="text-carbon-blue/40">Company</dt>
            <dd className="font-medium text-carbon-blue">{executiveSummary.subject}</dd>
          </div>
          {executiveSummary.industry ? (
            <div>
              <dt className="text-carbon-blue/40">Industry</dt>
              <dd>{executiveSummary.industry}</dd>
            </div>
          ) : null}
          {executiveSummary.location ? (
            <div>
              <dt className="text-carbon-blue/40">Location</dt>
              <dd>{executiveSummary.location}</dd>
            </div>
          ) : null}
          {executiveSummary.size ? (
            <div>
              <dt className="text-carbon-blue/40">Size</dt>
              <dd>{executiveSummary.size}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-carbon-blue/40">Business Focus</dt>
            <dd>{executiveSummary.businessFocus}</dd>
          </div>
        </dl>
        <p className="mt-2 text-[10px] leading-relaxed text-carbon-blue/55">
          {executiveSummary.narrative}
        </p>
      </Section>

      <Section title="Why It Matters">
        <ul className="list-disc space-y-1 pl-4 text-[10px] leading-relaxed text-carbon-blue/65">
          {briefing.whyItMatters.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </Section>

      <Section title="Known Internal Relationship">
        {briefing.knownRelationship.relationshipHealth ? (
          <p className="mb-2 text-[10px] text-carbon-blue/55">
            {briefing.knownRelationship.relationshipHealth}
            {briefing.knownRelationship.lastContact
              ? ` · Last contact ${briefing.knownRelationship.lastContact}`
              : null}
          </p>
        ) : null}
        {briefing.knownRelationship.opportunities.length > 0 ? (
          <div className="mb-2">
            <p className="text-[9px] font-semibold text-carbon-blue/40">Opportunities</p>
            <BulletList items={briefing.knownRelationship.opportunities} />
          </div>
        ) : null}
        {briefing.knownRelationship.activities.length > 0 ? (
          <div>
            <p className="text-[9px] font-semibold text-carbon-blue/40">Activities</p>
            <BulletList items={briefing.knownRelationship.activities} />
          </div>
        ) : null}
      </Section>

      <Section title="Recent News">
        <BulletList items={briefing.recentNews} />
      </Section>

      <Section title="Project Signals">
        <BulletList items={briefing.projectSignals} />
      </Section>

      <Section title="Risks">
        <div className="space-y-2">
          {briefing.risks.commercial.length > 0 ? (
            <div>
              <p className="text-[9px] font-semibold text-carbon-blue/40">Commercial</p>
              <BulletList items={briefing.risks.commercial} />
            </div>
          ) : null}
          {briefing.risks.relationship.length > 0 ? (
            <div>
              <p className="text-[9px] font-semibold text-carbon-blue/40">Relationship</p>
              <BulletList items={briefing.risks.relationship} />
            </div>
          ) : null}
          {briefing.risks.competitive.length > 0 ? (
            <div>
              <p className="text-[9px] font-semibold text-carbon-blue/40">Competitive</p>
              <BulletList items={briefing.risks.competitive} />
            </div>
          ) : null}
        </div>
      </Section>

      <Section title="Opportunities">
        <BulletList items={briefing.opportunities.salesOpportunities} />
      </Section>

      <Section title="Recommended Actions">
        <BulletList items={briefing.recommendedActions} />
      </Section>

      <Section title="Overall Assessment">
        <div className={`rounded-lg border px-3 py-2.5 ${priorityStyles(overallAssessment.priority)}`}>
          <p className="text-[10px] font-bold uppercase tracking-wide">
            {overallAssessment.priority} · {overallAssessment.strategicPriority}
          </p>
          <p className="mt-1 text-[10px] leading-relaxed opacity-90">{overallAssessment.summary}</p>
        </div>
        <p className="mt-2 text-[9px] text-carbon-blue/35">
          Sources: {briefing.sourcesUsed.join(" · ")}
        </p>
      </Section>
    </article>
  );
}
