import type {
  M365DailyFocusCommitment,
  M365DailyFocusPayload,
  M365RiskBlock,
} from "@/types/m365";
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
        <p className="mt-2 text-[11px] text-carbon-blue/45">Nothing urgent at risk</p>
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

function CommitmentPanel({
  commitment,
}: {
  commitment: M365DailyFocusCommitment | null;
}) {
  if (!commitment) {
    return (
      <section className="border border-carbon-blue/8 px-4 py-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
          Open commitment
        </h3>
        <p className="mt-2 text-[11px] text-carbon-blue/45">No due commitments</p>
      </section>
    );
  }

  return (
    <section
      className={`border px-4 py-3 ${
        commitment.overdue
          ? "border-red-200/60 bg-red-50/40"
          : "border-carbon-blue/10 bg-carbon-blue/[0.02]"
      }`}
    >
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
        Open commitment
      </h3>
      <p className="mt-2 text-sm font-medium text-carbon-blue">{commitment.title}</p>
      <p className="mt-0.5 text-[11px] text-carbon-blue/50">{commitment.dueLabel}</p>
      <ImpactContext items={commitment.impact} />
      <a
        href={commitment.href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex text-[10px] font-semibold uppercase tracking-wider text-upcycle-orange hover:underline"
      >
        Open in SmartCRM
      </a>
    </section>
  );
}

/** FS-018 Daily Focus — exactly 4 blocks, no scroll. */
export function DailyFocus({
  payload,
  variant = "default",
}: {
  payload: M365DailyFocusPayload;
  variant?: "default" | "teams" | "outlook";
}) {
  const shell =
    variant === "teams" || variant === "outlook"
      ? "min-h-[100dvh] bg-white"
      : "dashboard-card overflow-hidden";

  return (
    <article className={shell}>
      <div className="space-y-3 px-4 py-4">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
          SmartCRM · Daily Focus
        </p>
        <M365IntelligenceMetaStrip meta={payload.meta} />

        <section className="border border-carbon-blue/10 bg-carbon-blue/[0.02] px-4 py-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
            Who to engage
          </h3>
          {payload.whoToEngage ? (
            <div className="mt-2">
              <NextBestActionCard action={payload.whoToEngage} compact />
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-carbon-blue/45">
              No external engagement ranked for today
            </p>
          )}
        </section>

        <RiskPanel title="At risk" risk={payload.workAtRisk} />
        <CommitmentPanel commitment={payload.openCommitmentDue} />

        <section>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
            Next best action
          </h3>
          <div className="mt-2">
            <NextBestActionCard action={payload.nextBestAction} compact />
          </div>
        </section>
      </div>
    </article>
  );
}
