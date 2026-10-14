"use client";

import { useMemo } from "react";
import Link from "next/link";
import { WorkspacePanel } from "@/components/ui/smartcrm-icon";
import { analyzeContactRelationshipPortfolio } from "@/lib/contact-lifecycle-engine";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";

/**
 * People who changed role or company, or who look like duplicates.
 * Renders nothing when there is nothing to report — silence beats a row
 * of zero counters.
 */
export function ContactRelationshipPortfolioPanel({
  companies,
  pipelines,
  activities,
}: {
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
}) {
  const portfolio = useMemo(
    () =>
      analyzeContactRelationshipPortfolio({
        companies,
        pipelines,
        activities,
      }),
    [companies, pipelines, activities],
  );

  if (portfolio.contacts.length === 0) return null;

  return (
    <WorkspacePanel
      title="What changed"
      count={portfolio.contacts.length}
      id="relationship-intelligence"
      collapsible
    >
      <div className="flex flex-col gap-3">
        <p className="text-[13px] leading-relaxed text-carbon-blue/70">{portfolio.summary}</p>

        <ul className="divide-y divide-carbon-blue/8 border border-carbon-blue/10 bg-white">
          {portfolio.contacts.slice(0, 8).map((row) => (
            <li key={`${row.companyId}-${row.contactId}`} className="px-3 py-2.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={row.resolutionHref}
                    className="text-[13px] font-semibold text-carbon-blue hover:text-upcycle-orange"
                  >
                    {row.contactName}
                  </Link>
                  <p className="mt-0.5 text-[13px] text-carbon-blue/65">{row.companyName}</p>
                  <p className="mt-1 text-[13px] text-carbon-blue">{row.topInsightTitle}</p>
                </div>
                {row.insightCount > 1 ? (
                  <span className="shrink-0 text-[13px] text-carbon-blue/65">
                    +{row.insightCount - 1} more
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </WorkspacePanel>
  );
}
