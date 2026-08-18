"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  buildCareerTimeline,
  findDuplicateContacts,
  isTimelineMeaningful,
} from "@/lib/contact-lifecycle-engine";
import { buildCompanyRelationshipSummary } from "@/lib/relationship-intelligence";
import { buildContact360Verdict } from "@/lib/contact-360-verdict";
import { AttentionQueueTable } from "@/components/attention/attention-queue-table";
import { Contact360EditPanel } from "@/components/contacts/contact-360-edit-panel";
import { Contact360Header } from "@/components/contacts/contact-360-header";
import { ContactHistoryPanel } from "@/components/contacts/contact-history-panel";
import { ContactLifecycleActionsBar } from "@/components/contacts/contact-lifecycle-actions-bar";
import { ContactLifecycleInsights } from "@/components/contacts/contact-lifecycle-insights";
import { ContactRecentOutlook } from "@/components/contacts/contact-recent-outlook";
import type { ContactMailWorkLink } from "@/components/contacts/contact-recent-outlook";
import {
  ContactArchiveConfirm,
  ContactLifecycleWizard,
} from "@/components/contacts/contact-lifecycle-wizard";
import { OpportunitiesOverviewTable } from "@/components/opportunity/opportunities-overview-table";
import { ContactOpportunityRolesTable } from "@/components/opportunity/contact-opportunity-roles-table";
import { WorkspaceDocumentsPanel } from "@/components/documents/workspace-documents-panel";
import { EntityNewActivityButton } from "@/components/activities/entity-new-activity-button";
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
import { getContactProjectRoles } from "@/lib/project-team-utils";
import { ContactProjectRolesTable } from "@/components/project/contact-project-roles-table";
import { WorkspaceStack } from "@/components/ui/workspace-main";
import { WorkspacePanel } from "@/components/ui/smartcrm-icon";
import { deal360Href, project360Href } from "@/types/relationship-navigation";

type LifecycleWizardMode = "transfer" | "merge" | "position" | null;

/**
 * Contact 360 — one living page: who, last touch, mail, work, next action.
 */
