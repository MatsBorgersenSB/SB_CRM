"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  buildCompanyHeroIdentity,
  companyHeroQuickEditToPatch,
  companyWebsiteHref,
} from "@/lib/company-identity";
import { getActivitiesForCompany } from "@/lib/activity-utils";
import { CompanyWorkspaceHeader } from "@/components/company-360/company-workspace-header";
import { CompanyMissionControlTabBar } from "@/components/company-360/company-mission-control-tab-bar";
import {
  Company360ActionsBar,
  type Company360ActiveTool,
} from "@/components/company-360/company-360-actions-bar";
import { CompanyInlineEditPanel } from "@/components/company-360/company-inline-edit-panel";
import { QuickImportPanel } from "@/components/companies/quick-import-panel";
import { WebsiteDiscoveryPanel } from "@/components/companies/website-discovery-panel";
import { AttentionQueueTable } from "@/components/attention/attention-queue-table";
import { SmartAssistCopilotHost } from "@/components/smartassist/smart-assist-copilot-host";
import { Company360OverviewStrips } from "@/components/company-360/company-360-overview-strips";
import { CompanyOpportunitiesSection } from "@/components/opportunity/company-opportunities-section";
import { WorkspaceDocumentsPanel } from "@/components/documents/workspace-documents-panel";
import { SmartActivityWorkspace } from "@/components/activities/smart-activity-workspace";
import { workspaceDocumentsContextFromCompany } from "@/lib/workspace-documents-data";
import type { Company360Snapshot } from "@/lib/company-360-data";
import type { Company } from "@/types/company";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Activity } from "@/types/activity";
import type { CreateContactInput, UpdateContactInput } from "@/types/contact";
import type { CreateOpportunityInput } from "@/types/deal";
import type { AttentionItem } from "@/types/attention-item";
import { sortAttentionItems } from "@/types/attention-item";
import type { UserRole } from "@/types/auth";
import type { Project } from "@/types/project";
import type { PipelineRow } from "@/types/pipeline";
import { getProjectsForCompany } from "@/lib/project-team-utils";
import { CompanyProjectsTable } from "@/components/project/company-projects-table";
import type { CompanyHeroQuickEdit } from "@/lib/company-identity";
import { WorkspaceStack } from "@/components/ui/workspace-main";
import { WorkspacePanel } from "@/components/ui/smartcrm-icon";
import {
  canCreateOpportunity,
  canManageOpportunityStakeholders,
} from "@/lib/permissions";
import { isOpportunityEligibleCompany } from "@/lib/company-classification";
import { filterDismissedAttentionItems } from "@/lib/attention-dismiss-store";
import { companyRouteKey } from "@/types/company-360";
import {
  companyMissionControlHref,
  resolveCompanyMissionControlView,
  type CompanyMissionControlView,
} from "@/types/company-mission-control";

/**
 * Company 360 Mission Control — Overview · Work · Actions.
 * People (contacts) live on Overview.
 */
