import Link from "next/link";
import { ArrowRight, Target } from "lucide-react";
import type { NextBestActionWithCompany } from "@/lib/next-best-action-engine";
import { company360Href } from "@/types/company-360";
import {
  RelationshipHealthBadge,
  NextBestActionCard,
} from "@/components/relationship/relationship-health-display";

export function DashboardNextBestActions({
  items,
}: {
  items: NextBestActionWithCompany[];
}) {
  return (
    <section className="dashboard-card">
      <header className="flex items-center justify-between border-b border-carbon-blue/8 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Target className="size-4 text-upcycle-orange" strokeWidth={1.75} />
          <h2 className="text-sm font-semibold text-carbon-blue">What to do next</h2>
        </div>
        <Link
          href="/companies"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-upcycle-orange"
        >
          All companies
          <ArrowRight className="size-3" />
        </Link>
      </header>

      {items.length === 0 ? (
        <p className="px-5 py-8 text-center text-xs text-carbon-blue/45">
          All relationships are on track.
        </p>
      ) : (
        <ul className="divide-y divide-carbon-blue/6">
          {items.map((item) => (
            <li key={`${item.companyId}-${item.id}`}>
              <Link
                href={company360Href(item.companyId)}
                className="group block px-5 py-4 transition-colors hover:bg-carbon-blue/[0.02]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-carbon-blue group-hover:text-upcycle-orange">
                    {item.companyName}
                  </p>
                  <RelationshipHealthBadge status={item.healthStatus} />
                </div>
                <div className="mt-2">
                  <NextBestActionCard action={item} compact showConfidence={false} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
