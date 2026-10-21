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
import { CompanyDocumentKnowledgePanel } from "@/components/company-360/company-document-knowledge-panel";
import { AddFindingPanel } from "@/components/knowledge/add-finding-panel";
import { workspaceDocumentsContextFromCompany } from "@/lib/workspace-documents-data";
import type { SmartDocLibraryRecord } from "@/types/smartdoc-library";
import {
  EMPTY_DOCUMENT_KNOWLEDGE_STATE,
  type CompanyDocumentKnowledgeState,
} from "@/lib/company-document-knowledge";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import type { SourceFinding } from "@/lib/source-findings";
import type { Company360Snapshot } from "@/lib/company-360-data";
import type { Company, SharePointPerson } from "@/types/company";
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
import type { StandardBioUserRecord } from "@/types/user-access";
import { WorkspaceStack } from "@/components/ui/workspace-main";
import { CompanyDuplicateHintBanner } from "@/components/company-360/company-duplicate-hint-banner";
import { WorkspacePanel } from "@/components/ui/smartcrm-icon";
import {
  canCreateOpportunity,
  canManageOpportunityStakeholders,
} from "@/lib/permissions";
import {
  companyHasType,
  isOpportunityEligibleCompany,
} from "@/lib/company-classification";
import { hasConfirmedCompetitorKnowledge } from "@/lib/competitor-brief";
import { type CompanyCorrespondenceEvidence } from "@/lib/company-correspondence";
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
import {
  linkMailConversationToOpportunity,
  type MailOpportunityDraft,
} from "@/lib/mail-opportunity-draft";

