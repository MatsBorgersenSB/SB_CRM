"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { RoleSwitcher } from "@/components/auth/role-switcher";
import { WorkspaceDocumentsBrowseTable } from "@/components/documents/workspace-documents-browse-table";
import { MissingCriticalDocumentRow } from "@/components/smartdocs/smartdocs-intelligence-row";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { IntelligenceLead } from "@/components/ui/intelligence-lead";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { WorkspaceHeader } from "@/components/ui/workspace-header";
import { WorkspaceMain, WorkspaceStack } from "@/components/ui/workspace-main";
import { WorkspacePanel } from "@/components/ui/smartcrm-icon";
import { useAuth } from "@/context/auth-context";
import { useWorkspaceFilterBridge } from "@/hooks/use-workspace-filter-bridge";
import { buildSmartDocsIntelligence } from "@/lib/smartdocs-intelligence-data";
import {
  buildAllWorkspaceDocumentRows,
} from "@/lib/workspace-documents-data";
import {
  applyWorkspaceDocumentTableQuery,
  buildWorkspaceDocumentFilterDefinitions,
  defaultDocumentTableQuery,
  toggleDocumentSort,
} from "@/lib/workspace-documents-table";
import { WORKSPACE_PANEL_SURFACE } from "@/lib/workspace-design-system";
import {
  filterCompaniesForUser,
  filterPipelinesForUser,
} from "@/lib/permissions";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { SmartDocLibraryRecord } from "@/types/smartdoc-library";
import type { WorkspaceFilterValues } from "@/types/workspace-filters";

const DOCUMENT_FILTER_KEYS = ["origin", "category", "type", "status", "recency"];

type KnowledgeShellProps = {
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  library: SmartDocLibraryRecord[];
};

