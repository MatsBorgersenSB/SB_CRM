"use client";

import { useMemo } from "react";
import { useAuth } from "@/context/auth-context";
import { buildGrowthIntelligence } from "@/lib/growth-intelligence-data";
import { filterCompaniesForUser, filterPipelinesForUser } from "@/lib/permissions";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { GrowthDashboard } from "@/components/growth-intelligence/growth-dashboard";
import type { GrowthIntelligenceExtras } from "@/lib/growth-intelligence-data";

export function GrowthIntelligenceDashboardShell({
  companies,
  pipelines,
  extras,
}: {
  companies: Company[];
  pipelines: PipelineRow[];
  extras?: GrowthIntelligenceExtras;
}) {
  const { user } = useAuth();

  const scopedCompanies = useMemo(
    () => filterCompaniesForUser(companies, user),
    [companies, user],
  );

  const scopedPipelines = useMemo(
    () => filterPipelinesForUser(pipelines, user, companies),
    [pipelines, user, companies],
  );

  const snapshot = useMemo(() => {
    const scopedDealIds = new Set(scopedPipelines.map((deal) => deal.id));
    const scopedGrowthDeals = extras?.growthDeals
      ? (filterPipelinesForUser(extras.growthDeals, user, companies) as typeof extras.growthDeals)
      : undefined;
    for (const deal of scopedGrowthDeals ?? []) scopedDealIds.add(deal.id);
    const scopedExtras = extras
      ? {
          activities: extras.activities,
          growthDeals: scopedGrowthDeals,
          correspondence: extras.correspondence?.filter(
            (row) => !row.opportunityId || scopedDealIds.has(row.opportunityId),
          ),
        }
      : undefined;
    return buildGrowthIntelligence(scopedCompanies, scopedPipelines, scopedExtras);
  }, [scopedCompanies, scopedPipelines, extras, user, companies]);

  return <GrowthDashboard snapshot={snapshot} />;
}
