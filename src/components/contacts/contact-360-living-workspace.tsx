"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { analyzeOutlookReconciliation } from "@/lib/outlook-reconciliation-engine";
import {
  buildCareerTimeline,
  findDuplicateContacts,
  isTimelineMeaningful,
} from "@/lib/contact-lifecycle-engine";
import { buildCompanyRelationshipSummary } from "@/lib/relationship-intelligence";
import { AttentionQueueTable } from "@/components/attention/attention-queue-table";
import { Contact360EditPanel } from "@/components/contacts/contact-360-edit-panel";
import { Contact360Header } from "@/components/contacts/contact-360-header";
import { ContactHistoryPanel } from "@/components/contacts/contact-history-panel";
import { ContactLifecycleActionsBar } from "@/components/contacts/contact-lifecycle-actions-bar";
import { ContactMissionControlTabBar } from "@/components/contacts/contact-mission-control-tab-bar";
import { ContactRelationshipIntelligenceSection } from "@/components/contacts/contact-relationship-intelligence-section";
import {
  ContactArchiveConfirm,
  ContactLifecycleWizard,
} from "@/components/contacts/contact-lifecycle-wizard";
import { OpportunitiesOverviewTable } from "@/components/opportunity/opportunities-overview-table";
import { ContactOpportunityRolesTable } from "@/components/opportunity/contact-opportunity-roles-table";
import { WorkspaceDocumentsPanel } from "@/components/documents/workspace-documents-panel";
import { SmartActivityWorkspace } from "@/components/activities/smart-activity-workspace";
import { useSmartAssistActionHost } from "@/components/smartassist/smartassist-action-host";
import { useAuth } from "@/context/auth-context";
import { workspaceDocumentsContextFromContact } from "@/lib/workspace-documents-data";
import { canDeleteContact } from "@/lib/permissions";
import { getContactDisplayName, type UpdateContactInput } from "@/types/contact";
import type { EditableContactField as EditableContactFieldName } from "@/types/contact";
import type { EmploymentStatus } from "@/types/contact-lifecycle";
import { getActivitiesForContact } from "@/lib/activity-utils";
import type { GlobalContactRecord } from "@/lib/contact-utils";
import type { Activity } from "@/types/activity";
import type { AttentionItem } from "@/types/attention-item";
import type { OutlookEvidenceRecord } from "@/types/outlook-reconciliation";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { Contact } from "@/types/contact";
import type { PipelineRow } from "@/types/pipeline";
import type { Project } from "@/types/project";
import type { UserRole } from "@/types/auth";
import {
  contactMissionControlHref,
  resolveContactMissionControlView,
  type ContactMissionControlView,
} from "@/types/contact-mission-control";
import { getContactProjectRoles } from "@/lib/project-team-utils";
import { ContactProjectRolesTable } from "@/components/project/contact-project-roles-table";
import { WorkspaceStack } from "@/components/ui/workspace-main";
import { WorkspacePanel } from "@/components/ui/smartcrm-icon";

type LifecycleWizardMode = "transfer" | "merge" | "position" | null;

/**
 * Contact 360 — edit at header; history is read-only (Phase 1.31).
 */
