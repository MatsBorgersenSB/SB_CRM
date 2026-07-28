"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RoleSwitcher } from "@/components/auth/role-switcher";
import { BulkImportPanel } from "@/components/companies/bulk-import-panel";
import { CompaniesActionBar } from "@/components/companies/companies-action-bar";
import { CompaniesInsightsPanel } from "@/components/companies/companies-insights-panel";
import { CompaniesOperationsTable } from "@/components/companies/companies-operations-table";
import {
  CompaniesWorkspaceHeader,
  type CompaniesWorkspaceTool,
} from "@/components/companies/companies-workspace-header";
import { QuickImportPanel } from "@/components/companies/quick-import-panel";
import { WebsiteDiscoveryPanel } from "@/components/companies/website-discovery-panel";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { WorkspaceMain, WorkspaceStack } from "@/components/ui/workspace-main";
import { WorkspacePanel, SmartCRMIcon } from "@/components/ui/smartcrm-icon";
import { useAuth } from "@/context/auth-context";
import { useWorkspaceFilterBridge } from "@/hooks/use-workspace-filter-bridge";
import {
  buildCompanyOperationsWorkspace,
  COMPANY_ATTENTION_FILTERS,
  COMPANY_OPERATIONS_FILTERS,
  COMPANY_TYPE_FILTERS,
  filterCompanyOperationsByAttention,
  filterCompanyOperationsByHealth,
  filterCompanyOperationsByOwner,
  filterCompanyOperationsByTypes,
  filterCompanyOperationsRows,
  searchCompanyOperationsRows,
  sortCompanyOperationsRows,
  type CompanyAttentionFilter,
  type CompanyOperationsFilter,
} from "@/lib/company-operations-data";
import { filterCompaniesForUser } from "@/lib/permissions";
import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import { company360Href } from "@/types/company-360";
import type { PipelineRow } from "@/types/pipeline";
import type { FilterDefinition, WorkspaceFilterValues } from "@/types/workspace-filters";
import { normalizeMultiFilter, normalizeSingleFilter } from "@/types/workspace-filters";

type CompaniesOperationsShellProps = {
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  commercialPackages: CommercialPackage[];
};

const COMPANY_HEALTH_FILTERS = [
  { id: "all", label: "All Health" },
  { id: "healthy", label: "Healthy" },
  { id: "weak", label: "Weak" },
  { id: "strategic", label: "Strategic" },
] as const;

const COMPANY_FILTER_KEYS = ["type", "view", "attention", "health"] as const;

const DEFAULT_FILTERS: WorkspaceFilterValues = {
  type: [],
  view: "all",
  attention: "all",
  health: "all",
};

