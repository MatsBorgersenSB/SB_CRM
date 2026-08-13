"use client";

import { useState } from "react";
import { createContactRecord } from "@/lib/sync-company";
import type { Company, Contact } from "@/lib/companies-data";
import type { CreateContactInput } from "@/types/contact";
import {
  ContactFormFields,
  emptyContactForm,
  isContactFormValid,
} from "@/components/contacts/contact-form-fields";

type ContactsActionBarProps = {
  companies: Company[];
  onCreated: (companyId: string, contact: Contact) => void;
};

export function ContactsActionBar({
  companies,
  onCreated,
  embedded = false,
  open: controlledOpen,
  onOpenChange,
}: ContactsActionBarProps & {
  embedded?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const createOpen = controlledOpen ?? internalOpen;
  const setCreateOpen = onOpenChange ?? setInternalOpen;
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState(companies[0]?.CompanyID ?? "");
  const [form, setForm] = useState<CreateContactInput>(emptyContactForm());

  const handleCreate = async () => {
    if (!companyId || !isContactFormValid(form)) return;

    setSaving(true);

    try {
      const contact = await createContactRecord(companyId, {
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
        buyingRole: form.buyingRole,
        sentiment: form.sentiment,
        influenceLevel: form.influenceLevel,
        reportsToId: form.reportsToId?.trim() || undefined,
        streetAddress: form.streetAddress?.trim() || undefined,
        postalCode: form.postalCode?.trim() || undefined,
        stateRegion: form.stateRegion?.trim() || undefined,
        country: form.country?.trim() || undefined,
        countryCode: form.countryCode?.trim() || undefined,
        continent: form.continent?.trim() || undefined,
        city: form.city?.trim() || undefined,
        timezone: form.timezone?.trim() || undefined,
        isTimezoneOverridden: Boolean(form.isTimezoneOverridden),
        engagementCadence: form.engagementCadence,
        backgroundNotes: form.backgroundNotes?.trim() || undefined,
        preferredLanguage: form.preferredLanguage?.trim() || undefined,
        EmploymentStatus: form.EmploymentStatus,
        Company: { CompanyID: companyId },
      });
      onCreated(companyId, contact);
      setForm(emptyContactForm());
      setCreateOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={embedded ? "" : "border border-carbon-blue/15 bg-white"}>
      {embedded ? null : (
        <div className="flex items-center justify-between border-b border-carbon-blue/10 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Entity Actions
          </p>
          <button
            type="button"
            onClick={() => setCreateOpen(!createOpen)}
            className="border border-carbon-blue/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue transition-colors hover:border-upcycle-orange/30 hover:bg-upcycle-orange/[0.04] hover:text-upcycle-orange focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-upcycle-orange/40"
          >
            + New Contact
          </button>
        </div>
      )}
      {createOpen ? (
        <div className={`grid gap-2 ${embedded ? "" : "p-3"}`}>
          <ContactFormFields
            form={form}
            onChange={setForm}
            showCompanySelect
            companies={companies}
            companyId={companyId}
            onCompanyChange={setCompanyId}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={saving || !companyId || !isContactFormValid(form)}
              onClick={() => void handleCreate()}
              className="border border-upcycle-orange/30 bg-upcycle-orange/10 px-2 py-1.5 text-xs font-semibold text-upcycle-orange transition-colors hover:bg-upcycle-orange/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-upcycle-orange/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : "Create Contact"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setForm(emptyContactForm());
                setCreateOpen(false);
              }}
              className="border border-carbon-blue/15 bg-white px-2 py-1.5 text-xs font-semibold text-carbon-blue/70 transition-colors hover:border-carbon-blue/25 hover:text-carbon-blue focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-upcycle-orange/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <span className="text-[10px] text-carbon-blue/40">Esc</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
