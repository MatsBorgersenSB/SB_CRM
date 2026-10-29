"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { WorkspaceDocumentsBrowseTable } from "@/components/documents/workspace-documents-browse-table";
import { KnowledgeProposalReview } from "@/components/ai/knowledge-proposal-review";
import {
  MissingCriticalDocumentRow,
  SmartDocsIntelligenceRow,
} from "@/components/smartdocs/smartdocs-intelligence-row";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { IntelligenceLead } from "@/components/ui/intelligence-lead";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { WorkspaceMain, WorkspaceStack } from "@/components/ui/workspace-main";
import { WorkspacePageTitle } from "@/components/ui/workspace-page-title";
import { WorkspaceTopBar } from "@/components/ui/workspace-top-bar";
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
import type { StoredResearchReport } from "@/types/research-report";
import type { SmartDocLibraryRecord } from "@/types/smartdoc-library";
import type { WorkspaceFilterValues } from "@/types/workspace-filters";
import { company360Href } from "@/types/company-360";
import { deal360Href } from "@/types/relationship-navigation";

const DOCUMENT_FILTER_KEYS = ["origin", "category", "type", "status", "recency"];

type KnowledgeShellProps = {
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  library: SmartDocLibraryRecord[];
  researchReports?: StoredResearchReport[];
  selectedReportId?: string;
};

