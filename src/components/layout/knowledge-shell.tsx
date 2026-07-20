"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { RoleSwitcher } from "@/components/auth/role-switcher";
import { IntelligenceCenterGraph } from "@/components/intelligence-center/intelligence-center-graph";
import { IntelligenceCenterKnowledgeRisks } from "@/components/intelligence-center/intelligence-center-knowledge-risks";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { IntelligenceLead } from "@/components/ui/intelligence-lead";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { WorkspaceHeader } from "@/components/ui/workspace-header";
import { useAuth } from "@/context/auth-context";
import { buildSmartDocsIntelligence } from "@/lib/smartdocs-intelligence-data";
import { buildRelationshipGraphIntelligence } from "@/lib/relationship-graph-intelligence-data";
import {
  filterCompaniesForUser,
  filterPipelinesForUser,
} from "@/lib/permissions";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { FilterDefinition, WorkspaceFilterValues } from "@/types/workspace-filters";
import { normalizeSingleFilter } from "@/types/workspace-filters";
import { useWorkspaceFilterBridge } from "@/hooks/use-workspace-filter-bridge";

const SMARTDOCS_FILTER_KEYS = ["risk", "impact", "category", "deal"] as const;

const DEFAULT_SMARTDOCS_FILTERS: WorkspaceFilterValues = {
  risk: "all",
  impact: "all",
  category: "all",
  deal: "all",
};

type KnowledgeShellProps = {
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
};

