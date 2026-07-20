"use client";

import { useMemo } from "react";
import Link from "next/link";
import { RoleSwitcher } from "@/components/auth/role-switcher";
import { OpportunityCommandCenterRow } from "@/components/opportunity/opportunity-command-center-row";
import { OpportunityCommandCenterSection } from "@/components/opportunity/opportunity-command-center-section";
import { OpportunityRevenueForecastPanel } from "@/components/opportunity/opportunity-forecast-panels";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { IntelligenceLead } from "@/components/ui/intelligence-lead";
import { WorkspaceHeader } from "@/components/ui/workspace-header";
import { useAuth } from "@/context/auth-context";
import { buildOpportunityCommandCenter } from "@/lib/opportunity-command-center-data";
import {
  filterCompaniesForUser,
  filterPipelinesForUser,
} from "@/lib/permissions";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";

type OpportunityCommandCenterShellProps = {
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
};

export function OpportunityCommandCenterShell({
  companies,
  pipelines,
  activities,
}: OpportunityCommandCenterShellProps) {
  const { user } = useAuth();

  const scopedCompanies = useMemo(
    () => filterCompaniesForUser(companies, user),
    [companies, user],
  );

  const scopedPipelines = useMemo(
    () => filterPipelinesForUser(pipelines, user, companies),
    [pipelines, user, companies],
  );

  const snapshot = useMemo(
    () => buildOpportunityCommandCenter(scopedPipelines, scopedCompanies, activities),
    [activities, scopedCompanies, scopedPipelines],
  );

  const topDeal = snapshot.dealsAtRisk[0];
  const leadTitle =
    snapshot.dealsAtRisk.length > 0
      ? `${snapshot.dealsAtRisk.length} deal${snapshot.dealsAtRisk.length === 1 ? "" : "s"} need action`
      : "Pipeline is healthy";
  const leadSummary =
    snapshot.dealsAtRisk.length > 0
      ? `${snapshot.revenueForecast.atRiskRevenueLabel} at risk across ${snapshot.revenueForecast.atRiskDealCount} flagged deal${snapshot.revenueForecast.atRiskDealCount === 1 ? "" : "s"}.`
      : `${snapshot.revenueForecast.weightedForecastLabel} weighted forecast across ${snapshot.revenueForecast.dealCount} active opportunities.`;

  return (
    <WorkspaceChrome>
        <WorkspaceHeader
          scope="Pipeline workspace"
          title="Opportunities"
          context="Deals ranked by what needs action"
          actions={
            <div className="flex items-center gap-3">
              <Link
                href="/deals"
                className="text-[10px] font-semibold text-carbon-blue/45 hover:text-upcycle-orange"
              >
                Table view
              </Link>
              <RoleSwitcher companies={scopedCompanies} />
            </div>
          }
        />

        <main className="flex-1 overflow-auto">
          <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-8">
            <IntelligenceLead
              eyebrow="Pipeline intelligence"
              title={leadTitle}
              summary={leadSummary}
              action={
                topDeal ? (
                  <Link
                    href={topDeal.href}
                    className="block border border-upcycle-orange/25 bg-upcycle-orange/[0.03] px-4 py-3 hover:bg-upcycle-orange/[0.06]"
                  >
                    <p className="text-sm font-semibold text-carbon-blue">{topDeal.dealName}</p>
                    <p className="mt-1 text-[11px] text-carbon-blue/55">{topDeal.nextBestAction.action}</p>
                  </Link>
                ) : undefined
              }
            />

            {snapshot.dealsAtRisk.length > 0 ? (
              <OpportunityCommandCenterSection
                title="Deals at risk"
                description="Needs action now"
                count={snapshot.dealsAtRisk.length}
                href="/deals"
                emptyMessage="No deals at risk."
                accent="risk"
              >
                {snapshot.dealsAtRisk.map((item) => (
                  <OpportunityCommandCenterRow key={item.dealId} item={item} />
                ))}
              </OpportunityCommandCenterSection>
            ) : null}

            <CollapsibleSection title="Revenue forecast" tier="nice-to-have">
              <div className="-mx-4 -mb-4 sm:-mx-5 sm:-mb-4">
                <OpportunityRevenueForecastPanel forecast={snapshot.revenueForecast} />
              </div>
            </CollapsibleSection>

            {snapshot.largestOpportunities.length > 0 ? (
              <CollapsibleSection
                title="Largest opportunities"
                description={`Top ${Math.min(snapshot.largestOpportunities.length, 5)} by value`}
                tier="nice-to-have"
              >
                <div className="dashboard-card overflow-hidden border-t-2 border-violet-500/20">
                  {snapshot.largestOpportunities.slice(0, 5).map((item) => (
                    <OpportunityCommandCenterRow key={item.dealId} item={item} />
                  ))}
                </div>
              </CollapsibleSection>
            ) : null}
          </div>
        </main>
    </WorkspaceChrome>
  );
}
