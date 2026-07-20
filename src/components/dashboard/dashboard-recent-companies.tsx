import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { CompanyRelationshipSummary } from "@/lib/relationship-intelligence";
import { company360Href } from "@/types/company-360";
import {
  HEALTH_STATUS_STYLES,
  RelationshipHealthBadge,
  RelationshipTrendBadge,
  NextBestActionCard,
} from "@/components/relationship/relationship-health-display";

export function DashboardRecentCompanies({
  summaries,
}: {
  summaries: CompanyRelationshipSummary[];
}) {
  return (
    <section className="dashboard-card">
      <header className="flex items-center justify-between border-b border-carbon-blue/8 px-5 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-carbon-blue">Recent Companies</h2>
          <p className="mt-0.5 text-[11px] text-carbon-blue/45">
            Relationship health at a glance
          </p>
        </div>
        <Link
          href="/companies"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-upcycle-orange"
        >
          Directory
          <ArrowRight className="size-3" />
        </Link>
      </header>

      <div className="grid gap-px bg-carbon-blue/6 sm:grid-cols-2 lg:grid-cols-3">
        {summaries.map((summary) => (
          <Link
            key={summary.company.CompanyID}
            href={company360Href(summary.company.CompanyID)}
            className="group flex flex-col gap-3 bg-[var(--dashboard-card)] p-4 transition-colors hover:bg-carbon-blue/[0.02]"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-carbon-blue group-hover:text-upcycle-orange">
                {summary.company.Title}
              </p>
              <span
                className={`shrink-0 border px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${HEALTH_STATUS_STYLES[summary.healthStatus]}`}
              >
                {summary.healthScore}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <RelationshipHealthBadge status={summary.healthStatus} />
              <RelationshipTrendBadge trend={summary.trend} />
            </div>

            <NextBestActionCard
              action={summary.healthReport.recommendedAction}
              compact
            />

            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px]">
              <div>
                <dt className="text-carbon-blue/40">Last contact</dt>
                <dd className="font-medium text-carbon-blue/70">
                  {summary.lastContactLabel}
                </dd>
              </div>
              <div>
                <dt className="text-carbon-blue/40">Open actions</dt>
                <dd className="font-medium text-carbon-blue/70">
                  {summary.openActions}
                </dd>
              </div>
              <div>
                <dt className="text-carbon-blue/40">Active deals</dt>
                <dd className="font-medium text-carbon-blue/70">
                  {summary.activeDeals}
                </dd>
              </div>
              <div>
                <dt className="text-carbon-blue/40">Industry</dt>
                <dd className="truncate font-medium text-carbon-blue/70">
                  {summary.company.Industry}
                </dd>
              </div>
            </dl>
          </Link>
        ))}
      </div>
    </section>
  );
}
