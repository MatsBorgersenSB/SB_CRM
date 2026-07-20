"use client";

import { useMemo } from "react";
import { useAuth } from "@/context/auth-context";
import { buildGrowthIntelligence } from "@/lib/growth-intelligence-data";
import { filterCompaniesForUser, filterPipelinesForUser } from "@/lib/permissions";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { GrowthDashboard } from "@/components/growth-intelligence/growth-dashboard";

export function GrowthIntelligenceDashboardShell({
  companies,
  pipelines,
}: {
  companies: Company[];
  pipelines: PipelineRow[];
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

  const snapshot = useMemo(
    () => buildGrowthIntelligence(scopedCompanies, scopedPipelines),
    [scopedCompanies, scopedPipelines],
  );

  return <GrowthDashboard snapshot={snapshot} />;
}