export function Contact360LivingWorkspace({
  record,
  company,
  pipelines,
  companies,
  activities,
  commercialPackages,
  attentionItems,
  outlookEvidence,
  role,
  lifecycleAction,
  reconcileAction,
  onContactFieldCommit,
  onContactUpdate,
  onContactDelete,
  onContactArchive,
  onContactTransferred,
  onContactMerged,
  onReconciliationImported,
  projects,
  onProjectUpdated,
  onPipelineUpdated,
}: {
  record: GlobalContactRecord;
  company: Company;
  pipelines: PipelineRow[];
  companies: Company[];
  activities: Activity[];
  commercialPackages: CommercialPackage[];
  attentionItems: AttentionItem[];
  outlookEvidence: OutlookEvidenceRecord[];
  role: UserRole;
  lifecycleAction?: string | null;
  reconcileAction?: string | null;
  onContactFieldCommit: (
    contactId: string,
    field: EditableContactFieldName,
    value: string,
  ) => Promise<void>;
  onContactUpdate: (contactId: string, patch: UpdateContactInput) => Promise<void>;
  onContactDelete?: (contactId: string) => Promise<void>;
  onContactArchive: (contactId: string, archived: boolean) => Promise<void>;
  onContactTransferred: (contact: Contact, targetCompanyId: string) => void;
  onContactMerged: (contact: Contact, removedContactId: string) => void;
  onReconciliationImported?: () => void;
  projects: Project[];
  onProjectUpdated?: (project: Project) => void;
  onPipelineUpdated?: (pipeline: PipelineRow) => void;
}) {
  const { contact, linkedPipelineIds } = record;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [documentCount, setDocumentCount] = useState(0);
  const [activeView, setActiveView] = useState<ContactMissionControlView>(() =>
    resolveContactMissionControlView(searchParams.get("view")),
  );
  const [wizardMode, setWizardMode] = useState<LifecycleWizardMode>(
    lifecycleAction === "transfer" || lifecycleAction === "merge" || lifecycleAction === "position"
      ? lifecycleAction
      : null,
  );
  const [contactEditOpen, setContactEditOpen] = useState(lifecycleAction === "edit");
  const [archiveOpen, setArchiveOpen] = useState(lifecycleAction === "archive");
  const [archiving, setArchiving] = useState(false);
  const [employmentBusy, setEmploymentBusy] = useState(false);

  const { user } = useAuth();
  const { openEmailAssistant, EmailAssistantModal } = useSmartAssistActionHost({
    ownerName: user.displayName,
  });

  useEffect(() => {
    const hash =
      typeof window !== "undefined" ? window.location.hash : "";
    const next = resolveContactMissionControlView(searchParams.get("view"), hash);
    setActiveView(next);
  }, [searchParams]);

  const navigateView = useCallback(
    (view: ContactMissionControlView) => {
      setActiveView(view);
      router.replace(
        contactMissionControlHref(contact.ContactID, {
          companyId: record.companyId,
          view,
        }),
        { scroll: false },
      );
    },
    [contact.ContactID, record.companyId, router],
  );

  const contactActivities = useMemo(
    () => getActivitiesForContact(activities, contact.ContactID, contact),
    [activities, contact],
  );

  const relationshipSummary = useMemo(
    () => buildCompanyRelationshipSummary(company, activities, pipelines),
    [company, activities, pipelines],
  );

  const linkedDeals = useMemo(
    () =>
      linkedPipelineIds
        .map((dealId) => pipelines.find((p) => p.id === dealId))
        .filter((deal): deal is PipelineRow => Boolean(deal)),
    [linkedPipelineIds, pipelines],
  );

  const projectRoles = useMemo(
    () => getContactProjectRoles(contact.ContactID, projects),
    [contact.ContactID, projects],
  );

  const careerTimeline = useMemo(
    () => buildCareerTimeline(contact, company),
    [contact, company],
  );

  const showCareerTimeline = useMemo(
    () => isTimelineMeaningful(contact, careerTimeline),
    [contact, careerTimeline],
  );

  const duplicateCandidates = useMemo(() => {
    const duplicates = findDuplicateContacts(contact, record.companyId, {
      companies,
      pipelines,
      activities,
    });
    return duplicates.map((row) => ({
      contactId: row.contact.ContactID,
      label: `${getContactDisplayName(row.contact)} · ${row.companyName} (${row.reason})`,
    }));
  }, [contact, record.companyId, companies, pipelines, activities]);

  const hasMissingTouchpoint = useMemo(() => {
    const audit = analyzeOutlookReconciliation({
      companies,
      pipelines,
      activities,
      outlookEvidence,
      connected: outlookEvidence.length > 0,
    });
    return audit.missingTouchpoints.some(
      (row) => row.entityType === "contact" && row.entityId === contact.ContactID,
    );
  }, [companies, pipelines, activities, outlookEvidence, contact.ContactID]);

  const showEmailReconciliation = hasMissingTouchpoint || Boolean(reconcileAction);

  const canManage = canDeleteContact(role);

  const viewCounts = useMemo(
    () => ({
      overview: attentionItems.length,
      work: linkedDeals.length + projectRoles.length,
      actions: contactActivities.length + documentCount,
    }),
    [
      attentionItems.length,
      linkedDeals.length,
      projectRoles.length,
      contactActivities.length,
      documentCount,
    ],
  );

  const handleEmploymentStatusChange = async (status: EmploymentStatus) => {
    setEmploymentBusy(true);
    try {
      const patch: UpdateContactInput = {
        EmploymentStatus: status,
        IsSuspicious: status === "Suspicious",
      };
      if (status === "Former Employee" || status === "Left Company" || status === "Retired") {
        patch.IsArchived = contact.IsArchived ?? false;
      }
      await onContactUpdate(contact.ContactID, patch);
    } finally {
      setEmploymentBusy(false);
    }
  };

  const handleArchiveConfirm = async () => {
    setArchiving(true);
    try {
      await onContactArchive(contact.ContactID, !contact.IsArchived);
      setArchiveOpen(false);
    } finally {
      setArchiving(false);
    }
  };

  const toggleContactEdit = () => {
    setContactEditOpen((open) => !open);
  };

  const handleCompanyChange = (_contactId: string, targetCompanyId: string) => {
    onContactTransferred(contact, targetCompanyId);
  };

  return (
    <WorkspaceStack>
      {contactEditOpen ? (
        <Contact360EditPanel
          record={record}
          companies={companies}
          canDelete={canManage}
          onCancel={() => setContactEditOpen(false)}
          onContactUpdate={onContactUpdate}
          onContactDelete={onContactDelete}
          onCompanyChange={handleCompanyChange}
        />
      ) : (
        <Contact360Header
          contact={contact}
          companyId={record.companyId}
          companyName={record.companyName}
          lastInteractionDate={contactActivities[0]?.ActivityDate}
          healthStatus={relationshipSummary.healthStatus}
          employmentBusy={employmentBusy}
          onEmploymentStatusChange={(status) => void handleEmploymentStatusChange(status)}
        />
      )}

      <ContactLifecycleActionsBar
        contact={contact}
        role={role}
        editing={contactEditOpen}
        onWizardOpen={setWizardMode}
        onArchiveOpen={() => setArchiveOpen(true)}
        onEditOpen={toggleContactEdit}
      />

      {contact.IsArchived ? (
        <p className="border border-carbon-blue/10 bg-carbon-blue/[0.03] px-3 py-2 text-[11px] text-carbon-blue/55">
          Archived — history preserved, hidden from default lists.
        </p>
      ) : null}

      <ContactMissionControlTabBar
        active={activeView}
        onChange={navigateView}
        activityContext={{
          companyId: record.companyId,
          companyName: record.companyName,
          contactId: contact.ContactID,
          contactName: getContactDisplayName(contact),
        }}
        companies={companies}
        pipelines={pipelines}
        counts={viewCounts}
      />

      {activeView === "overview" ? (
        <>
          <WorkspacePanel title="Relationship Intelligence" id="intelligence">
            <ContactRelationshipIntelligenceSection
              contact={contact}
              companyId={record.companyId}
              companyName={record.companyName}
              companies={companies}
              pipelines={pipelines}
              activities={activities}
              outlookEvidence={outlookEvidence}
              showEmailReconciliation={showEmailReconciliation}
              onReconciliationImported={onReconciliationImported}
            />
          </WorkspacePanel>

          <WorkspacePanel title="Attention" id="attention" count={attentionItems.length}>
            <AttentionQueueTable
              items={attentionItems}
              emptyMessage="No open attention — this relationship is on track."
              onDraftEmail={openEmailAssistant}
            />
          </WorkspacePanel>
        </>
      ) : null}

      {activeView === "work" ? (
        <>
          <WorkspacePanel title="Opportunities" id="opportunities" count={linkedDeals.length}>
            <div className="space-y-4">
              <ContactOpportunityRolesTable
                contact={contact}
                company={company}
                pipelines={pipelines}
                role={role}
                onPipelineUpdated={onPipelineUpdated}
              />
              {linkedDeals.length > 0 ? (
                <OpportunitiesOverviewTable
                  deals={linkedDeals}
                  commercialPackages={commercialPackages}
                />
              ) : null}
            </div>
          </WorkspacePanel>

          <WorkspacePanel title="Projects" id="projects" count={projectRoles.length}>
            <ContactProjectRolesTable
              roles={projectRoles}
              contact={contact}
              company={company}
              companies={companies}
              projects={projects}
              role={role}
              onProjectUpdated={onProjectUpdated}
            />
          </WorkspacePanel>
        </>
      ) : null}

      {activeView === "actions" ? (
        <>
          <WorkspacePanel title="Activities" id="activities" count={contactActivities.length}>
            <SmartActivityWorkspace
              activities={contactActivities}
              companies={companies}
              pipelines={pipelines}
              attentionItems={attentionItems}
              context={{
                companyId: company.CompanyID,
                companyName: company.Title,
                contactId: contact.ContactID,
                contactName: getContactDisplayName(contact),
              }}
            />
          </WorkspacePanel>

          <WorkspacePanel title="Documents" id="documents" count={documentCount}>
            <WorkspaceDocumentsPanel
              context={workspaceDocumentsContextFromContact(
                contact.ContactID,
                getContactDisplayName(contact),
                company,
                linkedPipelineIds.length > 0 ? linkedPipelineIds : company.pipelineIds,
              )}
              pipelines={pipelines}
              companies={companies}
              activities={activities}
              onDocumentCountChange={setDocumentCount}
            />
          </WorkspacePanel>

          <WorkspacePanel title="History" id="history">
            <ContactHistoryPanel
              contact={contact}
              careerEntries={careerTimeline}
              transfers={contact.CompanyTransfers ?? []}
              activities={contactActivities}
              showCareerTimeline={showCareerTimeline}
            />
          </WorkspacePanel>
        </>
      ) : null}

      <ContactLifecycleWizard
        open={wizardMode !== null}
        mode={wizardMode === "merge" ? "merge" : wizardMode === "position" ? "position" : "transfer"}
        contact={contact}
        companyId={record.companyId}
        companies={companies}
        duplicateCandidates={duplicateCandidates}
        onClose={() => setWizardMode(null)}
        onTransferCompleted={(updated, targetCompanyId) => {
          onContactTransferred(updated, targetCompanyId);
          setWizardMode(null);
        }}
        onMergeCompleted={(updated, removedContactId) => {
          onContactMerged(updated, removedContactId);
          setWizardMode(null);
        }}
        onPositionCompleted={() => setWizardMode(null)}
        onContactUpdate={onContactUpdate}
      />

      {archiveOpen ? (
        <ContactArchiveConfirm
          open={archiveOpen}
          contactName={getContactDisplayName(contact)}
          archived={!contact.IsArchived}
          onConfirm={() => void handleArchiveConfirm()}
          onCancel={() => setArchiveOpen(false)}
          loading={archiving}
        />
      ) : null}

      {EmailAssistantModal}
    </WorkspaceStack>
  );
}