export function KnowledgeShell({
  companies,
  pipelines,
  activities,
  library,
}: KnowledgeShellProps) {
  const { user } = useAuth();
  const [tableQuery, setTableQuery] = useState(defaultDocumentTableQuery);

  const applyBridge = useCallback(
    (patch: { filters?: WorkspaceFilterValues; search?: string }) => {
      setTableQuery((current) => ({
        ...current,
        filters: patch.filters ? { ...current.filters, ...patch.filters } : current.filters,
        search: patch.search ?? current.search,
      }));
    },
    [],
  );

  useWorkspaceFilterBridge("smartdocs", DOCUMENT_FILTER_KEYS, applyBridge);

  const scopedCompanies = useMemo(
    () => filterCompaniesForUser(companies, user),
    [companies, user],
  );

  const scopedPipelines = useMemo(
    () => filterPipelinesForUser(pipelines, user, companies),
    [pipelines, user, companies],
  );

  const rows = useMemo(
    () => buildAllWorkspaceDocumentRows(library, scopedPipelines, scopedCompanies),
    [library, scopedPipelines, scopedCompanies],
  );

  const smartDocs = useMemo(
    () =>
      buildSmartDocsIntelligence(
        scopedPipelines,
        scopedCompanies,
        activities,
        library,
      ),
    [activities, library, scopedCompanies, scopedPipelines],
  );

  const missing = smartDocs.missingCriticalDocuments;
  const topMissing = missing[0];
  const topRisk = smartDocs.knowledgeAtRisk[0];
  const hasAttention = missing.length > 0 || Boolean(topRisk);

  const filterDefinitions = useMemo(
    () => buildWorkspaceDocumentFilterDefinitions(rows),
    [rows],
  );

  const displayedRows = useMemo(
    () => applyWorkspaceDocumentTableQuery(rows, tableQuery),
    [rows, tableQuery],
  );

  const handleClearAllFilters = useCallback(() => {
    setTableQuery(defaultDocumentTableQuery());
  }, []);

  const hero = useMemo(() => {
    if (topMissing) {
      return {
        title: `Missing on ${topMissing.entityName}`,
        summary: topMissing.detail,
        actionHref: topMissing.href,
        actionLabel: "File the document",
      };
    }
    if (topRisk) {
      return {
        title: topRisk.document.displayName,
        summary: topRisk.summary,
        actionHref: topRisk.href,
        actionLabel: "Open document",
      };
    }
    if (rows.length === 0) {
      return {
        title: "No SmartDocs in the library yet",
        summary:
          "File documents on a company, contact, opportunity, or project. SharePoint keeps the file; SmartCRM keeps category, type, and identity.",
        actionHref: "/companies",
        actionLabel: "Open a company to import",
      };
    }
    return {
      title: `${rows.length} document${rows.length === 1 ? "" : "s"} in the library`,
      summary:
        "Open a file for detail and SharePoint, or go to a company or opportunity to import.",
      actionHref: undefined,
      actionLabel: undefined,
    };
  }, [rows.length, topMissing, topRisk]);

  return (
    <WorkspaceChrome>
      <WorkspaceHeader
        scope="Knowledge workspace"
        title="SmartDocs"
        context="Find, file, and act on organizational documents"
        actions={<RoleSwitcher companies={scopedCompanies} />}
      />

      <WorkspaceMain>
        <WorkspaceStack>
          <IntelligenceLead
            eyebrow="Attention"
            title={hero.title}
            summary={hero.summary}
            vitals={[
              { label: "Documents", value: String(rows.length) },
              {
                label: "Missing",
                value: String(missing.length),
                highlight: missing.length > 0,
              },
              {
                label: "At risk",
                value: String(smartDocs.overview.atRiskCount),
                highlight: smartDocs.overview.atRiskCount > 0,
              },
            ]}
            action={
              hero.actionHref ? (
                <Link
                  href={hero.actionHref}
                  className="inline-flex border border-upcycle-orange bg-upcycle-orange px-4 py-2 text-[11px] font-semibold text-white hover:bg-upcycle-orange/90"
                >
                  {hero.actionLabel}
                </Link>
              ) : undefined
            }
          />

          {hasAttention && missing.length > 0 ? (
            <WorkspacePanel title="Needs a document" count={missing.length}>
              <div className="-mx-6 -my-5">
                {missing.slice(0, 3).map((item) => (
                  <MissingCriticalDocumentRow key={item.id} item={item} />
                ))}
              </div>
            </WorkspacePanel>
          ) : null}

          <WorkspacePanel title="Documents" count={displayedRows.length}>
            <div className="flex flex-col gap-4">
              <div className={`-mx-6 -mt-5 ${WORKSPACE_PANEL_SURFACE} rounded-none border-x-0 border-t-0`}>
                <FilterToolbar
                  filters={filterDefinitions}
                  values={tableQuery.filters}
                  onChange={(id, value) =>
                    setTableQuery((current) => ({
                      ...current,
                      filters: { ...current.filters, [id]: value },
                    }))
                  }
                  search={tableQuery.search}
                  onSearchChange={(search) =>
                    setTableQuery((current) => ({ ...current, search }))
                  }
                  searchPlaceholder="Search documents…"
                  className="border-b-0 bg-transparent px-0"
                  entityLabel="Documents"
                  totalCount={rows.length}
                  filteredCount={displayedRows.length}
                  defaultValues={defaultDocumentTableQuery().filters}
                  onClearAll={handleClearAllFilters}
                />
              </div>

              {rows.length === 0 ? (
                <p className="px-1 py-8 text-center text-sm text-carbon-blue/45">
                  Nothing filed yet. Import from a company, contact, opportunity, or project
                  workspace.
                </p>
              ) : displayedRows.length === 0 ? (
                <p className="px-1 py-8 text-center text-sm text-carbon-blue/45">
                  No documents match your filters. Try clearing search or filters.
                </p>
              ) : (
                <div className="-mx-6 -mb-5">
                  <WorkspaceDocumentsBrowseTable
                    rows={displayedRows}
                    sortKey={tableQuery.sortKey}
                    sortDir={tableQuery.sortDir}
                    onSort={(column) =>
                      setTableQuery((current) => toggleDocumentSort(current, column))
                    }
                  />
                </div>
              )}
            </div>
          </WorkspacePanel>
        </WorkspaceStack>
      </WorkspaceMain>
    </WorkspaceChrome>
  );
}
