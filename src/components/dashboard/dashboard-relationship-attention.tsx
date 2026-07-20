import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { RelationshipAttention } from "@/lib/relationship-intelligence";
import {
  HEALTH_STATUS_STYLES,
  RelationshipTrendBadge,
} from "@/components/relationship/relationship-health-display";

const REASON_LABEL: Record<RelationshipAttention["reason"], string> = {
  no_recent_contact: "Last contact",
  overdue_followup: "Follow-up",
  stalled_opportunity: "Opportunity",
};

export function DashboardRelationshipAttention({
  items,
}: {
  items: RelationshipAttention[];
}) {
  return (
    <section className="dashboard-card flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-carbon-blue/8 px-4 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-carbon-blue">
            Relationships Needing Attention
          </h2>
          <p className="mt-0.5 text-[11px] text-carbon-blue/45">
            Ranked by health score and urgency
          </p>
        </div>
        <Link
          href="/companies"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-upcycle-orange"
        >
          View all
          <ArrowRight className="size-3" />
        </Link>
      </header>

      {items.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-carbon-blue/45">
          All relationships are healthy.
        </p>
      ) : (
        <ul className="flex-1 divide-y divide-carbon-blue/6">
          {items.map((item) => (
            <li key={item.companyId}>
              <Link
                href={item.href}
                className="group block px-4 py-3.5 transition-colors hover:bg-carbon-blue/[0.02]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-carbon-blue group-hover:text-upcycle-orange">
                      {item.companyName}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span
                        className={`border px-1.5 py-0.5 text-[9px] font-bold tabular-nums ${HEALTH_STATUS_STYLES[item.healthStatus]}`}
                      >
                        {item.healthScore}
                      </span>
                      <span className="text-[10px] font-medium text-carbon-blue/50">
                        {item.healthStatus}
                      </span>
                      <RelationshipTrendBadge trend={item.trend} />
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-[9px] font-semibold uppercase tracking-wider ${
                      item.priority === "critical"
                        ? "text-red-600"
                        : item.priority === "high"
                          ? "text-upcycle-orange"
                          : "text-carbon-blue/45"
                    }`}
                  >
                    {REASON_LABEL[item.reason]}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] text-carbon-blue/55">{item.detail}</p>
                <p className="mt-1 text-[10px] font-medium text-carbon-blue/65">
                  → {item.recommendedAction.action}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
