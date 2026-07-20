import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ExecutiveBriefing } from "@/lib/intelligence-center-briefing";
import { ImpactContext } from "@/components/ui/impact-context";
import { IntelligenceLead } from "@/components/ui/intelligence-lead";

export function IntelligenceCenterNeedsAttention({
  briefing,
}: {
  briefing: ExecutiveBriefing;
}) {
  return (
    <IntelligenceLead
      eyebrow="Intelligence workspace"
      title={briefing.needsAttention}
      summary={briefing.whatChanged}
    />
  );
}

export function IntelligenceCenterGrowing({
  briefing,
  bare = false,
}: {
  briefing: ExecutiveBriefing;
  bare?: boolean;
}) {
  if (briefing.growingItems.length === 0) {
    return (
      <p className="text-sm text-carbon-blue/45">No accelerating relationships or deals right now.</p>
    );
  }

  const list = (
    <ul className={bare ? "space-y-3" : "divide-y divide-carbon-blue/6"}>
      {briefing.growingItems.map((item) => (
        <li key={item.id}>
          <Link
            href={item.href}
            className={`group flex items-center justify-between gap-4 ${bare ? "block" : "px-6 py-4 hover:bg-carbon-blue/[0.02]"}`}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-carbon-blue group-hover:text-upcycle-orange">
                {item.label}
              </p>
              <p className="mt-0.5 text-[11px] text-carbon-blue/45">{item.detail}</p>
            </div>
            {!bare ? (
              <ArrowRight className="size-4 shrink-0 text-carbon-blue/20 group-hover:text-upcycle-orange" />
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );

  if (bare) {
    return (
      <div>
        <p className="mb-3 text-sm text-carbon-blue/55">{briefing.growingNarrative}</p>
        {list}
      </div>
    );
  }

  return (
    <section className="dashboard-card overflow-hidden">
      <header className="border-b border-carbon-blue/8 px-6 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-carbon-blue/40">
          What is growing?
        </p>
        <p className="mt-2 text-sm text-carbon-blue/55">{briefing.growingNarrative}</p>
      </header>
      {list}
    </section>
  );
}

const DOMAIN_LABELS = {
  relationship: "Relationship",
  opportunity: "Opportunity",
  knowledge: "Knowledge",
  commitment: "Commitment",
} as const;

export function IntelligenceCenterPriorityActions({
  actions,
}: {
  actions: ExecutiveBriefing["priorityActions"];
}) {
  return (
    <section className="dashboard-card overflow-hidden">
      <header className="border-b border-carbon-blue/8 bg-upcycle-orange/[0.03] px-6 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-upcycle-orange/80">
          What should I do next?
        </p>
        {actions.length === 0 ? (
          <p className="mt-3 text-sm text-carbon-blue/45">No urgent actions — portfolio is on track.</p>
        ) : (
          <p className="mt-2 text-sm text-carbon-blue/55">
            {actions.length} prioritised action{actions.length === 1 ? "" : "s"} — start at the top.
          </p>
        )}
      </header>
      {actions.length > 0 ? (
        <ol className="divide-y divide-carbon-blue/6">
          {actions.map((item, index) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="group block px-6 py-5 transition-colors hover:bg-carbon-blue/[0.02]"
              >
                <div className="flex items-start gap-4">
                  <span className="flex size-7 shrink-0 items-center justify-center border border-carbon-blue/10 text-xs font-bold tabular-nums text-carbon-blue/50">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span
                      className={`text-[9px] font-semibold uppercase tracking-wider ${
                        item.priority === "critical"
                          ? "text-red-600"
                          : item.priority === "high"
                            ? "text-upcycle-orange"
                            : "text-carbon-blue/45"
                      }`}
                    >
                      {DOMAIN_LABELS[item.domain]}
                    </span>
                    <p className="mt-1 text-sm font-semibold text-carbon-blue group-hover:text-upcycle-orange">
                      {item.action}
                    </p>
                    <p className="mt-0.5 text-[11px] text-carbon-blue/45">{item.context}</p>
                    <ImpactContext items={item.impact} />
                  </div>
                  <ArrowRight className="mt-1 size-4 shrink-0 text-carbon-blue/20 group-hover:text-upcycle-orange" />
                </div>
              </Link>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
