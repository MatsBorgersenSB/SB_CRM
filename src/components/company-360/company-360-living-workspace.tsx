"use client";

import { useMemo, useState } from "react";
import {
  buildCompanyHeroIdentity,
  companyHeroQuickEditToPatch,
  companyWebsiteHref,
} from "@/lib/company-identity";
import { getActivitiesForCompany } from "@/lib/activity-utils";
import { workspaceSectionStorageKey } from "@/lib/workspace-collapsible-state";
import { CompanyContactsTable } from "@/components/company-360/company-contacts-table";
import { CompanyWorkspaceHeader } from "@/components/company-360/company-workspace-header";
import {
  Company360ActionsBar,
  type Company360ActiveTool,
} from "@/components/company-360/company-360-actions-bar";
import { CompanyInlineEditPanel } from "@/components/company-360/company-inline-edit-panel";
import { QuickImportPanel } from "@/components/companies/quick-import-panel";
import { WebsiteDiscoveryPanel } from "@/components/companies/website-discovery-panel";
import { AttentionQueueTable } from "@/components/attention/attention-queue-table";
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
import type { UserRole } from "@/types/auth";
import type { Project } from "@/types/project";
import type { PipelineRow } from "@/types/pipeline";
import { getProjectsForCompany } from "@/lib/project-team-utils";
import { CompanyProjectsTable } from "@/components/project/company-projects-table";
import { DecisionJournalPanel } from "@/components/assistant/DecisionJournalPanel";
import { BuyingCenterGraph } from "@/components/companies/BuyingCenterGraph";
import { ReconBattlecardPanel } from "@/components/assistant/ReconBattlecardPanel";
import { MicroCampaignGenerator } from "@/components/marketing/MicroCampaignGenerator";
import type { CompanyHeroQuickEdit } from "@/lib/company-identity";
import { WorkspaceStack } from "@/components/ui/workspace-main";
import { WorkspacePanel } from "@/components/ui/smartcrm-icon";
import {
  canCreateOpportunity,
  canManageOpportunityStakeholders,
} from "@/lib/permissions";
import { useSignalExtract } from "@/context/signal-extract-context";
import { companyRouteKey } from "@/types/company-360";
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
  onCreateOpportunity?: (input: CreateOpportunityInput) => Promise<PipelineRow>;
  onAssignOpportunityStakeholder?: (
    dealId: string,
    contactId: string,
    projectRole: string,
  ) => Promise<PipelineRow>;
}) {
  const { company, header, pipelines: linkedPipelines } = snapshot;
  const identity = buildCompanyHeroIdentity(company);
  const { openSignalExtract } = useSignalExtract();
  const [documentCount, setDocumentCount] = useState(0);
  const [activeTool, setActiveTool] = useState<Company360ActiveTool>(null);
  const [createRequestId, setCreateRequestId] = useState(0);
  const [discoveryUrl, setDiscoveryUrl] = useState(
    company.Domain ? companyWebsiteHref(company.Domain) : "",
  );

  const companyActivities = useMemo(
    () => getActivitiesForCompany(scopedActivities, company),
    [scopedActivities, company],
  );

  const linkedProjects = useMemo(
    () => getProjectsForCompany(company.CompanyID, projects),
    [company.CompanyID, projects],
  );

  const sectionKey = (section: string) =>
    workspaceSectionStorageKey("company", company.CompanyID, section);

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
    document.getElementById("contacts")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleRunWebsiteDiscovery = (url: string) => {
    setDiscoveryUrl(url);
    setActiveTool("website-discovery");
  };

  return (
    <WorkspaceStack>
      <WorkspacePanel title="Company Details">
        <Company360ActionsBar
          role={role}
          activeTool={activeTool}
          onToolChange={setActiveTool}
          onNewContact={handleNewContact}
          onPasteExtract={() =>
            openSignalExtract({
              companyId: companyRouteKey(company),
              companyName: company.Title,
            })
          }
        />

        {activeTool === "quick-import" ? (
          <div className="mt-3">
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
          <div className="mt-3">
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

        {activeTool === "edit-company" ? (
          <div className="mt-4">
            <CompanyInlineEditPanel
              company={company}
              companies={companies}
              onSave={handleSaveCompany}
              onCancel={() => setActiveTool(null)}
            />
          </div>
        ) : (
          <CompanyWorkspaceHeader header={header} identity={identity} company={company} />
        )}
      </WorkspacePanel>

      <WorkspacePanel
        title="Decision Journal"
        id="decisions"
        collapsible
        collapseStorageKey={sectionKey("decisions")}
      >
        <DecisionJournalPanel
          companyId={companyRouteKey(company)}
          companyName={company.Title}
        />
      </WorkspacePanel>

      <WorkspacePanel
        title="Buying Center"
        id="buying-center"
        collapsible
        collapseStorageKey={sectionKey("buying-center")}
      >
        <BuyingCenterGraph
          companyId={companyRouteKey(company)}
          companyName={company.Title}
        />
      </WorkspacePanel>

      <WorkspacePanel
        title="Executive Recon"
        id="web-recon"
        collapsible
        collapseStorageKey={sectionKey("web-recon")}
      >
        <ReconBattlecardPanel
          companyId={companyRouteKey(company)}
          companyName={company.Title}
          domain={company.Domain || undefined}
        />
      </WorkspacePanel>

      <WorkspacePanel
        title="Micro-Campaigns"
        id="micro-campaigns"
        collapsible
        collapseStorageKey={sectionKey("micro-campaigns")}
      >
        <MicroCampaignGenerator
          companyId={companyRouteKey(company)}
          companyName={company.Title}
        />
      </WorkspacePanel>

      <WorkspacePanel
        title="Contacts"
        id="contacts"
        collapsible
        count={company.contacts.length}
        collapseStorageKey={sectionKey("contacts")}
      >
        <CompanyContactsTable
          contacts={company.contacts}
          companyId={company.CompanyID}
          companies={companies}
          role={role}
          activities={scopedActivities}
          projects={projects}
          onCreateContact={onCreateContact}
          onContactUpdate={onContactUpdate}
          onContactDelete={onContactDelete}
          onContactReassign={onContactReassign}
          onContactArchive={onContactArchive}
          createRequestId={createRequestId}
        />
      </WorkspacePanel>

      <WorkspacePanel
        title="Opportunities"
        id="opportunities"
        collapsible
        count={linkedPipelines.length}
        collapseStorageKey={sectionKey("opportunities")}
      >
        <CompanyOpportunitiesSection
          deals={linkedPipelines}
          commercialPackages={commercialPackages}
          company={company}
          canCreate={canCreateOpportunity(role) && Boolean(onCreateOpportunity)}
          canManageStakeholders={
            canManageOpportunityStakeholders(role) && Boolean(onAssignOpportunityStakeholder)
          }
          onCreateOpportunity={onCreateOpportunity}
          onAssignStakeholder={onAssignOpportunityStakeholder}
        />
      </WorkspacePanel>

      <WorkspacePanel
        title="Projects"
        id="projects"
        collapsible
        count={linkedProjects.length}
        collapseStorageKey={sectionKey("projects")}
      >
        <CompanyProjectsTable projects={linkedProjects} companyId={company.CompanyID} companies={companies} />
      </WorkspacePanel>

      <WorkspacePanel
        title="Activities"
        id="activities"
        collapsible
        count={companyActivities.length}
        collapseStorageKey={sectionKey("activities")}
      >
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

      <WorkspacePanel
        title="Documents"
        id="documents"
        collapsible
        defaultCollapsed
        count={documentCount}
        collapseStorageKey={sectionKey("documents")}
      >
        <WorkspaceDocumentsPanel
          context={workspaceDocumentsContextFromCompany(company)}
          pipelines={linkedPipelines}
          companies={companies}
          activities={scopedActivities}
          onDocumentCountChange={setDocumentCount}
        />
      </WorkspacePanel>

      <WorkspacePanel
        title="Attention"
        id="attention"
        collapsible
        count={attentionItems.length}
        defaultCollapsed={attentionItems.length === 0}
        collapseStorageKey={sectionKey("attention")}
      >
        <AttentionQueueTable items={attentionItems} />
      </WorkspacePanel>
    </WorkspaceStack>
  );
}