export function CompaniesOperationsShell({
  companies,
  pipelines,
  activities,
  commercialPackages,
}: CompaniesOperationsShellProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [companyRows, setCompanyRows] = useState(companies);
  const [toolbarFilters, setToolbarFilters] = useState<WorkspaceFilterValues>(DEFAULT_FILTERS);
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState("all");
  const [activeTool, setActiveTool] = useState<CompaniesWorkspaceTool>(null);

  const applyBridge = useCallback(
    (patch: { filters?: WorkspaceFilterValues; search?: string; owner?: string }) => {
      if (patch.filters) setToolbarFilters((current) => ({ ...current, ...patch.filters }));
      if (patch.search !== undefined) setSearch(patch.search);
      if (patch.owner !== undefined) setOwner(patch.owner);
    },
    [],
  );

  useWorkspaceFilterBridge("companies", [...COMPANY_FILTER_KEYS], applyBridge);

  const visibleCompanies = useMemo(
    () => filterCompaniesForUser(companyRows, user),
    [companyRows, user],
  );

  const workspace = useMemo(
    () =>
      buildCompanyOperationsWorkspace(
        visibleCompanies,
        pipelines,
        activities,
        commercialPackages,
        user,
      ),
    [visibleCompanies, pipelines, activities, commercialPackages, user],
  );

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
        id: "type",
        label: "Type",
        mode: "multi",
        options: COMPANY_TYPE_FILTERS.filter((item) => item.id !== "all").map((item) => ({
          value: item.id,
          label: item.label,
        })),
      },
      {
        id: "view",
        label: "View",
        mode: "single",
        emptyValue: "all",
        options: COMPANY_OPERATIONS_FILTERS.map((item) => ({ value: item.id, label: item.label })),
      },
      {
        id: "attention",
        label: "Attention",
        mode: "single",
        emptyValue: "all",
        options: COMPANY_ATTENTION_FILTERS.map((item) => ({ value: item.id, label: item.label })),
      },
      {
        id: "health",
        label: "Health",
        mode: "single",
        emptyValue: "all",
        options: COMPANY_HEALTH_FILTERS.map((item) => ({ value: item.id, label: item.label })),
      },
    ],
    [],
  );

  const filteredRows = useMemo(() => {
    const view = normalizeSingleFilter(toolbarFilters.view, "all") as CompanyOperationsFilter;
    const attention = normalizeSingleFilter(
      toolbarFilters.attention,
      "all",
    ) as CompanyAttentionFilter;
    const health = normalizeSingleFilter(toolbarFilters.health, "all");
    const types = normalizeMultiFilter(toolbarFilters.type);

    return sortCompanyOperationsRows(
      searchCompanyOperationsRows(
        filterCompanyOperationsByOwner(
          filterCompanyOperationsByHealth(
            filterCompanyOperationsByAttention(
              filterCompanyOperationsByTypes(filterCompanyOperationsRows(workspace.rows, view), types),
              attention,
            ),
            health,
          ),
          owner,
        ),
        search,
      ),
    );
  }, [workspace.rows, toolbarFilters, owner, search]);

  const handleFilterChange = useCallback((id: string, value: string | string[]) => {
    setToolbarFilters((current) => ({ ...current, [id]: value }));
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setToolbarFilters(DEFAULT_FILTERS);
    setSearch("");
    setOwner("all");
  }, []);

  const upsertCompany = useCallback((company: Company) => {
    setCompanyRows((current) => {
      const exists = current.some((record) => record.CompanyID === company.CompanyID);
      if (exists) {
        return current.map((record) =>
          record.CompanyID === company.CompanyID ? company : record,
        );
      }
      return [...current, company];
    });
  }, []);

  const handleCompanyCreated = useCallback(
    (company: Company) => {
      upsertCompany(company);
      setActiveTool(null);
      router.push(company360Href(company.CompanyID));
    },
    [router, upsertCompany],
  );

  const handleImported = useCallback(
    (company: Company) => {
      upsertCompany(company);
      router.refresh();
    },
    [router, upsertCompany],
  );

  return (
    <WorkspaceChrome>
      <header className="sticky top-0 z-10 flex h-11 shrink-0 items-center justify-between border-b border-carbon-blue/8 bg-[var(--dashboard-surface)]/95 px-4 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-2 text-[11px] text-carbon-blue/55">
          <SmartCRMIcon name="company" size="xs" />
          <span className="font-semibold text-carbon-blue">Companies</span>
        </div>
        <RoleSwitcher companies={companyRows} />
      </header>

      <WorkspaceMain>
        <WorkspaceStack>
          <section className="dashboard-card flex min-h-0 flex-col overflow-hidden p-4 sm:p-6">
            <CompaniesWorkspaceHeader
              role={user.role}
              activeTool={activeTool}
              onToolChange={setActiveTool}
            />

            {activeTool === "new-company" ? (
              <div className="mt-4 border border-carbon-blue/10 bg-white p-3">
                <CompaniesActionBar
                  embedded
                  open
                  onOpenChange={(open) => {
                    if (!open) setActiveTool(null);
                  }}
                  onCreated={handleCompanyCreated}
                  role={user.role}
                  companies={visibleCompanies}
                />
              </div>
            ) : null}

            {activeTool === "quick-import" ? (
              <div className="mt-4">
                <QuickImportPanel
                  embedded
                  role={user.role}
                  companies={companyRows}
                  onImported={handleImported}
                  onRunWebsiteDiscovery={() => setActiveTool("website-discovery")}
                />
              </div>
            ) : null}

            {activeTool === "website-discovery" ? (
              <div className="mt-4">
                <WebsiteDiscoveryPanel
                  embedded
                  role={user.role}
                  companies={companyRows}
                  onImported={handleImported}
                />
              </div>
            ) : null}

            {activeTool === "bulk-import" ? (
              <div className="mt-4">
                <BulkImportPanel embedded role={user.role} companies={companyRows} onImported={handleImported} />
              </div>
            ) : null}
          </section>

          <WorkspacePanel title="Accounts" count={filteredRows.length}>
            <div className="-mx-6 -mt-5 mb-4">
              <FilterToolbar
                filters={filterDefinitions}
                values={toolbarFilters}
                onChange={handleFilterChange}
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search companies…"
                owners={ownerOptions}
                ownerValue={owner}
                onOwnerChange={setOwner}
                entityLabel="Companies"
                totalCount={workspace.rows.length}
                filteredCount={filteredRows.length}
                defaultValues={DEFAULT_FILTERS}
                onClearAll={handleClearAllFilters}
              />
            </div>
            <CompaniesOperationsTable rows={filteredRows} />
          </WorkspacePanel>

          <CompaniesInsightsPanel summary={workspace.summary} />
        </WorkspaceStack>
      </WorkspaceMain>
    </WorkspaceChrome>
  );
}