export function Company360LivingWorkspace({
  snapshot,
  commercialPackages,
  scopedActivities,
  attentionItems,
  companies,
  role,
  onCreateContact,
  onContactUpdate,
  onContactDelete,
  onContactReassign,
  onContactArchive,
  onCompanyUpdated,
  projects,
  onProjectUpdated,
  allPipelines,
  onCreateOpportunity,
  onAssignOpportunityStakeholder,
}: {
  snapshot: Company360Snapshot;
  commercialPackages: CommercialPackage[];
  scopedActivities: Activity[];
  attentionItems: AttentionItem[];
  companies: Company[];
  role: UserRole;
  onCreateContact?: (input: CreateContactInput) => Promise<void>;
  onContactUpdate?: (contactId: string, patch: UpdateContactInput) => Promise<void>;
  onContactDelete?: (contactId: string) => Promise<void>;
  onContactReassign?: (contactId: string, targetCompanyId: string) => Promise<void>;
  onContactArchive?: (contactId: string, archived: boolean) => Promise<void>;
  onCompanyUpdated: (company: Company) => void;
  projects: Project[];
  onProjectUpdated?: (project: Project) => void;
  /** Full pipeline list for “link existing opportunity” (not only linked deals). */
  allPipelines: PipelineRow[];
  onCreateOpportunity?: (input: CreateOpportunityInput) => Promise<PipelineRow>;
  onAssignOpportunityStakeholder?: (
    dealId: string,
    contactId: string,
    projectRole: string,
  ) => Promise<PipelineRow>;
}) {
  const { company, header, pipelines: linkedPipelines } = snapshot;
  const identity = buildCompanyHeroIdentity(company);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [documentCount, setDocumentCount] = useState(0);
  const [activeTool, setActiveTool] = useState<Company360ActiveTool>(null);
  const [createRequestId, setCreateRequestId] = useState(0);
  const [attentionDismissTick, setAttentionDismissTick] = useState(0);
  const [attentionHydrated, setAttentionHydrated] = useState(false);
  const [discoveryUrl, setDiscoveryUrl] = useState(
    company.Domain ? companyWebsiteHref(company.Domain) : "",
  );
  const [activeView, setActiveView] = useState<CompanyMissionControlView>(() =>
    resolveCompanyMissionControlView(
      searchParams.get("view"),
      null,
      searchParams.get("tab"),
    ),
  );

  useEffect(() => {
    setAttentionHydrated(true);
  }, []);

  useEffect(() => {
    setAttentionDismissTick(0);
  }, [attentionItems]);

  const companyActivities = useMemo(
    () => getActivitiesForCompany(scopedActivities, company),
    [scopedActivities, company],
  );

  const linkedProjects = useMemo(
    () =>
      getProjectsForCompany(company.CompanyID, projects, {
        contactIds: company.contacts.map((contact) => contact.ContactID),
      }),
    [company.CompanyID, company.contacts, projects],
  );

  const visibleAttentionItems = useMemo(() => {
    void attentionDismissTick;
    const sorted = sortAttentionItems(attentionItems);
    return attentionHydrated ? filterDismissedAttentionItems(sorted) : sorted;
  }, [attentionItems, attentionDismissTick, attentionHydrated]);

  const routeKey = companyRouteKey(company);

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const viewParam = searchParams.get("view");
    const tabParam = searchParams.get("tab");
    const resolved = resolveCompanyMissionControlView(viewParam, hash, tabParam);
    setActiveView(resolved);

    // Retire ?view=people / ?view=contacts → Overview People strip
    if (viewParam === "people" || viewParam === "contacts") {
      router.replace(`${companyMissionControlHref(routeKey)}#contacts`, {
        scroll: false,
      });
    }
  }, [searchParams, routeKey, router]);

  const navigateView = useCallback(
    (view: CompanyMissionControlView) => {
      setActiveView(view);
      router.replace(companyMissionControlHref(routeKey, view), { scroll: false });
    },
    [routeKey, router],
  );

  const viewCounts = useMemo(
    () => ({
      overview: visibleAttentionItems.length,
      work: linkedPipelines.length + linkedProjects.length,
      actions: companyActivities.length + documentCount,
    }),
    [
      visibleAttentionItems.length,
      linkedPipelines.length,
      linkedProjects.length,
      companyActivities.length,
      documentCount,
    ],
  );

  const handleImported = (updated: Company) => {
    onCompanyUpdated(updated);
  };

  const handleSaveCompany = async (edit: CompanyHeroQuickEdit) => {
    const { syncCompanyRecord } = await import("@/lib/sync-company");
    const patch = companyHeroQuickEditToPatch(edit, companies, company.AccountOwner);
    const updated = await syncCompanyRecord(company.CompanyID, patch);
    onCompanyUpdated(updated);
    setActiveTool(null);
  };

  const handleNewContact = () => {
    setActiveTool(null);
    setCreateRequestId((value) => value + 1);
    navigateView("overview");
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        document.getElementById("contacts")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  };

  const handleRunWebsiteDiscovery = (url: string) => {
    setDiscoveryUrl(url);
    setActiveTool("website-discovery");
  };

  return (
    <WorkspaceStack>
      <CompanyMissionControlTabBar
        active={activeView}
        onChange={navigateView}
        activityContext={{
          companyId: company.CompanyID,
          companyName: company.Title,
        }}
        companies={companies}
        pipelines={linkedPipelines}
        counts={viewCounts}
      />

      {activeView === "overview" ? (
        <>
          <section className="dashboard-card overflow-hidden">
            <div className="px-6 py-5">
              {activeTool === "edit-company" ? (
                <div>
                  <div className="mb-3 flex justify-end">
                    <Company360ActionsBar
                      role={role}
                      activeTool={activeTool}
                      onToolChange={setActiveTool}
                      onNewContact={handleNewContact}
                    />
                  </div>
                  <CompanyInlineEditPanel
                    company={company}
                    companies={companies}
                    onSave={handleSaveCompany}
                    onCancel={() => setActiveTool(null)}
                  />
                </div>
              ) : (
                <CompanyWorkspaceHeader
                  header={header}
                  identity={identity}
                  company={company}
                  trailing={
                    <Company360ActionsBar
                      role={role}
                      activeTool={activeTool}
                      onToolChange={setActiveTool}
                      onNewContact={handleNewContact}
                    />
                  }
                />
              )}

              {activeTool === "quick-import" ? (
                <div className="mt-4 border-t border-carbon-blue/8 pt-4">
                  <QuickImportPanel
                    role={role}
                    embedded
                    companies={companies}
                    contextCompanyId={company.CompanyID}
                    onImported={handleImported}
                    onRunWebsiteDiscovery={handleRunWebsiteDiscovery}
                  />
                </div>
              ) : null}

              {activeTool === "website-discovery" ? (
                <div className="mt-4 border-t border-carbon-blue/8 pt-4">
                  <WebsiteDiscoveryPanel
                    role={role}
                    embedded
                    companies={companies}
                    context="company"
                    initialUrl={discoveryUrl}
                    onImported={handleImported}
                  />
                </div>
              ) : null}
            </div>
          </section>

          <SmartAssistCopilotHost companyName={company.Title} />

          {visibleAttentionItems.length > 0 ? (
            <WorkspacePanel
              title="Attention"
              id="attention"
              count={visibleAttentionItems.length}
            >
              <AttentionQueueTable
                items={attentionItems}
                emptyMessage="No open attention for this company."
                onItemDismissed={() =>
                  setAttentionDismissTick((value) => value + 1)
                }
              />
            </WorkspacePanel>
          ) : null}

          <Company360OverviewStrips
            company={company}
            companies={companies}
            role={role}
            activities={scopedActivities}
            deals={linkedPipelines}
            pipelines={allPipelines}
            commercialPackages={commercialPackages}
            projects={linkedProjects}
            allProjects={projects}
            onOpenWork={() => navigateView("work")}
            onCreateContact={onCreateContact}
            onContactUpdate={onContactUpdate}
            onContactDelete={onContactDelete}
            onContactReassign={onContactReassign}
            onContactArchive={onContactArchive}
            createRequestId={createRequestId}
          />
        </>
      ) : null}

      {activeView === "work" ? (
        <>
          <WorkspacePanel
            title="Opportunities"
            id="opportunities"
            count={linkedPipelines.length}
          >
            <CompanyOpportunitiesSection
              deals={linkedPipelines}
              allPipelines={allPipelines}
              commercialPackages={commercialPackages}
              company={company}
              canCreate={
                canCreateOpportunity(role) &&
                Boolean(onCreateOpportunity) &&
                isOpportunityEligibleCompany(company)
              }
              canManageStakeholders={canManageOpportunityStakeholders(role)}
              onCreateOpportunity={onCreateOpportunity}
              onAssignStakeholder={onAssignOpportunityStakeholder}
              onCompanyUpdated={onCompanyUpdated}
            />
          </WorkspacePanel>

          <WorkspacePanel title="Projects" id="projects" count={linkedProjects.length}>
            <CompanyProjectsTable
              projects={linkedProjects}
              companyId={company.CompanyID}
              company={company}
              allProjects={projects}
              companies={companies}
              role={role}
              onProjectUpdated={onProjectUpdated}
            />
          </WorkspacePanel>
        </>
      ) : null}

      {activeView === "actions" ? (
        <>
          <WorkspacePanel title="Activities" id="activities" count={companyActivities.length}>
            <SmartActivityWorkspace
              activities={companyActivities}
              companies={companies}
              pipelines={linkedPipelines}
              attentionItems={attentionItems}
              context={{
                companyId: company.CompanyID,
                companyName: company.Title,
              }}
            />
          </WorkspacePanel>

          <WorkspacePanel title="Documents" id="documents" count={documentCount}>
            <WorkspaceDocumentsPanel
              context={workspaceDocumentsContextFromCompany(company)}
              pipelines={linkedPipelines}
              companies={companies}
              activities={scopedActivities}
              onDocumentCountChange={setDocumentCount}
            />
          </WorkspacePanel>
        </>
      ) : null}
    </WorkspaceStack>
  );
}
