"use client";

import { useEffect, useState } from "react";
import { InteractionStream } from "@/components/companies/interaction-stream";
import { PipelineDealBadge } from "@/components/ui/pipeline-deal-badge";
import { EditableContactField } from "@/components/ui/editable-contact-field";
import { DestructiveConfirmPanel } from "@/components/ui/destructive-confirm-panel";
import {
  ContactFormFields,
  isContactFormValid,
} from "@/components/contacts/contact-form-fields";
import type { GlobalContactRecord } from "@/lib/contact-utils";
import type { Activity } from "@/types/activity";
import { getActivitiesForContact } from "@/lib/activity-utils";
import type { CreateContactInput, EditableContactField as EditableContactFieldName, UpdateContactInput } from "@/types/contact";
import { buildContactTitle, getContactDisplayName } from "@/types/contact";
import { CompanyLink } from "@/components/relationship/relationship-links";
import { EmailActionMenu, PhoneActionMenu } from "@/components/relationship/relationship-links";

type ContactDetailPanelProps = {
  record: GlobalContactRecord;
  activities: Activity[];
  canDelete?: boolean;
  initialEditOpen?: boolean;
  onContactFieldCommit: (
    contactId: string,
    field: EditableContactFieldName,
    value: string,
  ) => Promise<void>;
  onContactUpdate: (contactId: string, patch: UpdateContactInput) => Promise<void>;
  onContactDelete?: (contactId: string) => Promise<void>;
  onPipelineSelect?: (pipelineId: string) => void;
};

function contactToForm(contact: GlobalContactRecord["contact"]): CreateContactInput {
  return {
    FirstName: contact.FirstName,
    LastName: contact.LastName,
    JobTitle: contact.JobTitle,
    Role: contact.Role,
    Email: contact.Email,
    Phone: contact.Phone,
    Mobile: contact.Mobile,
    LinkedInURL: contact.LinkedInURL,
    Status: contact.Status,
    RelationshipLevel: contact.RelationshipLevel,
    EmploymentStatus: contact.EmploymentStatus ?? "Active",
    Company: contact.Company,
  };
}

