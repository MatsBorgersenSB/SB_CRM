import Link from "next/link";
import type { M365RelationshipCardPayload } from "@/types/m365";
import { buildSmartCrmUrl } from "@/lib/m365/outlook-context";
import { HealthRing } from "@/components/m365/health-ring";
import { ImpactContext } from "@/components/m365/impact-context";
import { NextBestActionCard } from "@/components/m365/next-best-action-card";
import { RelationshipHeader } from "@/components/m365/relationship-header";

function BlockLabel({ children }: { children: string }) {
  return (
    <h3 className="text-[9px] font-semibold uppercase tracking-[0.14em] text-carbon-blue/38">
      {children}
    </h3>
  );
}

function CardActions({
  payload,
  outlookHost,
}: {
  payload: M365RelationshipCardPayload;
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

/**
 * Relationship Card — exactly five blocks, no scroll.
 * Shared by /m365-preview and Outlook add-in (variant="outlook").
 */
export function RelationshipCard({
  payload,
  variant = "default",
}: {
  payload: M365RelationshipCardPayload;
  variant?: "default" | "outlook";
}) {
  const outlookHost = variant === "outlook";
  const shellClass = outlookHost
    ? "flex h-full max-h-[100dvh] flex-col overflow-hidden bg-white"
    : "dashboard-card overflow-hidden";

  return (
    <article className={shellClass}>
      <div className={`space-y-3 ${outlookHost ? "min-h-0 flex-1 overflow-hidden px-4 py-3" : "px-5 py-5"}`}>
        {outlookHost ? (
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
            SmartCRM
          </p>
        ) : null}

        <section aria-label="Relationship Health">
          <BlockLabel>Relationship Health</BlockLabel>
          {outlookHost ? (
            <p className="mt-1.5 text-[12px] font-semibold leading-snug text-carbon-blue">
              {payload.meta.whatMatters}
            </p>
          ) : null}
          <div className={`mt-2 ${outlookHost ? "flex items-start gap-3" : ""}`}>
            {outlookHost ? <HealthRing health={payload.health} size="sm" /> : null}
            <div className="min-w-0 flex-1">
              <RelationshipHeader
                companyName={payload.companyName}
                health={payload.health}
                hideHealthRing={outlookHost}
                deepLink={outlookHost ? undefined : payload.deepLink}
              />
            </div>
          </div>
        </section>

        <section aria-label="Top Risk">
          <BlockLabel>Top Risk</BlockLabel>
          {payload.topRisk ? (
            <div className="mt-2 border border-upcycle-orange/25 bg-upcycle-orange/[0.03] px-3 py-2.5">
              <p className="text-[12px] font-semibold leading-snug text-carbon-blue">
                {payload.topRisk.label}
              </p>
              {payload.topRisk.detail ? (
                <p className="mt-0.5 text-[10px] text-carbon-blue/50">{payload.topRisk.detail}</p>
              ) : null}
              <ImpactContext items={payload.topRisk.impact} />
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-carbon-blue/45">No critical risks detected</p>
          )}
        </section>

        <section
          aria-label="Recommended Action"
          className="border border-upcycle-orange/35 bg-upcycle-orange/[0.05] px-3 py-3"
        >
          <BlockLabel>Recommended Action</BlockLabel>
          <div className="mt-2">
            <NextBestActionCard action={payload.nextBestAction} prominent hideLinks />
          </div>
          <CardActions payload={payload} outlookHost={outlookHost} />
        </section>

        <section aria-label="Open Opportunities and Commitments" className="grid grid-cols-2 gap-2">
          <div className="border border-carbon-blue/8 px-3 py-2.5">
            <BlockLabel>Open Opportunities</BlockLabel>
            <p className="mt-2 text-base font-semibold tabular-nums text-carbon-blue/80">
              {payload.openOpportunities.count}
            </p>
            <p className="text-[10px] text-carbon-blue/45">{payload.openOpportunities.valueLabel}</p>
            <ImpactContext items={payload.openOpportunities.impact} />
          </div>
          <div className="border border-carbon-blue/8 px-3 py-2.5">
            <BlockLabel>Open Commitments</BlockLabel>
            <p className="mt-2 text-base font-semibold tabular-nums text-carbon-blue/80">
              {payload.openCommitments.count}
            </p>
            <p className="text-[10px] text-carbon-blue/45">{payload.openCommitments.stateLabel}</p>
            <ImpactContext items={payload.openCommitments.impact} />
          </div>
        </section>
      </div>
    </article>
  );
}