export function KnowledgeShell({
  companies,
  pipelines,
  activities,
}: KnowledgeShellProps) {
  const { user } = useAuth();
  const [toolbarFilters, setToolbarFilters] =
    useState<WorkspaceFilterValues>(DEFAULT_SMARTDOCS_FILTERS);
  const [search, setSearch] = useState("");

  const applyBridge = useCallback(
    (patch: { filters?: WorkspaceFilterValues; search?: string }) => {
      if (patch.filters) setToolbarFilters((current) => ({ ...current, ...patch.filters }));
      if (patch.search !== undefined) setSearch(patch.search);
    },
    [],
  );

  useWorkspaceFilterBridge("smartdocs", [...SMARTDOCS_FILTER_KEYS], applyBridge);

  const scopedCompanies = useMemo(
    () => filterCompaniesForUser(companies, user),
    [companies, user],
  );

  const scopedPipelines = useMemo(
    () => filterPipelinesForUser(pipelines, user, companies),
    [pipelines, user, companies],
  );

  const smartDocs = useMemo(
    () => buildSmartDocsIntelligence(scopedPipelines, scopedCompanies, activities),
    [activities, scopedCompanies, scopedPipelines],
  );

  const graphIntel = useMemo(
    () => buildRelationshipGraphIntelligence(scopedCompanies, scopedPipelines, activities),
    [activities, scopedCompanies, scopedPipelines],
  );

  const { overview, knowledgeAtRisk } = smartDocs;
  const topRisk = knowledgeAtRisk[0];
  const hasGaps = overview.knowledgeAtRiskCount > 0;

  const filterDefinitions = useMemo<FilterDefinition[]>(
    () => [
      {
        id: "risk",
        label: "Risk",
        mode: "single",
        emptyValue: "all",
        options: [
          { value: "all", label: "All Risk" },
          { value: "at_risk", label: "At Risk" },
          { value: "missing", label: "Missing Critical" },
        ],
      },
      {
        id: "impact",
        label: "Impact",
        mode: "single",
        emptyValue: "all",
        options: [
          { value: "all", label: "All Impact" },
          { value: "high", label: "High Impact" },
          { value: "medium", label: "Medium Impact" },
        ],
      },
      {
        id: "category",
        label: "Category",
        mode: "single",
        emptyValue: "all",
        options: [
          { value: "all", label: "All Categories" },
          { value: "certificate", label: "Certificates" },
          { value: "technical", label: "Technical" },
          { value: "commercial", label: "Commercial" },
        ],
      },
      {
        id: "deal",
        label: "Deal",
        mode: "single",
        emptyValue: "all",
        options: [
          { value: "all", label: "All Deals" },
          ...scopedPipelines.slice(0, 12).map((deal) => ({
            value: deal.id,
            label: deal.assetName ?? deal.id,
          })),
        ],
      },
    ],
    [scopedPipelines],
  );

  const filteredSmartDocs = useMemo(() => {
    const risk = normalizeSingleFilter(toolbarFilters.risk, "all");
    const impact = normalizeSingleFilter(toolbarFilters.impact, "all");
    const category = normalizeSingleFilter(toolbarFilters.category, "all");
    const deal = normalizeSingleFilter(toolbarFilters.deal, "all");
    const q = search.trim().toLowerCase();

    const filteredRisk = knowledgeAtRisk.filter((item) => {
      if (deal !== "all" && item.document.pipelineId !== deal) return false;
      if (impact === "high" && item.insights.businessImpactLevel !== "High") return false;
      if (impact === "medium" && item.insights.businessImpactLevel !== "Medium") return false;
      if (category === "certificate" && !item.document.docCategory.toLowerCase().includes("cert")) {
        return false;
      }
      if (category === "technical" && !item.document.docCategory.toLowerCase().includes("tech")) {
        return false;
      }
      if (category === "commercial" && !item.document.docCategory.toLowerCase().includes("comm")) {
        return false;
      }
      if (!q) return true;
      return (
        item.document.displayName.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q)
      );
    });

    const filteredMissing =
      risk === "at_risk"
        ? []
        : smartDocs.missingCriticalDocuments.filter((item) => {
            if (deal !== "all" && !item.id.includes(deal)) return false;
            if (!q) return true;
            return item.label.toLowerCase().includes(q);
          });

    return {
      ...smartDocs,
      knowledgeAtRisk: risk === "missing" ? [] : filteredRisk,
      missingCriticalDocuments:
        risk === "at_risk" ? [] : risk === "missing" ? smartDocs.missingCriticalDocuments : filteredMissing,
    };
  }, [smartDocs, knowledgeAtRisk, toolbarFilters, search]);

  const totalKnowledgeCount =
    knowledgeAtRisk.length + smartDocs.missingCriticalDocuments.length;
  const filteredKnowledgeCount =
    filteredSmartDocs.knowledgeAtRisk.length +
    filteredSmartDocs.missingCriticalDocuments.length;

  const handleClearAllFilters = useCallback(() => {
    setToolbarFilters(DEFAULT_SMARTDOCS_FILTERS);
    setSearch("");
  }, []);

  return (
    <WorkspaceChrome>
        <WorkspaceHeader
          scope="Knowledge workspace"
          title="SmartDocs"
          context="Documents that breathe with your deals and accounts"
          actions={<RoleSwitcher companies={scopedCompanies} />}
        />

        <main className="flex-1 overflow-auto">
          <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-8">
            <IntelligenceLead
              eyebrow="Living knowledge record"
              title={
                hasGaps
                  ? `${overview.knowledgeAtRiskCount} knowledge gap${overview.knowledgeAtRiskCount === 1 ? "" : "s"} need attention`
                  : "Your document library is healthy"
              }
              summary={
                topRisk
                  ? `${topRisk.document.displayName} — ${topRisk.summary}`
                  : `${overview.totalDocuments} documents tracked · average health ${overview.averageHealthScore}`
              }
              vitals={[
                { label: "Tracked", value: String(overview.totalDocuments) },
                {
                  label: "At risk",
                  value: String(overview.atRiskCount),
                  highlight: overview.atRiskCount > 0,
                },
                { label: "Review queue", value: String(overview.reviewQueueCount) },
                {
                  label: "Missing critical",
                  value: String(overview.criticalMissingCount),
                  highlight: overview.criticalMissingCount > 0,
                },
              ]}
              action={
                topRisk ? (
                  <Link
                    href={topRisk.href}
                    className="text-sm font-semibold text-upcycle-orange hover:underline"
                  >
                    Review {topRisk.document.displayName} →
                  </Link>
                ) : undefined
              }
            />

            {hasGaps ? (
              <>
                <div className="-mx-4 border-y border-carbon-blue/10 bg-carbon-blue/[0.02] px-4 sm:-mx-8 sm:px-8">
                  <FilterToolbar
                    filters={filterDefinitions}
                    values={toolbarFilters}
                    onChange={(id, value) =>
                      setToolbarFilters((current) => ({ ...current, [id]: value }))
                    }
                    search={search}
                    onSearchChange={setSearch}
                    searchPlaceholder="Search documents…"
                    className="border-b-0 bg-transparent px-0"
                    entityLabel="SmartDocs"
                    totalCount={totalKnowledgeCount}
                    filteredCount={filteredKnowledgeCount}
                    defaultValues={DEFAULT_SMARTDOCS_FILTERS}
                    onClearAll={handleClearAllFilters}
                  />
                </div>
                <IntelligenceCenterKnowledgeRisks smartDocs={filteredSmartDocs} compact />
              </>
            ) : null}

            <CollapsibleSection
              title="Relationship network"
              description="How documents connect across accounts"
              tier="expert"
            >
              <IntelligenceCenterGraph graphIntel={graphIntel} />
            </CollapsibleSection>
          </div>
        </main>
    </WorkspaceChrome>
  );
}
