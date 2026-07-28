"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { RoleSwitcher } from "@/components/auth/role-switcher";
import { OpportunitiesOperationsTable } from "@/components/opportunity/opportunities-operations-table";
import { OpportunityCreateModal } from "@/components/opportunity/opportunity-create-modal";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { WorkspaceMain } from "@/components/ui/workspace-main";
import { SmartCRMIcon } from "@/components/ui/smartcrm-icon";
import { useAuth } from "@/context/auth-context";
import { useWorkspaceFilterBridge } from "@/hooks/use-workspace-filter-bridge";
import { rankCommercialViability } from "@/lib/commercial-viability-engine";
import {
  buildOpportunityOperationsWorkspace,
  filterOpportunityOperationsByOwner,
  filterOpportunityOperationsByStages,
  filterOpportunityOperationsRows,
  OPPORTUNITY_OPERATIONS_FILTERS,
  searchOpportunityOperationsRows,
  sortOpportunityOperationsRows,
  type OpportunityOperationsFilter,
} from "@/lib/opportunity-operations-data";
import {
  canCreateOpportunity,
  filterCompaniesForUser,
  filterPipelinesForUser,
} from "@/lib/permissions";
import { EDITORIAL_GAP_BLOCK } from "@/lib/editorial-design-system";
import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { ViabilityRecommendation } from "@/types/commercial-viability";
import type { FilterDefinition, WorkspaceFilterValues } from "@/types/workspace-filters";
import { normalizeMultiFilter, normalizeSingleFilter } from "@/types/workspace-filters";

type OpportunitiesOperationsShellProps = {
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  commercialPackages: CommercialPackage[];
};

const STAGE_FILTERS = [
  { value: "prospecting", label: "Prospecting" },
  { value: "feedstock", label: "Feedstock Analysis" },
  { value: "contract", label: "Contract Negotiation" },
];

const CVM_FILTERS: Array<{ value: ViabilityRecommendation | "all"; label: string }> = [
  { value: "all", label: "All CVM" },
  { value: "pursue", label: "Pursue" },
  { value: "qualify", label: "Qualify" },
  { value: "deprioritize", label: "Deprioritize" },
  { value: "walk_away", label: "Walk Away" },
];

const ATTENTION_FILTERS = [
  { value: "all", label: "All Attention" },
  { value: "needs_attention", label: "Requires Attention" },
  { value: "healthy", label: "Healthy" },
];

const OPPORTUNITY_FILTER_KEYS = ["view", "stage", "cvm", "attention"] as const;

const DEFAULT_FILTERS: WorkspaceFilterValues = {
  view: "my_opportunities",
  stage: [],
  cvm: "all",
  attention: "all",
};

