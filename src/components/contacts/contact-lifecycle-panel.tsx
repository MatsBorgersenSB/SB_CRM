"use client";

import { useMemo, useState } from "react";
import { ContactDetailPanel } from "@/components/contacts/contact-detail-panel";
import { ContactCareerTimeline } from "@/components/contacts/contact-career-timeline";
import { ContactLifecycleInsights } from "@/components/contacts/contact-lifecycle-insights";
import {
  ContactArchiveConfirm,
  ContactLifecycleWizard,
} from "@/components/contacts/contact-lifecycle-wizard";
import { buildCareerTimeline, findDuplicateContacts } from "@/lib/contact-lifecycle-engine";
import { CONTACT_RELATIONSHIP_INTELLIGENCE } from "@/lib/smart-assist-config";
import { getContactDisplayName, type UpdateContactInput } from "@/types/contact";
import {
  EMPLOYMENT_STATUSES,
  type EmploymentStatus,
} from "@/types/contact-lifecycle";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { GlobalContactRecord } from "@/lib/contact-utils";
import type { EditableContactField as EditableContactFieldName } from "@/types/contact";
import type { PipelineRow } from "@/types/pipeline";
import type { UserRole } from "@/types/auth";
import { canDeleteContact } from "@/lib/permissions";

type LifecycleAction = "transfer" | "merge" | "position" | null;

export function ContactLifecyclePanel({
  record,
  company,
  companies,
  pipelines,
  activities,
  role,
  initialAction,
  onContactFieldCommit,
  onContactUpdate,
  onContactDelete,
  onContactArchive,
  onContactTransferred,
  onContactMerged,
}: {
  record: GlobalContactRecord;
  company: Company;
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  role: UserRole;
  initialAction?: string | null;
  onContactFieldCommit: (
    contactId: string,
    field: EditableContactFieldName,
    value: string,
  ) => Promise<void>;
  onContactUpdate: (contactId: string, patch: UpdateContactInput) => Promise<void>;
  onContactDelete?: (contactId: string) => Promise<void>;
  onContactArchive: (contactId: string, archived: boolean) => Promise<void>;
  onContactTransferred: (contact: GlobalContactRecord["contact"], targetCompanyId: string) => void;
  onContactMerged: (contact: GlobalContactRecord["contact"], removedContactId: string) => void;
}) {
  const { contact } = record;
  const [wizardMode, setWizardMode] = useState<LifecycleAction>(
    initialAction === "transfer" || initialAction === "merge" || initialAction === "position"
      ? initialAction
      : null,
  );
  const [editOpenFromLink] = useState(initialAction === "edit");
  const [archiveOpen, setArchiveOpen] = useState(initialAction === "archive");
  const [archiving, setArchiving] = useState(false);
  const [employmentBusy, setEmploymentBusy] = useState(false);

  const careerTimeline = useMemo(
    () => buildCareerTimeline(contact, company),
    [contact, company],
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
      if (status === "Do Not Contact") {
        patch.RelationshipLevel = contact.RelationshipLevel;
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

  return (
    <div className="flex flex-col gap-3">
      <div className="border border-carbon-blue/10 bg-white">
        <header className="border-b border-carbon-blue/10 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            {CONTACT_RELATIONSHIP_INTELLIGENCE.title}
          </p>
          <p className="mt-0.5 text-[10px] text-carbon-blue/50">
            {CONTACT_RELATIONSHIP_INTELLIGENCE.principle}
          </p>
        </header>

        <div className="flex flex-wrap gap-2 border-b border-carbon-blue/10 px-3 py-2">
          {canManage ? (
            <>
              <button
                type="button"
                onClick={() => setWizardMode("transfer")}
                className="border border-carbon-blue/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/60 hover:border-upcycle-orange/30 hover:text-upcycle-orange"
              >
                Change company
              </button>
              <button
                type="button"
                onClick={() => setWizardMode("position")}
                className="border border-carbon-blue/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/60 hover:border-upcycle-orange/30 hover:text-upcycle-orange"
              >
                Change position
              </button>
              <button
                type="button"
                onClick={() => setWizardMode("merge")}
                className="border border-carbon-blue/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/60 hover:border-upcycle-orange/30 hover:text-upcycle-orange"
              >
                Merge duplicates
              </button>
              <button
                type="button"
                onClick={() => setArchiveOpen(true)}
                className="border border-carbon-blue/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/60 hover:border-upcycle-orange/30 hover:text-upcycle-orange"
              >
                {contact.IsArchived ? "Restore contact" : "Archive contact"}
              </button>
            </>
          ) : null}

          <label className="ml-auto flex items-center gap-2">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              Employment status
            </span>
            <select
              value={contact.EmploymentStatus ?? "Active"}
              disabled={employmentBusy}
              onChange={(event) =>
                void handleEmploymentStatusChange(event.target.value as EmploymentStatus)
              }
              className="border border-carbon-blue/15 bg-white px-2 py-1 text-[11px] text-carbon-blue"
            >
              {EMPLOYMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>

        {contact.IsArchived ? (
          <p className="border-b border-carbon-blue/10 bg-carbon-blue/[0.03] px-3 py-2 text-[11px] text-carbon-blue/55">
            Archived — history preserved, hidden from default lists.
          </p>
        ) : null}
      </div>

      <ContactDetailPanel
        record={record}
        activities={activities}
        canDelete={canManage}
        initialEditOpen={editOpenFromLink}
        onContactFieldCommit={onContactFieldCommit}
        onContactUpdate={onContactUpdate}
        onContactDelete={onContactDelete}
      />

      <section className="border border-carbon-blue/10 bg-white">
        <header className="border-b border-carbon-blue/10 px-3 py-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Contact timeline
          </h3>
          <p className="mt-0.5 text-[10px] text-carbon-blue/45">
            Previous employers, roles, and dates — preserved across company changes.
          </p>
        </header>
        <ContactCareerTimeline
          entries={careerTimeline}
          transfers={contact.CompanyTransfers ?? []}
        />
      </section>

      <ContactLifecycleInsights
        contact={contact}
        companyId={record.companyId}
        companyName={record.companyName}
        companies={companies}
        pipelines={pipelines}
        activities={activities}
      />

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
    </div>
  );
}