export function Contact360LivingWorkspace({
  record,
  company,
  pipelines,
  companies,
  activities,
  commercialPackages,
  attentionItems,
  outlookEvidence: _outlookEvidence,
  role,
  lifecycleAction,
  reconcileAction: _reconcileAction,
  onContactFieldCommit: _onContactFieldCommit,
  onContactUpdate,
  onContactDelete,
  onContactArchive,
  onContactTransferred,
  onContactMerged,
  onReconciliationImported: _onReconciliationImported,
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
  const [documentCount, setDocumentCount] = useState(0);
  const [lastMailAt, setLastMailAt] = useState<string | null>(null);
  const [mailOpportunities, setMailOpportunities] = useState<ContactMailWorkLink[]>([]);
  const [mailProjects, setMailProjects] = useState<ContactMailWorkLink[]>([]);
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

  const rosterProjectIds = useMemo(
    () => new Set(projectRoles.map((row) => row.projectId)),
    [projectRoles],
  );
  const rosterDealIds = useMemo(
    () => new Set(linkedDeals.map((deal) => deal.id)),
    [linkedDeals],
  );

  const mailProjectsNotOnRoster = mailProjects.filter((row) => !rosterProjectIds.has(row.id));
  const mailDealsNotOnRoster = mailOpportunities.filter((row) => !rosterDealIds.has(row.id));

  const verdict = useMemo(
    () =>
      buildContact360Verdict({
        firstName: contact.FirstName || getContactDisplayName(contact).split(" ")[0] || "",
        buyingRole: contact.buyingRole,
        engagementCadence: contact.engagementCadence,
        lastActivityAt: contactActivities[0]?.ActivityDate ?? null,
        lastMailAt,
        onOpportunity: linkedDeals.length > 0,
        onProject: projectRoles.length > 0,
        mailProjectNotOnRoster: mailProjectsNotOnRoster[0]?.name ?? null,
        mailOpportunityNotOnRoster: mailDealsNotOnRoster[0]?.name ?? null,
      }),
    [
      contact,
      contactActivities,
      lastMailAt,
      linkedDeals.length,
      projectRoles.length,
      mailProjectsNotOnRoster,
      mailDealsNotOnRoster,
    ],
  );

  const canManage = canDeleteContact(role);

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

  const contactTools = (
    <ContactLifecycleActionsBar
      contact={contact}
      role={role}
      editing={contactEditOpen}
      onWizardOpen={setWizardMode}
      onArchiveOpen={() => setArchiveOpen(true)}
      onEditOpen={toggleContactEdit}
    />
  );

  const displayName = getContactDisplayName(contact);

  return (
    <WorkspaceStack>
      {contactEditOpen ? (
        <div>
          <div className="mb-3 flex justify-end">{contactTools}</div>
          <Contact360EditPanel
            record={record}
            companies={companies}
            canDelete={canManage}
            onCancel={() => setContactEditOpen(false)}
            onContactUpdate={onContactUpdate}
            onContactDelete={onContactDelete}
            onCompanyChange={handleCompanyChange}
          />
        </div>
      ) : (
        <Contact360Header
          contact={contact}
          companyId={record.companyId}
          companyName={record.companyName}
          lastInteractionDate={verdict.lastInteractionAt ?? undefined}
          healthStatus={relationshipSummary.healthStatus}
          employmentBusy={employmentBusy}
          onEmploymentStatusChange={(status) => void handleEmploymentStatusChange(status)}
          trailing={contactTools}
          verdict={verdict}
        />
      )}

      {contact.IsArchived ? (
        <p className="border border-carbon-blue/10 bg-carbon-blue/[0.03] px-3 py-2 text-[11px] text-carbon-blue/55">
          Archived — history preserved, hidden from default lists.
        </p>
      ) : null}

      <div className="flex justify-end">
        <EntityNewActivityButton
          context={{
            companyId: record.companyId,
            companyName: record.companyName,
            contactId: contact.ContactID,
            contactName: displayName,
          }}
          companies={companies}
          pipelines={pipelines}
          showNewTask={false}
        />
      </div>

      <WorkspacePanel title="Recent Outlook" id="outlook" icon="email">
        <ContactLifecycleInsights
          contact={contact}
          companyId={record.companyId}
          companyName={record.companyName}
          companies={companies}
          pipelines={pipelines}
          activities={activities}
          showBanner={false}
        />
        <ContactRecentOutlook
          contactId={contact.ContactID}
          contactEmail={contact.Email || undefined}
          contactName={displayName}
          contactPhone={contact.Mobile || contact.Phone || undefined}
          role={role}
          onLatestMailAt={setLastMailAt}
          onLinkedWork={(links) => {
            setMailOpportunities(links.opportunities);
            setMailProjects(links.projects);
          }}
        />
      </WorkspacePanel>

      {mailProjectsNotOnRoster.length > 0 || mailDealsNotOnRoster.length > 0 ? (
        <p className="border border-upcycle-orange/25 bg-upcycle-orange/[0.06] px-4 py-3 text-[13px] leading-relaxed text-carbon-blue">
          Mail is tagged
          {mailProjectsNotOnRoster.length > 0 ? (
            <>
              {" "}
              to project{" "}
              <Link
                href={project360Href(mailProjectsNotOnRoster[0]!.id)}
                className="font-medium text-upcycle-orange hover:underline"
              >
                {mailProjectsNotOnRoster[0]!.name}
              </Link>
            </>
          ) : null}
          {mailDealsNotOnRoster.length > 0 ? (
            <>
              {mailProjectsNotOnRoster.length > 0 ? " and" : ""} to opportunity{" "}
              <Link
                href={deal360Href(mailDealsNotOnRoster[0]!.id)}
                className="font-medium text-upcycle-orange hover:underline"
              >
                {mailDealsNotOnRoster[0]!.name}
              </Link>
            </>
          ) : null}
          , but {displayName} is not on that roster yet. Add them below if that is the work.
        </p>
      ) : null}

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

      {attentionItems.length > 0 ? (
        <WorkspacePanel title="Attention" id="attention" count={attentionItems.length}>
          <AttentionQueueTable
            items={attentionItems}
            emptyMessage="No open attention — this relationship is on track."
            onDraftEmail={openEmailAssistant}
          />
        </WorkspacePanel>
      ) : null}

      <p className="px-1 text-[12px] text-carbon-blue/50">
        {contactActivities.length === 0
          ? "No CRM activities yet. Outlook mail still counts as last touch."
          : `${contactActivities.length} logged ${contactActivities.length === 1 ? "activity" : "activities"}.`}{" "}
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
        collapseStorageKey={`contact-${contact.ContactID}-documents`}
      >
        <WorkspaceDocumentsPanel
          context={workspaceDocumentsContextFromContact(
            contact.ContactID,
            displayName,
            company,
            linkedPipelineIds.length > 0 ? linkedPipelineIds : company.pipelineIds,
          )}
          pipelines={pipelines}
          companies={companies}
          activities={activities}
          onDocumentCountChange={setDocumentCount}
        />
      </WorkspacePanel>

      {showCareerTimeline ? (
        <WorkspacePanel
          title="History"
          id="history"
          collapsible
          defaultCollapsed
          collapseStorageKey={`contact-${contact.ContactID}-history`}
        >
          <ContactHistoryPanel
            contact={contact}
            careerEntries={careerTimeline}
            transfers={contact.CompanyTransfers ?? []}
            activities={contactActivities}
            showCareerTimeline={showCareerTimeline}
          />
        </WorkspacePanel>
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
          contactName={displayName}
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
