"use client";

import { useState } from "react";
import type { Contact, CreateContactInput, EditableContactField as EditableContactFieldName } from "@/types/contact";
import { getContactDisplayName } from "@/types/contact";
import type { Activity } from "@/types/activity";
import { getActivitiesForContact } from "@/lib/activity-utils";
import { InteractionStream } from "@/components/companies/interaction-stream";
import { EditableContactField } from "@/components/ui/editable-contact-field";
import {
  ContactFormFields,
  emptyContactForm,
  isContactFormValid,
} from "@/components/contacts/contact-form-fields";

function ContactCard({
  contact,
  activities,
  expanded,
  onToggle,
  onFieldCommit,
}: {
  contact: Contact;
  activities: Activity[];
  expanded: boolean;
  onToggle: () => void;
  onFieldCommit: (
    contactId: string,
    field: EditableContactFieldName,
    value: string,
  ) => Promise<void>;
}) {
  const contactActivities = getActivitiesForContact(
    activities,
    contact.ContactID,
  );
  const displayName = getContactDisplayName(contact);

  return (
    <article className="border border-carbon-blue/10 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className={`w-full px-3 py-2.5 text-left transition-colors ${
          expanded ? "bg-upcycle-orange/[0.04]" : "hover:bg-carbon-blue/[0.02]"
        }`}
      >
        <p className="text-xs font-semibold text-carbon-blue">{displayName}</p>
        <p className="mt-0.5 font-mono text-[10px] text-carbon-blue/65">
          {contact.ContactID}
        </p>
      </button>
      <div className="border-t border-carbon-blue/10 px-3 py-2.5">
        <div className="mb-2 flex flex-wrap gap-1">
          <span className="inline-flex items-center border border-carbon-blue/20 bg-carbon-blue/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/70">
            {contact.Role}
          </span>
          <span className="inline-flex items-center border border-carbon-blue/15 px-2 py-0.5 text-[10px] font-semibold text-carbon-blue/55">
            {contact.Status}
          </span>
        </div>
        {contact.JobTitle ? (
          <p className="mb-2 text-[11px] text-carbon-blue/60">{contact.JobTitle}</p>
        ) : null}
        <div
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <EditableContactField
            value={contact.Email}
            field="Email"
            onCommit={(value) => onFieldCommit(contact.ContactID, "Email", value)}
          />
          <div className="mt-0.5">
            <EditableContactField
              value={contact.Phone}
              field="Phone"
              onCommit={(value) => onFieldCommit(contact.ContactID, "Phone", value)}
            />
          </div>
          <div className="mt-0.5">
            <EditableContactField
              value={contact.Mobile}
              field="Mobile"
              onCommit={(value) => onFieldCommit(contact.ContactID, "Mobile", value)}
            />
          </div>
        </div>
      </div>
      {expanded ? <InteractionStream interactions={contactActivities} /> : null}
    </article>
  );
}

export function CompanyContactsSection({
  contacts,
  activities,
  onFieldCommit,
  onCreateContact,
}: {
  contacts: Contact[];
  activities: Activity[];
  onFieldCommit: (
    contactId: string,
    field: EditableContactFieldName,
    value: string,
  ) => Promise<void>;
  onCreateContact: (input: CreateContactInput) => Promise<void>;
}) {
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CreateContactInput>(emptyContactForm());

  const handleCreate = async () => {
    if (!isContactFormValid(form)) return;

    setSaving(true);

    try {
      await onCreateContact({
        ...form,
        FirstName: form.FirstName.trim(),
        LastName: form.LastName.trim(),
        JobTitle: form.JobTitle.trim() || form.Role,
        Role: form.Role,
        Email: form.Email.trim(),
        Phone: form.Phone.trim(),
        Mobile: form.Mobile.trim(),
        LinkedInURL: form.LinkedInURL.trim(),
        Status: form.Status,
        RelationshipLevel: form.RelationshipLevel,
        Company: form.Company,
      });
      setForm(emptyContactForm());
      setCreateOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="border border-carbon-blue/10">
      <header className="flex items-center justify-between border-b border-carbon-blue/10 px-3 py-1.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/60">
          Primary Contacts
        </h3>
        <button
          type="button"
          onClick={() => setCreateOpen((open) => !open)}
          className="border border-carbon-blue/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/60 transition-colors hover:border-upcycle-orange/30 hover:text-upcycle-orange"
        >
          + New Contact
        </button>
      </header>
      {createOpen ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreate();
          }}
          className="grid gap-2 border-b border-carbon-blue/10 bg-carbon-blue/[0.015] p-3"
        >
          <ContactFormFields form={form} onChange={setForm} mode="create" />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !isContactFormValid(form)}
              className="border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {saving ? "Saving…" : "Create Contact"}
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="border border-carbon-blue/15 bg-white px-3 py-1.5 text-xs font-semibold text-carbon-blue/65 hover:text-carbon-blue"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      <div className="flex flex-col gap-2 p-2">
        {contacts.map((contact) => (
          <ContactCard
            key={contact.ContactID}
            contact={contact}
            activities={activities}
            expanded={expandedContactId === contact.ContactID}
            onToggle={() =>
              setExpandedContactId((current) =>
                current === contact.ContactID ? null : contact.ContactID,
              )
            }
            onFieldCommit={onFieldCommit}
          />
        ))}
      </div>
    </section>
  );
}