export function OpportunitiesOperationsShell({
  companies,
  pipelines,
  activities,
  commercialPackages,
}: OpportunitiesOperationsShellProps) {
  const { user } = useAuth();
  const [toolbarFilters, setToolbarFilters] = useState<WorkspaceFilterValues>(DEFAULT_FILTERS);
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createdPipelines, setCreatedPipelines] = useState<PipelineRow[]>([]);
  const [createdCompanies, setCreatedCompanies] = useState<Company[]>([]);
  const canCreate = canCreateOpportunity(user.role);

  const applyBridge = useCallback(
    (patch: { filters?: WorkspaceFilterValues; search?: string; owner?: string }) => {
      if (patch.filters) setToolbarFilters((current) => ({ ...current, ...patch.filters }));
      if (patch.search !== undefined) setSearch(patch.search);
      if (patch.owner !== undefined) setOwner(patch.owner);
    },
    [],
  );

  useWorkspaceFilterBridge("opportunities", [...OPPORTUNITY_FILTER_KEYS], applyBridge);
  useWorkspaceFilterBridge("cvm", [...OPPORTUNITY_FILTER_KEYS], applyBridge);

  const scopedCompanies = useMemo(() => {
    const base = filterCompaniesForUser(companies, user);
    const byId = new Map(base.map((company) => [company.CompanyID, company]));
    for (const company of createdCompanies) {
      byId.set(company.CompanyID, company);
    }
    return Array.from(byId.values());
  }, [companies, createdCompanies, user]);

  const livePipelines = useMemo(() => {
    const byId = new Map<string, PipelineRow>();
    for (const row of pipelines) byId.set(row.id, row);
    for (const row of createdPipelines) byId.set(row.id, row);
    return Array.from(byId.values());
  }, [pipelines, createdPipelines]);

  const scopedPipelines = useMemo(
    () => filterPipelinesForUser(livePipelines, user, companies),
    [livePipelines, user, companies],
  );

  const workspace = useMemo(
    () =>
      buildOpportunityOperationsWorkspace(
        scopedPipelines,
        scopedCompanies,
        activities,
        commercialPackages,
        user,
      ),
    [scopedPipelines, scopedCompanies, activities, commercialPackages, user],
  );

  const cvmByDeal = useMemo(() => {
    const ranked = rankCommercialViability(
      scopedPipelines,
      scopedCompanies,
      activities,
      commercialPackages,
    );
    return new Map(ranked.map((item) => [item.dealId, item.recommendation]));
  }, [scopedPipelines, scopedCompanies, activities, commercialPackages]);

  const ownerOptions = useMemo(() => {
    const labels = new Set<string>();
    for (const row of workspace.rows) {
      if (row.ownerLabel) labels.add(row.ownerLabel);
    }
    return Array.from(labels)
      .sort()
      .map((label) => ({ value: label, label }));
  }, [workspace.rows]);

  const filterDefinitions = useMemo<FilterDefinition[]>(
    () => [
      {
        id: "view",
        label: "View",
        mode: "single",
        emptyValue: "all",
        options: OPPORTUNITY_OPERATIONS_FILTERS.map((item) => ({
          value: item.id,
          label: item.label,
        })),
      },
      {
        id: "stage",
        label: "Stage",
        mode: "multi",
        options: STAGE_FILTERS,
      },
      {
        id: "cvm",
        label: "CVM",
        mode: "single",
        emptyValue: "all",
        options: CVM_FILTERS.map((item) => ({ value: item.value, label: item.label })),
      },
      {
        id: "attention",
        label: "Attention",
        mode: "single",
        emptyValue: "all",
        options: ATTENTION_FILTERS.map((item) => ({ value: item.value, label: item.label })),
      },
    ],
    [],
  );

  const filteredRows = useMemo(() => {
    const view = normalizeSingleFilter(
      toolbarFilters.view,
      "all",
    ) as OpportunityOperationsFilter;
    const stages = normalizeMultiFilter(toolbarFilters.stage);
    const cvm = normalizeSingleFilter(toolbarFilters.cvm, "all") as ViabilityRecommendation | "all";
    const attention = normalizeSingleFilter(toolbarFilters.attention, "all");

    let rows = filterOpportunityOperationsRows(workspace.rows, view, user);
    rows = filterOpportunityOperationsByStages(rows, stages);
    rows = filterOpportunityOperationsByOwner(rows, owner);
    rows = searchOpportunityOperationsRows(rows, search);

    if (attention === "needs_attention") rows = rows.filter((row) => row.needsAttention);
    if (attention === "healthy") rows = rows.filter((row) => row.isHealthy);

    if (cvm !== "all") {
      rows = rows.filter((row) => cvmByDeal.get(row.dealId) === cvm);
    }

    return sortOpportunityOperationsRows(rows);
  }, [workspace.rows, toolbarFilters, user, owner, search, cvmByDeal]);

  const primaryFocusDealId = filteredRows[0]?.dealId ?? null;

  const handleFilterChange = useCallback((id: string, value: string | string[]) => {
    setToolbarFilters((current) => ({ ...current, [id]: value }));
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setToolbarFilters(DEFAULT_FILTERS);
    setSearch("");
    setOwner("all");
  }, []);

  const handleOpportunityCreated = useCallback((deal: PipelineRow) => {
    setCreatedPipelines((current) =>
      current.some((row) => row.id === deal.id) ? current : [...current, deal],
    );
  }, []);

  const handleCompanyCreated = useCallback((company: Company) => {
    setCreatedCompanies((current) =>
      current.some((row) => row.CompanyID === company.CompanyID)
        ? current
        : [...current, company],
    );
  }, []);

  return (
    <WorkspaceChrome>
      <header className="sticky top-0 z-10 flex h-11 shrink-0 items-center justify-between border-b border-carbon-blue/8 bg-[var(--dashboard-surface)]/95 px-4 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-2 text-[11px] text-carbon-blue/55">
          <SmartCRMIcon name="opportunity" size="xs" />
          <span className="font-semibold text-carbon-blue">Opportunities</span>
          <span className="hidden text-carbon-blue/40 sm:inline">
            Opportunity understanding & decision matrix
          </span>
        </div>
        <div className="flex items-center gap-3">
          {canCreate ? (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 border border-upcycle-orange/30 bg-upcycle-orange/10 px-2.5 py-1 text-[10px] font-semibold text-upcycle-orange transition-colors hover:bg-upcycle-orange/15"
            >
              <SmartCRMIcon name="add" size="xs" />
              New Opportunity
            </button>
          ) : null}
          <Link
            href="/intelligence"
            className="text-[10px] font-semibold text-carbon-blue/45 hover:text-upcycle-orange"
          >
            Intelligence →
          </Link>
          <RoleSwitcher companies={scopedCompanies} />
        </div>
      </header>

      <WorkspaceMain>
        <div className={EDITORIAL_GAP_BLOCK}>
          <div>
            <p className="text-[11px] font-medium text-carbon-blue/45">Attention management</p>
            <h2 className="mt-1 text-lg font-semibold leading-snug tracking-tight text-carbon-blue">
              {workspace.understanding.headline}
            </h2>
            <p className="mt-1 text-[13px] text-carbon-blue/55">{workspace.understanding.subline}</p>
          </div>

          <div>
            <FilterToolbar
              filters={filterDefinitions}
              values={toolbarFilters}
              onChange={handleFilterChange}
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search objectives, unknowns, opportunities…"
              owners={ownerOptions}
              ownerValue={owner}
              onOwnerChange={setOwner}
              entityLabel="Opportunities"
              totalCount={workspace.rows.length}
              filteredCount={filteredRows.length}
              defaultValues={DEFAULT_FILTERS}
              onClearAll={handleClearAllFilters}
            />
            <div className="mt-4">
              <OpportunitiesOperationsTable
                rows={filteredRows}
                primaryFocusDealId={primaryFocusDealId}
              />
            </div>
          </div>
        </div>
      </WorkspaceMain>

      <OpportunityCreateModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={handleOpportunityCreated}
        onCompanyCreated={handleCompanyCreated}
        companies={scopedCompanies}
        role={user.role}
      />
    </WorkspaceChrome>
  );
}
