"use client";

import { useMemo } from "react";
import Link from "next/link";
import { analyzeContactRelationshipPortfolio } from "@/lib/contact-lifecycle-engine";
import { CONTACT_RELATIONSHIP_INTELLIGENCE } from "@/lib/smart-assist-config";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";

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

  return (
    <div className="flex flex-col gap-3">
      <div className="border border-upcycle-orange/20 bg-upcycle-orange/[0.04] px-3 py-2.5">
        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-upcycle-orange">
          SmartAssist · {CONTACT_RELATIONSHIP_INTELLIGENCE.title}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/70">{portfolio.summary}</p>
        <p className="mt-1 text-[10px] italic text-carbon-blue/50">
          {CONTACT_RELATIONSHIP_INTELLIGENCE.mantra}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        {(
          [
            ["Role changes", portfolio.totals.roleChanges],
            ["Company changes", portfolio.totals.companyChanges],
            ["Duplicates", portfolio.totals.duplicates],
            ["Opportunities", portfolio.totals.opportunities],
          ] as const
        ).map(([label, count]) => (
          <div key={label} className="border border-carbon-blue/10 bg-white px-3 py-2">
            <p className="text-[9px] font-bold uppercase tracking-wider text-carbon-blue/40">
              {label}
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-carbon-blue">{count}</p>
          </div>
        ))}
      </div>

      {portfolio.contacts.length === 0 ? (
        <p className="px-1 text-xs text-carbon-blue/50">
          No lifecycle signals detected across the contact portfolio.
        </p>
      ) : (
        <ul className="divide-y divide-carbon-blue/8 border border-carbon-blue/10 bg-white">
          {portfolio.contacts.slice(0, 8).map((row) => (
            <li key={`${row.companyId}-${row.contactId}`} className="px-3 py-2.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={row.resolutionHref}
                    className="text-xs font-semibold text-carbon-blue hover:text-upcycle-orange"
                  >
                    {row.contactName}
                  </Link>
                  <p className="mt-0.5 text-[10px] text-carbon-blue/50">{row.companyName}</p>
                  <p className="mt-1 text-[11px] text-carbon-blue/65">{row.topInsightTitle}</p>
                </div>
                <span className="shrink-0 border border-carbon-blue/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/45">
                  {row.insightCount} signal{row.insightCount === 1 ? "" : "s"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
