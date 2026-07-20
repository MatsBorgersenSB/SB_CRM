"use client";

import { useMemo } from "react";
import { useAuth } from "@/context/auth-context";
import { buildGrowthIntelligence } from "@/lib/growth-intelligence-data";
import { filterCompaniesForUser, filterPipelinesForUser } from "@/lib/permissions";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { GrowthIntelligenceSectionId } from "@/types/growth-intelligence";
import {
  GrowthCompetitorsView,
  GrowthEventsView,
  GrowthMarketIntelligenceView,
  GrowthMarketSegmentsView,
  GrowthMarketingChannelsView,
  GrowthMembershipsView,
  GrowthPartnerEcosystemView,
  GrowthRecommendationsView,
  GrowthStrategicInitiativesView,
} from "@/components/growth-intelligence/growth-section-views";

const SECTION_VIEWS: Record<
  Exclude<GrowthIntelligenceSectionId, "dashboard">,
  React.ComponentType<{ snapshot: ReturnType<typeof buildGrowthIntelligence> }>
> = {
  competitors: GrowthCompetitorsView,
  events: GrowthEventsView,
  memberships: GrowthMembershipsView,
  "market-segments": GrowthMarketSegmentsView,
  "marketing-channels": GrowthMarketingChannelsView,
  "partner-ecosystem": GrowthPartnerEcosystemView,
  recommendations: GrowthRecommendationsView,
  "strategic-initiatives": GrowthStrategicInitiativesView,
  "market-intelligence": GrowthMarketIntelligenceView,
};

export function GrowthIntelligenceSectionShell({
  section,
  companies,
  pipelines,
}: {
  section: Exclude<GrowthIntelligenceSectionId, "dashboard">;
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

  const View = SECTION_VIEWS[section];
  return <View snapshot={snapshot} />;
}