export function ContactDetailPanel({
  record,
  activities,
  canDelete = false,
  initialEditOpen = false,
  onContactFieldCommit,
  onContactUpdate,
  onContactDelete,
  onPipelineSelect,
}: ContactDetailPanelProps) {
  const [editOpen, setEditOpen] = useState(initialEditOpen);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [form, setForm] = useState<CreateContactInput>(() => contactToForm(record.contact));

  useEffect(() => {
    if (initialEditOpen) setEditOpen(true);
  }, [initialEditOpen]);

  const contactActivities = getActivitiesForContact(
    activities,
    record.contact.ContactID,
  );
  const displayName = getContactDisplayName(record.contact);

  const handleSave = async () => {
    if (!isContactFormValid(form)) return;

    setSaving(true);

    try {
      await onContactUpdate(record.contact.ContactID, {
        FirstName: form.FirstName.trim(),
        LastName: form.LastName.trim(),
        Title: buildContactTitle(form.FirstName.trim(), form.LastName.trim()),
        JobTitle: form.JobTitle.trim() || form.Role,
        Role: form.Role,
        Email: form.Email.trim(),
        Phone: form.Phone.trim(),
        Mobile: form.Mobile.trim(),
        LinkedInURL: form.LinkedInURL.trim(),
        Status: form.Status,
        RelationshipLevel: form.RelationshipLevel,
        EmploymentStatus: form.EmploymentStatus,
      });
      setEditOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onContactDelete) return;

    setDeleting(true);

    try {
      await onContactDelete(record.contact.ContactID);
      setDeleteConfirmOpen(false);
      setEditOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <article className="border border-carbon-blue/10 bg-white">
        <header className="flex items-center justify-between border-b border-carbon-blue/10 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Contact Card
          </p>
          <button
            type="button"
            onClick={() => {
              setForm(contactToForm(record.contact));
              setDeleteConfirmOpen(false);
              setEditOpen((open) => !open);
            }}
            className="border border-carbon-blue/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/60 transition-colors hover:border-upcycle-orange/30 hover:text-upcycle-orange"
          >
            {editOpen ? "Cancel" : "Edit Contact"}
          </button>
        </header>
        {editOpen ? (
          <div className="grid gap-2 border-b border-carbon-blue/10 p-3">
            <ContactFormFields form={form} onChange={setForm} />
            <button
              type="button"
              disabled={saving || !isContactFormValid(form)}
              onClick={() => void handleSave()}
              className="border border-upcycle-orange/30 bg-upcycle-orange/10 px-2 py-1.5 text-xs font-semibold text-upcycle-orange transition-colors hover:bg-upcycle-orange/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Contact"}
            </button>
            {canDelete && onContactDelete ? (
              deleteConfirmOpen ? (
                <DestructiveConfirmPanel
                  title="Delete Contact?"
                  message="This action cannot be undone."
                  confirmLabel="Delete"
                  onConfirm={() => void handleDelete()}
                  onCancel={() => setDeleteConfirmOpen(false)}
                  loading={deleting}
                />
              ) : (
                <button
                  type="button"
                  disabled={saving || deleting}
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="border border-thermal-red/30 px-2 py-1.5 text-xs font-semibold text-thermal-red transition-colors hover:bg-thermal-red/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Delete Contact
                </button>
              )
            ) : null}
          </div>
        ) : null}
        <div className="px-3 py-2.5">
          <p className="text-xs font-semibold text-carbon-blue">{displayName}</p>
          <p className="mt-0.5 text-[10px] text-carbon-blue/55">
            <CompanyLink companyId={record.companyId}>{record.companyName}</CompanyLink>
            <span className="mx-1 text-carbon-blue/25">·</span>
            <span className="font-mono">{record.companyId}</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="inline-flex items-center border border-carbon-blue/20 bg-carbon-blue/[0.04] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/70">
              {record.contact.Role}
            </span>
            <span className="inline-flex items-center border border-carbon-blue/15 px-2 py-0.5 text-[9px] font-semibold text-carbon-blue/55">
              {record.contact.Status}
            </span>
            <span className="inline-flex items-center border border-carbon-blue/15 px-2 py-0.5 text-[9px] font-semibold text-carbon-blue/55">
              {record.contact.EmploymentStatus ?? "Active"}
            </span>
            <span className="inline-flex items-center border border-carbon-blue/15 px-2 py-0.5 text-[9px] font-semibold text-carbon-blue/55">
              {record.contact.RelationshipLevel}
            </span>
          </div>
          {record.contact.JobTitle ? (
            <p className="mt-2 text-[10px] text-carbon-blue/60">
              {record.contact.JobTitle}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-3 text-[11px]">
            {record.contact.Email ? <EmailActionMenu email={record.contact.Email} /> : null}
            {record.contact.Phone ? <PhoneActionMenu phone={record.contact.Phone} /> : null}
            {record.contact.Mobile ? <PhoneActionMenu phone={record.contact.Mobile} /> : null}
          </div>
          <div className="mt-3">
            <EditableContactField
              value={record.contact.Email}
              field="Email"
              onCommit={(value) =>
                onContactFieldCommit(record.contact.ContactID, "Email", value)
              }
            />
            <div className="mt-0.5">
              <EditableContactField
                value={record.contact.Phone}
                field="Phone"
                onCommit={(value) =>
                  onContactFieldCommit(record.contact.ContactID, "Phone", value)
                }
              />
            </div>
            <div className="mt-0.5">
              <EditableContactField
                value={record.contact.Mobile}
                field="Mobile"
                onCommit={(value) =>
                  onContactFieldCommit(record.contact.ContactID, "Mobile", value)
                }
              />
            </div>
            <div className="mt-0.5">
              <EditableContactField
                value={record.contact.LinkedInURL}
                field="LinkedInURL"
                onCommit={(value) =>
                  onContactFieldCommit(record.contact.ContactID, "LinkedInURL", value)
                }
              />
            </div>
            <div className="mt-0.5">
              <EditableContactField
                value={record.contact.JobTitle}
                field="JobTitle"
                onCommit={(value) =>
                  onContactFieldCommit(record.contact.ContactID, "JobTitle", value)
                }
              />
            </div>
          </div>
        </div>
        <InteractionStream interactions={contactActivities} />
      </article>
      <section className="border border-carbon-blue/10">
        <header className="border-b border-carbon-blue/10 px-3 py-1.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Linked Deals
          </h3>
        </header>
        <div className="flex flex-wrap gap-1 p-2">
          {record.linkedPipelineIds.length > 0 ? (
            record.linkedPipelineIds.map((pipelineId) =>
              onPipelineSelect ? (
                <PipelineDealBadge
                  key={`${record.companyId}-${record.contact.ContactID}-${pipelineId}`}
                  pipelineId={pipelineId}
                  onSelect={onPipelineSelect}
                />
              ) : (
                <span
                  key={`${record.companyId}-${record.contact.ContactID}-${pipelineId}`}
                  className="border border-upcycle-orange/30 bg-upcycle-orange/10 px-2 py-0.5 font-mono text-[9px] text-upcycle-orange"
                >
                  {pipelineId}
                </span>
              ),
            )
          ) : (
            <p className="px-1 py-1 text-xs text-carbon-blue/50">
              No linked deals.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
