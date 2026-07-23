"use client";

import { useMemo } from "react";
import Link from "next/link";
import { RoleSwitcher } from "@/components/auth/role-switcher";
import { IntelligenceCenterItemRow } from "@/components/intelligence-center/intelligence-center-item-row";
import { OpportunityPipelineIntelligencePanel } from "@/components/intelligence-center/opportunity-pipeline-intelligence-panel";
import { IntelligenceCenterKnowledgeRisks } from "@/components/intelligence-center/intelligence-center-knowledge-risks";
import { IntelligenceCenterSupportingMetrics } from "@/components/intelligence-center/intelligence-center-supporting-metrics";
import { IntelligenceCenterSection } from "@/components/intelligence-center/intelligence-center-section";
import {
  IntelligenceCenterNeedsAttention,
  IntelligenceCenterGrowing,
  IntelligenceCenterPriorityActions,
} from "@/components/intelligence-center/intelligence-center-executive-briefing";
import { buildOpportunityCommandCenter } from "@/lib/opportunity-command-center-data";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { WorkspaceHeader } from "@/components/ui/workspace-header";
import { WorkspaceMain, WorkspaceStack } from "@/components/ui/workspace-main";
import { FilterTransparencyBar } from "@/components/ui/filter-transparency-bar";
import { ImpactContext } from "@/components/ui/impact-context";
import { useAuth } from "@/context/auth-context";
import { buildExecutiveBriefing } from "@/lib/intelligence-center-briefing";
import {
  buildIntelligenceCenter,
  dealStageLabel,
  type IntelligenceCenterSnapshot,
} from "@/lib/intelligence-center-data";
import {
  filterCompaniesForUser,
  filterPipelinesForUser,
} from "@/lib/permissions";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { GrowthIntelligenceWorkspaceData } from "@/types/fs010-growth-intelligence";
import { GrowthIntelligenceWorkspace } from "@/components/growth/growth-intelligence-workspace";

type IntelligenceCenterShellProps = {
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  growthIntelligence?: GrowthIntelligenceWorkspaceData | null;
};

function StalledDealRow({
  item,
}: {
  item: IntelligenceCenterSnapshot["stalledOpportunities"][number];
}) {
  return (
    <Link
      href={item.href}
      className="group block border-b border-carbon-blue/6 px-6 py-4 last:border-b-0 hover:bg-carbon-blue/[0.02]"
    >
      <p className="text-sm font-semibold text-carbon-blue group-hover:text-upcycle-orange">
        {item.dealName}
      </p>
      <p className="mt-0.5 text-[11px] text-carbon-blue/45">
        {item.companyName} · {dealStageLabel(item.dealStage)} · {item.daysStalled}d stalled
      </p>
      <ImpactContext items={[item.nextBestAction, item.reason]} />
    </Link>
  );
}