/** Information budget — attention rows beyond this are noise, not prioritisation. */
const MAX_ATTENTION_ROWS = 5;

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
  onDeleteOpportunity,
  duplicateHint = null,
  initialLastMailAt = null,
  initialLastMailByContactId = {},
  smartDocs = [],
  documentKnowledge = EMPTY_DOCUMENT_KNOWLEDGE_STATE,
  assignableUsers = [],
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
  onDeleteOpportunity?: (dealId: string) => Promise<void>;
  duplicateHint?: import("@/lib/duplicate-management").CompanyDuplicateHint | null;
  initialLastMailAt?: string | null;
  initialLastMailByContactId?: Record<string, string>;
  correspondence?: CompanyCorrespondenceEvidence | null;
  smartDocs?: SmartDocLibraryRecord[];
  documentKnowledge?: CompanyDocumentKnowledgeState;
  assignableUsers?: StandardBioUserRecord[];
}) {
  const { company, header, pipelines: linkedPipelines } = snapshot;
  const identity = buildCompanyHeroIdentity(company);
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusMailId = searchParams.get("mail")?.trim() || null;
  const [documentCount, setDocumentCount] = useState(smartDocs.length);
  const [findings, setFindings] = useState<SourceFinding[]>(
    documentKnowledge.findings ?? [],
  );
  const [activeTool, setActiveTool] = useState<Company360ActiveTool>(null);
  const [createRequestId, setCreateRequestId] = useState(0);
  const [attentionDismissTick, setAttentionDismissTick] = useState(0);
  const [attentionHydrated, setAttentionHydrated] = useState(false);
  const [discoveryUrl, setDiscoveryUrl] = useState(
    company.Domain ? companyWebsiteHref(company.Domain) : "",
  );
  const [lastMailAt, setLastMailAt] = useState<string | null>(initialLastMailAt);
  const [linkedRevealed, setLinkedRevealed] = useState(false);
  const [ownerSaving, setOwnerSaving] = useState(false);
  const [lastMailByContactId, setLastMailByContactId] = useState<Record<string, string>>(
    initialLastMailByContactId,
  );
  const [mailRequest, setMailRequest] = useState<{
    id: number;
    draft: MailOpportunityDraft;
  } | null>(null);
  const [outlookReload, setOutlookReload] = useState(0);

  useEffect(() => {
    setFindings(documentKnowledge.findings ?? []);
  }, [documentKnowledge.findings]);

  const saveCompanyFindings = useCallback(
    async (next: SourceFinding[]) => {
      const previous = findings;
      setFindings(next);
      const response = await fetch(
        `/api/companies/${encodeURIComponent(company.CompanyID)}/findings`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            [AUTH_ROLE_HEADER]: role,
          },
          body: JSON.stringify({ findings: next }),
        },
      );
      if (!response.ok) {
        setFindings(previous);
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error || "Could not save finding");
      }
      const payload = (await response.json().catch(() => null)) as {
        findings?: SourceFinding[];
      } | null;
      if (Array.isArray(payload?.findings)) setFindings(payload.findings);
    },
    [company.CompanyID, findings, role],
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

  const linkedProjects = useMemo(() => {
    try {
      return getProjectsForCompany(company.CompanyID, projects, {
        contactIds: (company.contacts ?? []).map((contact) => contact.ContactID),
      });
    } catch (error) {
      console.error("[company-360] linked projects failed", error);
      return [];
    }
  }, [company.CompanyID, company.contacts, projects]);

  // Attention only says what the hero did not already say.
  const heroRuleId = header.recommendedAction?.ruleId ?? null;
  const heroAction = header.recommendedAction?.action ?? null;
  const nothingRecordedYet = companyActivities.length === 0 && !lastMailAt;
  const visibleAttentionItems = useMemo(() => {
    void attentionDismissTick;
    const sorted = sortAttentionItems(attentionItems).filter((item) => {
      if (heroRuleId && item.ruleId === heroRuleId) return false;
      if (heroAction && item.suggestedAiAction === heroAction) return false;
      // The hero already states "no interaction recorded yet" — per-person echoes add nothing.
      if (nothingRecordedYet && item.ruleId === "no_activity") return false;
      return true;
    });
    const live = attentionHydrated ? filterDismissedAttentionItems(sorted) : sorted;
    return live.slice(0, MAX_ATTENTION_ROWS);
  }, [attentionItems, attentionDismissTick, attentionHydrated, heroRuleId, heroAction, nothingRecordedYet]);

  const routeKey = companyRouteKey(company);

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const viewParam = searchParams.get("view");
    const tabParam = searchParams.get("tab");
    const section =
      companyLivingPageSection(viewParam ?? tabParam, hash) ??
      (searchParams.get("mail")?.trim() ? "outlook" : null);

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

  const verdict = useMemo(() => {
    const rec = header.recommendedAction;
    const engineAction =
      rec && typeof rec === "object" && "action" in rec && rec.action
        ? rec.action
        : rec?.title ?? "Review this account";
    return buildCompany360Verdict({
      engineAction,
      engineReason: rec?.reason ?? "",
      lastActivityAt: companyActivities[0]?.ActivityDate ?? null,
      lastMailAt,
      stalledDealName: stalledDeal?.assetName ?? null,
      stalledDealStage: stalledDeal
        ? opportunityStageLabel(stalledDeal, commercialPackages)
        : null,
      engageContact: pickEngageContact(company.contacts ?? []),
      competitorWatch: companyHasType(company, "Competitor"),
      hasCompetitorFacts: hasConfirmedCompetitorKnowledge(findings),
    });
  }, [
      header.recommendedAction,
      companyActivities,
      lastMailAt,
      stalledDeal,
      commercialPackages,
      company.contacts,
      findings,
      company,
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

  const handleOwnerChange = async (owner: SharePointPerson) => {
    if (owner.Id === company.AccountOwner?.Id) return;
    setOwnerSaving(true);
    try {
      const { syncCompanyRecord } = await import("@/lib/sync-company");
      const updated = await syncCompanyRecord(company.CompanyID, { AccountOwner: owner });
      onCompanyUpdated(updated);
    } catch (error) {
      console.error("[company-360] Could not change account owner", error);
    } finally {
      setOwnerSaving(false);
    }
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

  const openOpportunityFromMail = (draft: MailOpportunityDraft) => {
    setMailRequest({ id: Date.now(), draft });
    window.requestAnimationFrame(() => {
      document.getElementById("opportunities")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const handleOpportunityCreated = async (deal: { id: string }) => {
    const draft = mailRequest?.draft;
    if (!draft) return;
    try {
      await linkMailConversationToOpportunity(draft.conversationId, deal.id, role);
      setOutlookReload((value) => value + 1);
      setMailRequest(null);
    } catch (error) {
      console.error("[company-360] Could not attach mail to the new opportunity", error);
    }
  };

  const handleRunWebsiteDiscovery = (url: string) => {
    setDiscoveryUrl(url);
    setActiveTool("website-discovery");
  };

  const sellTo = isOpportunityEligibleCompany(company);
  const canCreateOpp =
    canCreateOpportunity(role) && Boolean(onCreateOpportunity) && sellTo;

  // Opportunities stay on the page: the list when any are linked, and for every
  // sell-to company so a new one can be opened here. Suppliers are not offered a deal.
  // Empty projects stay one line until the user asks to add one.
  const opportunitiesEmpty = linkedPipelines.length === 0;
  const projectsEmpty = linkedProjects.length === 0;
  const showOpportunitiesPanel = !opportunitiesEmpty || sellTo;
  const showProjectsPanel = !projectsEmpty || linkedRevealed;
  const showFoldedLine = !linkedRevealed && projectsEmpty;

  return (
    <WorkspaceStack>
      <CompanyDuplicateHintBanner hint={duplicateHint} />
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
                assignableUsers={assignableUsers}
                onSave={handleSaveCompany}
                onCancel={() => setActiveTool(null)}
              />
            </div>
          ) : (
            <CompanyWorkspaceHeader
              header={header}
              identity={identity}
              company={company}
              companies={companies}
              role={role}
              assignableUsers={assignableUsers}
              pendingCommitment={pendingCommitment}
              onCompanyUpdated={onCompanyUpdated}
              onCommitmentChanged={undefined}
              onOwnerChange={handleOwnerChange}
              ownerSaving={ownerSaving}
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

      <CompanyDocumentKnowledgePanel
        companyId={company.CompanyID}
        documents={smartDocs}
        initialState={documentKnowledge}
      />

      <div className="flex justify-end">
        <EntityNewActivityButton
          context={{
            companyId: company.CompanyID,
            companyName: company.Title,
          }}
          companies={companies}
          pipelines={linkedPipelines}
          showNewTask={false}
          documentCount={documentCount}
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
        outlook={
          <WorkspacePanel title="Recent Outlook" id="outlook" icon="email">
            <CompanyRecentOutlook
              companyId={company.CompanyID}
              contacts={company.contacts ?? []}
              role={role}
              deals={linkedPipelines}
              canCreateOpportunity={canCreateOpp}
              reloadToken={outlookReload}
              onCreateFromMail={openOpportunityFromMail}
              focusMailId={focusMailId}
              onLatestMailAt={(sentAt) => {
                if (sentAt) setLastMailAt(sentAt);
              }}
              onContactLastMail={(byId) => {
                setLastMailByContactId((current) => ({ ...current, ...byId }));
              }}
            />
          </WorkspacePanel>
        }
        showOpportunities={showOpportunitiesPanel}
        canCreateOpportunity={canCreateOpp}
        canManageOpportunityStakeholders={canManageOpportunityStakeholders(role)}
        onCreateOpportunity={onCreateOpportunity}
        onAssignOpportunityStakeholder={onAssignOpportunityStakeholder}
        onDeleteOpportunity={onDeleteOpportunity}
        onCompanyUpdated={onCompanyUpdated}
        mailRequest={mailRequest}
        onOpportunityCreated={handleOpportunityCreated}
        onMailDraftDismiss={() => setMailRequest(null)}
      />

      {showProjectsPanel ? (
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
      ) : null}

      {showFoldedLine ? (
        <p id="projects" className="px-1 text-[13px] text-carbon-blue/50">
          No projects linked yet.{" "}
          <button
            type="button"
            onClick={() => setLinkedRevealed(true)}
            className="font-semibold text-upcycle-orange hover:underline"
          >
            Add
          </button>
        </p>
      ) : null}

      {visibleAttentionItems.length > 0 ? (
        <WorkspacePanel
          title="Attention"
          id="attention"
          count={visibleAttentionItems.length}
        >
          <AttentionQueueTable
            items={visibleAttentionItems}
            emptyMessage="No open attention for this company."
            onItemDismissed={() =>
              setAttentionDismissTick((value) => value + 1)
            }
          />
        </WorkspacePanel>
      ) : null}

      <p id="activities" className="px-1 text-[13px] text-carbon-blue/50">
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

      {/* Writing comes after reading — the finding form lives collapsed at the bottom. */}
      <WorkspacePanel
        title={companyHasType(company, "Competitor") ? "Competitor knowledge" : "Findings"}
        id="findings"
        count={findings.length}
        collapsible
        defaultCollapsed={!companyHasType(company, "Competitor")}
        collapseStorageKey={`company-${company.CompanyID}-findings`}
      >
        <AddFindingPanel
          targetLabel="this company"
          findings={findings}
          onFindingsChange={saveCompanyFindings}
          mode={companyHasType(company, "Competitor") ? "competitor" : "default"}
          companyId={company.CompanyID}
        />
      </WorkspacePanel>
    </WorkspaceStack>
  );
}
