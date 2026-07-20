"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Phone, Plus } from "lucide-react";
import type { Company } from "@/types/company";
import type { Activity } from "@/types/activity";
import type { Contact, CreateContactInput, EditableContactField } from "@/types/contact";
import { getContactDisplayName } from "@/types/contact";
import { getActivitiesForContact } from "@/lib/activity-utils";
import { formatRelativeTime } from "@/lib/relative-time";
import {
  ContactLink,
  EmailActionMenu,
  PhoneActionMenu,
} from "@/components/relationship/relationship-links";
import {
  ContactFormFields,
  emptyContactForm,
  isContactFormValid,
} from "@/components/contacts/contact-form-fields";

function ContactRelationshipCard({
  contact,
  activities,
  companyId,
}: {
  contact: Contact;
  activities: Activity[];
  companyId: string;
}) {
  const contactActivities = getActivitiesForContact(activities, contact.ContactID);
  const lastActivity = contactActivities[0];
  const displayName = getContactDisplayName(contact);

  return (
    <article className="group flex flex-col border border-carbon-blue/8 bg-white transition-all duration-150 hover:border-upcycle-orange/25 hover:shadow-sm">
      <div className="border-b border-carbon-blue/6 px-4 py-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <ContactLink
              contactId={contact.ContactID}
              companyId={companyId}
              className="text-sm font-semibold text-carbon-blue group-hover:text-upcycle-orange"
            >
              {displayName}
            </ContactLink>
            <p className="mt-0.5 text-xs text-carbon-blue/55">{contact.JobTitle}</p>
          </div>
          <span className="shrink-0 border border-carbon-blue/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/55">
            {contact.RelationshipLevel}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="border border-carbon-blue/12 bg-carbon-blue/[0.03] px-2 py-0.5 text-[9px] font-semibold text-carbon-blue/65">
            {contact.Role}
          </span>
          <span className="border border-carbon-blue/10 px-2 py-0.5 text-[9px] font-medium text-carbon-blue/45">
            {contact.Status}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 py-4">
        <div className="space-y-1.5 text-[11px]">
          {contact.Email ? (
            <p className="flex items-center gap-2 text-carbon-blue/65">
              <Mail className="size-3 shrink-0 text-carbon-blue/35" />
              <EmailActionMenu email={contact.Email} />
            </p>
          ) : null}
          {contact.Phone || contact.Mobile ? (
            <p className="flex items-center gap-2 text-carbon-blue/65">
              <Phone className="size-3 shrink-0 text-carbon-blue/35" />
              <PhoneActionMenu phone={contact.Mobile || contact.Phone} />
            </p>
          ) : null}
        </div>

        <div className="mt-auto border-t border-carbon-blue/6 pt-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/35">
            Last interaction
          </p>
          <p className="mt-1 text-[11px] text-carbon-blue/60">
            {lastActivity
              ? `${lastActivity.ActivityType} · ${formatRelativeTime(lastActivity.ActivityDate)}`
              : "No recorded activity"}
          </p>
        </div>
      </div>
    </article>
  );
}

export function Company360ContactsTab({
  company,
  activities,
  onCreateContact,
}: {
  company: Company;
  activities: Activity[];
  onCreateContact: (input: CreateContactInput) => Promise<void>;
  onContactFieldCommit?: (
    contactId: string,
    field: EditableContactField,
    value: string,
  ) => Promise<void>;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CreateContactInput>(() => ({
    ...emptyContactForm(),
    Company: { CompanyID: company.CompanyID },
  }));

  const handleCreate = async () => {
    if (!isContactFormValid(form)) return;
    setSaving(true);
    try {
      await onCreateContact({
        ...form,
        FirstName: form.FirstName.trim(),
        LastName: form.LastName.trim(),
        JobTitle: form.JobTitle.trim() || form.Role,
        Email: form.Email.trim(),
        Phone: form.Phone.trim(),
        Mobile: form.Mobile.trim(),
        LinkedInURL: form.LinkedInURL.trim(),
        Company: { CompanyID: company.CompanyID },
      });
      setForm({ ...emptyContactForm(), Company: { CompanyID: company.CompanyID } });
      setCreateOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="dashboard-card">
      <header className="flex items-center justify-between border-b border-carbon-blue/8 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-carbon-blue">People</h2>
          <p className="mt-0.5 text-[11px] text-carbon-blue/45">
            Relationship context for every contact at {company.Title}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen((open) => !open)}
          className="inline-flex items-center gap-1 border border-carbon-blue/12 px-3 py-1.5 text-[11px] font-semibold text-carbon-blue/70 transition-colors hover:border-upcycle-orange/30 hover:text-upcycle-orange"
        >
          <Plus className="size-3.5" />
          New contact
        </button>
      </header>

      {createOpen ? (
        <div className="border-b border-carbon-blue/8 bg-carbon-blue/[0.02] px-5 py-4">
          <ContactFormFields form={form} onChange={setForm} />
          <button
            type="button"
            disabled={saving || !isContactFormValid(form)}
            onClick={() => void handleCreate()}
            className="mt-3 border border-upcycle-orange/30 bg-upcycle-orange px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Create contact"}
          </button>
        </div>
      ) : null}

      {company.contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <p className="text-sm font-medium text-carbon-blue/70">No contacts yet</p>
          <p className="mt-1 max-w-sm text-xs text-carbon-blue/45">
            Add the people who shape this relationship.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
          {company.contacts.map((contact) => (
            <ContactRelationshipCard
              key={contact.ContactID}
              contact={contact}
              activities={activities}
              companyId={company.CompanyID}
            />
          ))}
        </div>
      )}

      <footer className="border-t border-carbon-blue/8 px-5 py-3">
        <Link
          href="/contacts"
          className="text-[11px] font-semibold text-upcycle-orange"
        >
          Open full contacts directory →
        </Link>
      </footer>
    </section>
  );
}
