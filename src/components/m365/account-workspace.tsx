import Link from "next/link";
import type { M365AccountWorkspacePayload, M365RiskBlock } from "@/types/m365";
import { M365IntelligenceMetaStrip, ImpactContext } from "@/components/m365/impact-context";
import { NextBestActionCard } from "@/components/m365/next-best-action-card";
import { RelationshipHeader } from "@/components/m365/relationship-header";

function TopRiskPanel({ risk }: { risk: M365RiskBlock | null }) {
  if (!risk) {
    return (
      <section className="border border-carbon-blue/8 px-4 py-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
          Top risk
        </h3>
        <p className="mt-2 text-[11px] text-carbon-blue/45">No critical account risks</p>
      </section>
    );
  }

  return (
    <section className="border border-upcycle-orange/25 bg-upcycle-orange/[0.03] px-4 py-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
        Top risk
      </h3>
      <p className="mt-2 text-sm font-medium text-carbon-blue">{risk.label}</p>
      {risk.detail ? (
        <p className="mt-0.5 text-[11px] text-carbon-blue/50">{risk.detail}</p>
      ) : null}
      <ImpactContext items={risk.impact} />
    </section>
  );
}

/** Teams Account Workspace — max 7 sections (North Star budget). */
export function AccountWorkspace({
  payload,
  variant = "default",
}: {
  payload: M365AccountWorkspacePayload;
  variant?: "default" | "teams";
}) {
  const shell =
    variant === "teams" ? "min-h-[100dvh] bg-white" : "dashboard-card overflow-hidden";

  return (
    <article className={shell}>
      <div className="space-y-4 px-5 py-5">
        {variant === "teams" ? (
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
            SmartCRM · Account Workspace
          </p>
        ) : null}
        <M365IntelligenceMetaStrip meta={payload.meta} />

        <RelationshipHeader
          companyName={payload.companyName}
          health={payload.health}
          lastContactLabel={payload.lastContactLabel}
          deepLink={payload.deepLink}
        />

        <section className="border border-carbon-blue/8 px-4 py-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
            Relationship snapshot
          </h3>
          <p className="mt-2 text-[12px] leading-relaxed text-carbon-blue/60">
            {payload.relationshipSnapshot}
          </p>
        </section>

        <NextBestActionCard action={payload.nextBestAction} compact />

        <TopRiskPanel risk={payload.topRisk} />

        {payload.openOpportunities.length > 0 ? (
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
              Open opportunities
            </h3>
            <ul className="mt-2 space-y-2">
              {payload.openOpportunities.map((opp) => (
                <li key={opp.id} className="border border-carbon-blue/8 px-3 py-2.5">
                  <Link
                    href={opp.href}
                    className="text-sm font-medium text-carbon-blue hover:text-upcycle-orange"
                  >
                    {opp.label}
                  </Link>
                  <p className="mt-0.5 text-[10px] text-carbon-blue/40">
                    {opp.stage} · {opp.valueLabel}
                  </p>
                  <ImpactContext items={opp.impact} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {payload.recentActivity.length > 0 ? (
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
              Recent activity
            </h3>
            <ul className="mt-2 space-y-1.5">
              {payload.recentActivity.map((activity) => (
                <li key={activity.id}>
                  <Link
                    href={activity.href}
                    className="text-[11px] text-carbon-blue/60 hover:text-upcycle-orange"
                  >
                    {activity.label}
                  </Link>
                  <span className="ml-2 text-[10px] text-carbon-blue/35">
                    {activity.occurredLabel}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {payload.knowledgeAtRisk.length > 0 ? (
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
              Knowledge at risk
            </h3>
            <ul className="mt-2 space-y-2">
              {payload.knowledgeAtRisk.map((doc) => (
                <li key={doc.id} className="border border-carbon-blue/8 px-3 py-2.5">
                  <Link
                    href={doc.href}
                    className="text-sm font-medium text-carbon-blue hover:text-upcycle-orange"
                  >
                    {doc.label}
                  </Link>
                  <ImpactContext items={doc.impact} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </article>
  );
}