export function IntelligenceCenterShell({
  companies,
  pipelines,
  activities,
  growthIntelligence = null,
}: IntelligenceCenterShellProps) {
  const { user } = useAuth();

  const scopedCompanies = useMemo(
    () => filterCompaniesForUser(companies, user),
    [companies, user],
  );

  const scopedPipelines = useMemo(
    () => filterPipelinesForUser(pipelines, user, companies),
    [pipelines, user, companies],
  );

  const scopedActivities = useMemo(() => {
    if (user.role !== "client_lead" || !user.companyId) return activities;
    const company = companies.find((c) => c.CompanyID === user.companyId);
    if (!company) return [];
    return activities.filter((a) => a.Company?.Title === company.Title);
  }, [activities, companies, user]);

  const snapshot = useMemo(
    () =>
      buildIntelligenceCenter(scopedCompanies, scopedPipelines, scopedActivities),
    [scopedActivities, scopedCompanies, scopedPipelines],
  );

  const briefing = useMemo(() => buildExecutiveBriefing(snapshot), [snapshot]);

  const pipelineSnapshot = useMemo(
    () => buildOpportunityCommandCenter(scopedPipelines, scopedCompanies, scopedActivities),
    [scopedActivities, scopedCompanies, scopedPipelines],
  );

  const hasRisk =
    snapshot.relationshipsAtRisk.length > 0 ||
    snapshot.stalledOpportunities.length > 0 ||
    snapshot.smartDocs.knowledgeAtRisk.length > 0;

  const intelligenceSignalCount =
    snapshot.relationshipsAtRisk.length +
    snapshot.stalledOpportunities.length +
    snapshot.smartDocs.knowledgeAtRisk.length;

  const totalPortfolioSignals = useMemo(() => {
    const fullSnapshot = buildIntelligenceCenter(companies, pipelines, activities);
    return (
      fullSnapshot.relationshipsAtRisk.length +
      fullSnapshot.stalledOpportunities.length +
      fullSnapshot.smartDocs.knowledgeAtRisk.length
    );
  }, [companies, pipelines, activities]);

  return (
    <WorkspaceChrome>
        <WorkspaceHeader
          scope="Intelligence workspace"
          title="What needs your attention"
          context="Portfolio signals ranked by impact"
          actions={<RoleSwitcher companies={scopedCompanies} />}
        />

        <WorkspaceMain>
          <WorkspaceStack>
            <FilterTransparencyBar
              entityLabel="Intelligence Signals"
              filteredCount={intelligenceSignalCount}
              totalCount={totalPortfolioSignals}
              activeFilters={[]}
            />
            <IntelligenceCenterNeedsAttention briefing={briefing} />
            <IntelligenceCenterPriorityActions actions={briefing.priorityActions} />

            {growthIntelligence ? (
              <CollapsibleSection
                title="Growth & Expansion (FS-010)"
                description="Account Health Index, expansion signals, and whitespace matrix"
                tier="nice-to-have"
              >
                <GrowthIntelligenceWorkspace data={growthIntelligence} />
              </CollapsibleSection>
            ) : null}

            <CollapsibleSection
              title="Pipeline intelligence"
              description="Revenue forecast, deals at risk, and largest opportunities"
              tier="nice-to-have"
            >
              <OpportunityPipelineIntelligencePanel snapshot={pipelineSnapshot} />
            </CollapsibleSection>

            {hasRisk ? (
              <CollapsibleSection
                title="What is at risk?"
                description={`${snapshot.relationshipsAtRisk.length + snapshot.stalledOpportunities.length + snapshot.smartDocs.knowledgeAtRisk.length} signals`}
                tier="nice-to-have"
              >
                <div className="flex flex-col gap-6">
                  {snapshot.relationshipsAtRisk.length > 0 ? (
                    <IntelligenceCenterSection
                      title="Relationships"
                      description="Accounts with weak or declining health"
                      count={snapshot.relationshipsAtRisk.length}
                      href="/companies"
                      emptyMessage="No relationships at risk."
                      accent="risk"
                    >
                      {snapshot.relationshipsAtRisk.map((item) => (
                        <IntelligenceCenterItemRow key={item.id} item={item} compact />
                      ))}
                    </IntelligenceCenterSection>
                  ) : null}

                  {snapshot.stalledOpportunities.length > 0 ? (
                    <IntelligenceCenterSection
                      title="Opportunities"
                      description="Deals stalled without recent activity"
                      count={snapshot.stalledOpportunities.length}
                      href="/opportunities"
                      emptyMessage="No stalled opportunities."
                      accent="risk"
                    >
                      {snapshot.stalledOpportunities.map((item) => (
                        <StalledDealRow key={`${item.dealId}-${item.companyId}`} item={item} />
                      ))}
                    </IntelligenceCenterSection>
                  ) : null}

                  {snapshot.smartDocs.knowledgeAtRisk.length > 0 ||
                  snapshot.smartDocs.missingCriticalDocuments.length > 0 ? (
                    <IntelligenceCenterKnowledgeRisks smartDocs={snapshot.smartDocs} compact />
                  ) : null}
                </div>
              </CollapsibleSection>
            ) : null}

            <CollapsibleSection title="What is growing?" tier="nice-to-have">
              <IntelligenceCenterGrowing briefing={briefing} bare />
            </CollapsibleSection>

            <CollapsibleSection title="Portfolio metrics" tier="expert">
              <IntelligenceCenterSupportingMetrics
                overview={snapshot.overview}
                smartDocs={snapshot.smartDocs}
                bare
              />
            </CollapsibleSection>
          </WorkspaceStack>
        </WorkspaceMain>
    </WorkspaceChrome>
  );
}
