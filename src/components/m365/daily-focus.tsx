import type { M365DailyFocusPayload, M365RiskBlock } from "@/types/m365";
import { M365IntelligenceMetaStrip, ImpactContext } from "@/components/m365/impact-context";
import { NextBestActionCard } from "@/components/m365/next-best-action-card";

function RiskPanel({
  title,
  risk,
}: {
  title: string;
  risk: M365RiskBlock | null;
}) {
  if (!risk) {
    return (
      <section className="border border-carbon-blue/8 px-4 py-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
          {title}
        </h3>
        <p className="mt-2 text-[11px] text-carbon-blue/45">No urgent risks</p>
      </section>
    );
  }

  const severityStyles =
    risk.severity === "critical"
      ? "border-red-200/60 bg-red-50/40"
      : "border-upcycle-orange/25 bg-upcycle-orange/[0.03]";

  return (
    <section className={`border px-4 py-3 ${severityStyles}`}>
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
        {title}
      </h3>
      <p className="mt-2 text-sm font-medium text-carbon-blue">{risk.label}</p>
      {risk.detail ? (
        <p className="mt-0.5 text-[11px] text-carbon-blue/50">{risk.detail}</p>
      ) : null}
      <ImpactContext items={risk.impact} />
    </section>
  );
}

/** Outlook Daily Focus — 4 sections, no scroll (North Star budget). */
export function DailyFocus({ payload }: { payload: M365DailyFocusPayload }) {
  return (
    <article className="dashboard-card overflow-hidden">
      <div className="space-y-4 px-5 py-5">
        <M365IntelligenceMetaStrip meta={payload.meta} />

        <section className="border border-carbon-blue/10 bg-carbon-blue/[0.02] px-4 py-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
            Today&apos;s focus
          </h3>
          <p className="mt-2 text-sm font-semibold leading-snug text-carbon-blue">
            {payload.todaysFocus}
          </p>
        </section>

        <section>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
            Top actions
          </h3>
          <div className="mt-2 space-y-2">
            {payload.topActions.map((action) => (
              <NextBestActionCard key={action.id} action={action} compact />
            ))}
          </div>
        </section>

        <RiskPanel title="Top relationship risk" risk={payload.topRelationshipRisk} />
        <RiskPanel title="Top opportunity risk" risk={payload.topOpportunityRisk} />
      </div>
    </article>
  );
}
