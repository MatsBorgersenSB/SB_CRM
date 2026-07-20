import Link from "next/link";
import type { M365MeetingBriefingPayload, M365RiskBlock } from "@/types/m365";
import { buildSmartCrmUrl } from "@/lib/m365/outlook-context";
import { ImpactContext } from "@/components/m365/impact-context";
import { NextBestActionCard } from "@/components/m365/next-best-action-card";

function BlockLabel({ children }: { children: string }) {
  return (
    <h3 className="text-[9px] font-semibold uppercase tracking-[0.14em] text-carbon-blue/38">
      {children}
    </h3>
  );
}

function BriefingActions({
  payload,
  outlookHost,
}: {
  payload: M365MeetingBriefingPayload;
  outlookHost: boolean;
}) {
  const smartCrmHref = buildSmartCrmUrl(payload.deepLink);
  const linkProps = outlookHost
    ? { target: "_blank" as const, rel: "noopener noreferrer" as const }
    : {};

  return (
    <div className="mt-3 flex flex-col gap-2">
      {payload.nextBestAction.plannerEligible ? (
        <a
          href="https://tasks.office.com/"
          {...linkProps}
          className="inline-flex items-center justify-center border border-upcycle-orange bg-upcycle-orange px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90"
        >
          Execute in Planner
        </a>
      ) : null}
      {outlookHost ? (
        <a
          href={smartCrmHref}
          {...linkProps}
          className="text-center text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/55 hover:text-upcycle-orange"
        >
          Open in SmartCRM
        </a>
      ) : (
        <Link
          href={payload.deepLink}
          className="text-center text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/55 hover:text-upcycle-orange"
        >
          Open in SmartCRM
        </Link>
      )}
    </div>
  );
}

function RiskRow({ risk }: { risk: M365RiskBlock }) {
  const severityStyles =
    risk.severity === "critical"
      ? "border-red-200/60 bg-red-50/50"
      : risk.severity === "warning"
        ? "border-upcycle-orange/25 bg-upcycle-orange/[0.03]"
        : "border-carbon-blue/10 bg-carbon-blue/[0.02]";

  return (
    <li className={`border px-3 py-2 ${severityStyles}`}>
      <p className="text-[12px] font-medium text-carbon-blue">{risk.label}</p>
      {risk.detail ? (
        <p className="mt-0.5 text-[10px] text-carbon-blue/50">{risk.detail}</p>
      ) : null}
      <ImpactContext items={risk.impact} />
    </li>
  );
}

function OpportunityLink({
  href,
  label,
  outlookHost,
}: {
  href: string;
  label: string;
  outlookHost: boolean;
}) {
  if (outlookHost) {
    return (
      <a
        href={buildSmartCrmUrl(href)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[12px] font-medium text-carbon-blue hover:text-upcycle-orange"
      >
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className="text-[12px] font-medium text-carbon-blue hover:text-upcycle-orange">
      {label}
    </Link>
  );
}

/**
 * Meeting Briefing — exactly seven sections (North Star budget).
 * Shared by /m365-preview and Outlook add-in (variant="outlook").
 */
export function MeetingBriefing({
  payload,
  variant = "default",
}: {
  payload: M365MeetingBriefingPayload;
  variant?: "default" | "outlook";
}) {
  const outlookHost = variant === "outlook";
  const shellClass = outlookHost
    ? "flex h-full max-h-[100dvh] flex-col overflow-hidden bg-white"
    : "dashboard-card overflow-hidden";

  return (
    <article className={shellClass}>
      <div
        className={`space-y-3 ${outlookHost ? "min-h-0 flex-1 overflow-y-auto px-4 py-3" : "px-5 py-5"}`}
      >
        {outlookHost ? (
          <header>
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
              SmartCRM · Meeting Briefing
            </p>
            <p className="mt-1 text-[13px] font-semibold text-carbon-blue">{payload.companyName}</p>
          </header>
        ) : null}

        <section aria-label="Relationship Summary">
          <BlockLabel>Relationship Summary</BlockLabel>
          <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-carbon-blue/65">
            {payload.relationshipSummary}
          </p>
        </section>

        <section
          aria-label="Primary Objective"
          className="border border-carbon-blue/12 bg-carbon-blue/[0.03] px-3 py-3"
        >
          <BlockLabel>Primary Objective</BlockLabel>
          <p className="mt-2 text-[13px] font-semibold leading-snug text-carbon-blue">
            {payload.meetingObjective}
          </p>
        </section>

        <section aria-label="What Changed">
          <BlockLabel>What Changed</BlockLabel>
          {payload.whatChanged.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {payload.whatChanged.map((line) => (
                <li key={line} className="text-[11px] leading-relaxed text-carbon-blue/55">
                  {line}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[11px] text-carbon-blue/45">No material changes since last touchpoint.</p>
          )}
        </section>

        <section aria-label="Open Opportunities">
          <BlockLabel>Open Opportunities</BlockLabel>
          {payload.openOpportunities.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {payload.openOpportunities.map((opp) => (
                <li key={opp.id} className="border border-carbon-blue/8 px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <OpportunityLink href={opp.href} label={opp.label} outlookHost={outlookHost} />
                    <span className="shrink-0 text-[10px] tabular-nums text-carbon-blue/45">
                      {opp.valueLabel}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-carbon-blue/40">
                    {opp.stage} · health {opp.healthScore}
                  </p>
                  <ImpactContext items={opp.impact} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[11px] text-carbon-blue/45">No open opportunities.</p>
          )}
        </section>

        <section aria-label="Top Risks">
          <BlockLabel>Top Risks</BlockLabel>
          {payload.topRisks.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {payload.topRisks.map((risk) => (
                <RiskRow key={risk.id} risk={risk} />
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[11px] text-carbon-blue/45">No urgent risks flagged.</p>
          )}
        </section>

        <section aria-label="Discussion Topics">
          <BlockLabel>Discussion Topics</BlockLabel>
          {payload.discussionTopics.length > 0 ? (
            <ul className="mt-2 list-inside list-disc space-y-1 text-[11px] text-carbon-blue/55">
              {payload.discussionTopics.map((topic) => (
                <li key={topic}>{topic}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[11px] text-carbon-blue/45">No discussion topics suggested.</p>
          )}
        </section>

        <section
          aria-label="Next Best Action"
          className="border border-upcycle-orange/35 bg-upcycle-orange/[0.05] px-3 py-3"
        >
          <BlockLabel>Next Best Action</BlockLabel>
          <div className="mt-2">
            <NextBestActionCard action={payload.nextBestAction} prominent hideLinks />
          </div>
          <BriefingActions payload={payload} outlookHost={outlookHost} />
        </section>
      </div>
    </article>
  );
}