export function KnowledgeShell({
  companies,
  pipelines,
  activities,
  library,
  researchReports = [],
  selectedReportId,
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

  const scopedLibrary = useMemo(() => {
    if (user.role !== "client_lead") return library;
    const companyIds = new Set(scopedCompanies.map((c) => c.CompanyID));
    const companyNames = new Set(scopedCompanies.map((c) => c.Title.toLowerCase()));
    const dealIds = new Set(scopedPipelines.map((p) => p.id));
    return library.filter(
      (record) =>
        (record.OwnerCompanyId && companyIds.has(record.OwnerCompanyId)) ||
        (record.DealId && dealIds.has(record.DealId)) ||
        (record.LinkedDealId && dealIds.has(record.LinkedDealId)) ||
        (record.ClientName && companyNames.has(record.ClientName.toLowerCase())),
    );
  }, [library, scopedCompanies, scopedPipelines, user.role]);

  const scopedActivities = useMemo(() => {
    if (user.role !== "client_lead") return activities;
    const companyNames = new Set(scopedCompanies.map((c) => c.Title.toLowerCase()));
    const dealIds = new Set(scopedPipelines.map((p) => p.id));
    return activities.filter(
      (activity) =>
        (activity.Company?.Title && companyNames.has(activity.Company.Title.toLowerCase())) ||
        (activity.Deal?.Title && dealIds.has(activity.Deal.Title)),
    );
  }, [activities, scopedCompanies, scopedPipelines, user.role]);

  const rows = useMemo(
    () =>
      buildAllWorkspaceDocumentRows(
        scopedLibrary,
        scopedPipelines,
        scopedCompanies,
        scopedActivities,
      ),
    [scopedLibrary, scopedPipelines, scopedCompanies, scopedActivities],
  );

  const smartDocs = useMemo(
    () =>
      buildSmartDocsIntelligence(
        scopedPipelines,
        scopedCompanies,
        scopedActivities,
        scopedLibrary,
      ),
    [scopedActivities, scopedLibrary, scopedCompanies, scopedPipelines],
  );

  const missing = smartDocs.missingCriticalDocuments;
  const topMissing = missing[0];
  const topRisk = smartDocs.knowledgeAtRisk[0];

  const filterDefinitions = useMemo(
    () => buildWorkspaceDocumentFilterDefinitions(rows),
    [rows],
  );

  const displayedRows = useMemo(
    () => applyWorkspaceDocumentTableQuery(rows, tableQuery),
    [rows, tableQuery],
  );

  const selectedReport = useMemo(() => {
    if (!selectedReportId) return null;
    return (
      researchReports.find(
        (r) =>
          r.reportId.toLowerCase() === selectedReportId.toLowerCase() ||
          r.id.toLowerCase() === selectedReportId.toLowerCase(),
      ) ?? null
    );
  }, [researchReports, selectedReportId]);

  const handleClearAllFilters = useCallback(() => {
    setTableQuery(defaultDocumentTableQuery());
  }, []);

  // Only speak when there is something to say: a missing critical document
  // or a document whose knowledge is at risk. Otherwise the list is enough.
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
    return null;
  }, [topMissing, topRisk]);

  return (
    <WorkspaceChrome>
      <WorkspaceTopBar icon="document" title="Knowledge" />

      <WorkspaceMain>
        <WorkspaceStack>
          <section className="dashboard-card p-4 sm:p-6">
            <WorkspacePageTitle
              icon="document"
              title="Knowledge"
              subtitle="The documents and validated intelligence behind our relationships and deals — what we hold, where it lives, and what is still missing."
            />
          </section>

          {selectedReport ? (
            <WorkspacePanel title={selectedReport.typeLabel}>
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[11px] font-semibold text-upcycle-orange">
                      {selectedReport.reportId} · Rev {selectedReport.revision}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-carbon-blue">
                      {selectedReport.title}
                    </h2>
                    <p className="mt-1 text-sm text-carbon-blue/65">
                      {selectedReport.strategicPriority}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[12px] font-semibold">
                    {selectedReport.metadata.companyId ? (
                      <Link
                        href={company360Href(selectedReport.metadata.companyId)}
                        className="text-upcycle-orange hover:underline"
                      >
                        {selectedReport.metadata.companyName ?? "Open company"} →
                      </Link>
                    ) : null}
                    {selectedReport.metadata.dealId ? (
                      <Link
                        href={deal360Href(selectedReport.metadata.dealId)}
                        className="text-upcycle-orange hover:underline"
                      >
                        {selectedReport.metadata.dealName ?? "Open opportunity"} →
                      </Link>
                    ) : null}
                    <Link
                      href="/knowledge"
                      className="border border-carbon-blue/15 px-2.5 py-1 text-carbon-blue/70 hover:border-upcycle-orange hover:text-upcycle-orange"
                    >
                      Close report
                    </Link>
                  </div>
                </div>
                <div className="grid gap-4 border-t border-carbon-blue/8 pt-4 sm:grid-cols-2">
                  {selectedReport.sections.map((section) => (
                    <div key={section.id} className="space-y-1.5">
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-carbon-blue/60">
                        {section.title}
                      </h3>
                      {section.paragraphs.map((paragraph, index) => (
                        <p key={index} className="text-[13px] leading-relaxed text-carbon-blue/80">
                          {paragraph}
                        </p>
                      ))}
                      {section.bullets.length > 0 ? (
                        <ul className="space-y-1 text-[13px] text-carbon-blue/80">
                          {section.bullets.map((bullet, index) => (
                            <li key={index}>
                              <span className="font-semibold text-carbon-blue">
                                {bullet.label}
                              </span>
                              {bullet.detail ? (
                                <span className="text-carbon-blue/65"> — {bullet.detail}</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </WorkspacePanel>
          ) : null}

          {hero ? (
            <IntelligenceLead
              eyebrow="Needs attention"
              title={hero.title}
              summary={hero.summary}
              vitals={[
                ...(missing.length > 0
                  ? [{ label: "Missing", value: String(missing.length), highlight: true }]
                  : []),
                ...(smartDocs.overview.atRiskCount > 0
                  ? [
                      {
                        label: "At risk",
                        value: String(smartDocs.overview.atRiskCount),
                        highlight: true,
                      },
                    ]
                  : []),
              ]}
              action={
                hero.actionHref ? (
                  <Link
                    href={hero.actionHref}
                    className="inline-flex border border-upcycle-orange bg-upcycle-orange px-4 py-2 text-[13px] font-semibold text-white hover:bg-upcycle-orange/90"
                  >
                    {hero.actionLabel}
                  </Link>
                ) : undefined
              }
            />
          ) : null}

          {missing.length > 0 ? (
            <WorkspacePanel title="Needs a document" count={missing.length}>
              <div className="-mx-6 -my-5">
                {missing.slice(0, 3).map((item) => (
                  <MissingCriticalDocumentRow key={item.id} item={item} />
                ))}
              </div>
            </WorkspacePanel>
          ) : null}

          {smartDocs.knowledgeAtRisk.length > 0 ? (
            <WorkspacePanel
              title="Knowledge at risk"
              count={smartDocs.knowledgeAtRisk.length}
            >
              <div className="-mx-6 -my-5">
                {smartDocs.knowledgeAtRisk.slice(0, 3).map((item) => (
                  <SmartDocsIntelligenceRow key={item.document.id} item={item} />
                ))}
              </div>
            </WorkspacePanel>
          ) : null}

          <KnowledgeProposalReview
            scope={{ all: true }}
            role={user.role}
            variant="collapsed"
          />

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
                <p className="px-1 py-8 text-center text-sm text-carbon-blue/65">
                  Nothing filed yet. Import from a company, contact, opportunity, or project
                  workspace.
                </p>
              ) : displayedRows.length === 0 ? (
                <p className="px-1 py-8 text-center text-sm text-carbon-blue/65">
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
