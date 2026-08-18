"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  buildCompanyHeroIdentity,
  companyHeroQuickEditToPatch,
  companyWebsiteHref,
} from "@/lib/company-identity";
import { getActivitiesForCompany, getActivitiesForDeal } from "@/lib/activity-utils";
import {
  pickPendingCommitment,
  toPendingCommitmentView,
} from "@/lib/complete-commitment";
import { CompanyWorkspaceHeader } from "@/components/company-360/company-workspace-header";
import {
  Company360ActionsBar,
  type Company360ActiveTool,
} from "@/components/company-360/company-360-actions-bar";
import { CompanyInlineEditPanel } from "@/components/company-360/company-inline-edit-panel";
import { QuickImportPanel } from "@/components/companies/quick-import-panel";
import { WebsiteDiscoveryPanel } from "@/components/companies/website-discovery-panel";
import { AttentionQueueTable } from "@/components/attention/attention-queue-table";
import { Company360OverviewStrips } from "@/components/company-360/company-360-overview-strips";
import { WorkspaceDocumentsPanel } from "@/components/documents/workspace-documents-panel";
import { CompanyRecentOutlook } from "@/components/company-360/company-recent-outlook";
import { EntityNewActivityButton } from "@/components/activities/entity-new-activity-button";
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
  companyLivingPageSection,
  companyMissionControlHref,
} from "@/types/company-mission-control";
import {
  buildCompany360Verdict,
  pickEngageContact,
} from "@/lib/company-360-verdict";
import { computeOpportunityMomentum } from "@/lib/opportunity-intelligence-engine";
import { opportunityStageLabel } from "@/lib/opportunity-overview";

/**
 * Company 360 — one living page: identity, next action, mail, people, work.
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
  const [lastMailAt, setLastMailAt] = useState<string | null>(null);
  const [lastMailByContactId, setLastMailByContactId] = useState<Record<string, string>>(
    {},
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

  const pendingCommitment = useMemo(() => {
    const pending = pickPendingCommitment(companyActivities);
    return pending ? toPendingCommitmentView(pending) : null;
  }, [companyActivities]);

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
    const section = companyLivingPageSection(viewParam ?? tabParam, hash);

    if (viewParam || (tabParam && tabParam !== "overview")) {
      const href = companyMissionControlHref(routeKey);
      router.replace(section ? `${href}#${section}` : href, { scroll: false });
    }

    if (section && typeof document !== "undefined") {
      window.requestAnimationFrame(() => {
        document.getElementById(section)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }, [searchParams, routeKey, router]);

  const stalledDeal = useMemo(() => {
    return linkedPipelines.find((deal) => {
      const dealActivities = getActivitiesForDeal(scopedActivities, deal.id);
      return computeOpportunityMomentum(dealActivities) === "Stalled";
    });
  }, [linkedPipelines, scopedActivities]);

  const verdict = useMemo(
    () =>
      buildCompany360Verdict({
        engineAction:
          "action" in header.recommendedAction && header.recommendedAction.action
            ? header.recommendedAction.action
            : header.recommendedAction.title ?? "Review this account",
        engineReason: header.recommendedAction.reason,
        lastActivityAt: companyActivities[0]?.ActivityDate ?? null,
        lastMailAt,
        stalledDealName: stalledDeal?.assetName ?? null,
        stalledDealStage: stalledDeal
          ? opportunityStageLabel(stalledDeal, commercialPackages)
          : null,
        engageContact: pickEngageContact(company.contacts),
      }),
    [
      header.recommendedAction,
      companyActivities,
      lastMailAt,
      stalledDeal,
      commercialPackages,
      company.contacts,
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

  const handleNewContact = useCallback(() => {
    setActiveTool(null);
    setCreateRequestId((value) => value + 1);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        document.getElementById("contacts")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }, []);

  const handleRunWebsiteDiscovery = (url: string) => {
    setDiscoveryUrl(url);
    setActiveTool("website-discovery");
  };

  const canCreateOpp =
    canCreateOpportunity(role) &&
    Boolean(onCreateOpportunity) &&
    isOpportunityEligibleCompany(company);

  return (
    <WorkspaceStack>
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
              pendingCommitment={pendingCommitment}
              onCompanyUpdated={onCompanyUpdated}
              onCommitmentChanged={() => router.refresh()}
              verdict={verdict}
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

      <div className="flex justify-end">
        <EntityNewActivityButton
          context={{
            companyId: company.CompanyID,
            companyName: company.Title,
          }}
          companies={companies}
          pipelines={linkedPipelines}
          showNewTask={false}
        />
      </div>

      <Company360OverviewStrips
        company={company}
        companies={companies}
        role={role}
        activities={scopedActivities}
        deals={linkedPipelines}
        pipelines={allPipelines}
        commercialPackages={commercialPackages}
        allProjects={projects}
        onCreateContact={onCreateContact}
        onContactUpdate={onContactUpdate}
        onContactDelete={onContactDelete}
        onContactReassign={onContactReassign}
        onContactArchive={onContactArchive}
        createRequestId={createRequestId}
        lastMailByContactId={lastMailByContactId}
        canCreateOpportunity={canCreateOpp}
        canManageOpportunityStakeholders={canManageOpportunityStakeholders(role)}
        onCreateOpportunity={onCreateOpportunity}
        onAssignOpportunityStakeholder={onAssignOpportunityStakeholder}
        onCompanyUpdated={onCompanyUpdated}
      />

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

      <WorkspacePanel title="Recent Outlook" id="outlook" icon="email">
        <CompanyRecentOutlook
          companyId={company.CompanyID}
          contacts={company.contacts}
          role={role}
          onLatestMailAt={setLastMailAt}
          onContactLastMail={setLastMailByContactId}
        />
      </WorkspacePanel>

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

      <p id="activities" className="px-1 text-[12px] text-carbon-blue/50">
        {companyActivities.length === 0
          ? "No CRM activities yet. Outlook mail still counts as last touch."
          : `${companyActivities.length} logged ${companyActivities.length === 1 ? "activity" : "activities"}.`}{" "}
        <Link href="/activities" className="font-semibold text-upcycle-orange hover:underline">
          Open activities
        </Link>
      </p>

      <WorkspacePanel
        title="Documents"
        id="documents"
        count={documentCount}
        collapsible
        defaultCollapsed
        collapseStorageKey={`company-${company.CompanyID}-documents`}
      >
        <WorkspaceDocumentsPanel
          context={workspaceDocumentsContextFromCompany(company)}
          pipelines={linkedPipelines}
          companies={companies}
          activities={scopedActivities}
          onDocumentCountChange={setDocumentCount}
        />
      </WorkspacePanel>
    </WorkspaceStack>
  );
}
