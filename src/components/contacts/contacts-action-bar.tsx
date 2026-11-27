"use client";

import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { createContactRecord } from "@/lib/sync-company";
import { stripBareDialCode } from "@/lib/m365/phone-normalization";
import type { Company, Contact } from "@/lib/companies-data";
import type { CreateContactInput } from "@/types/contact";
import {
  ContactFormFields,
  contactFormValidationMessage,
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
  const [companyId, setCompanyId] = useState("");
  const [form, setForm] = useState<CreateContactInput>(emptyContactForm);
  const [error, setError] = useState<string | null>(null);

  const validationMessage =
    contactFormValidationMessage(form) ?? (!companyId ? "Select a company." : null);
  const canSubmit = Boolean(companyId) && isContactFormValid(form);

  const resetAndClose = () => {
    setForm(emptyContactForm());
    setCompanyId("");
    setError(null);
    setCreateOpen(false);
  };

  const handleCreate = async () => {
    if (!canSubmit) {
      setError(validationMessage);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const contact = await createContactRecord(companyId, {
        FirstName: form.FirstName.trim(),
        LastName: form.LastName.trim(),
        JobTitle: form.JobTitle.trim() || form.Role,
        Role: form.Role,
        Email: form.Email.trim(),
        Phone: stripBareDialCode(form.Phone),
        Mobile: stripBareDialCode(form.Mobile),
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
      resetAndClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error && saveError.message.trim()
          ? saveError.message
          : "Unable to create contact. Nothing was lost — please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleCreate();
  };

  return (
    <section
      className={
        embedded
          ? "mx-auto w-full max-w-5xl border border-carbon-blue/15 bg-carbon-blue/[0.015]"
          : "border border-carbon-blue/15 bg-white"
      }
    >
      {embedded ? (
        <header className="flex items-center justify-between gap-3 border-b border-carbon-blue/10 bg-white px-4 py-3">
          <div>
            <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-carbon-blue">
              New Contact
            </h2>
            <p className="mt-0.5 text-[12px] text-carbon-blue/55">
              Start with name, company, and reach — expand optional details only when needed.
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={resetAndClose}
            aria-label="Close new contact card"
            className="inline-flex items-center gap-1 border border-carbon-blue/12 px-2 py-1 text-[11px] font-semibold text-carbon-blue/60 transition-colors hover:border-carbon-blue/25 hover:text-carbon-blue disabled:opacity-50"
          >
            <X className="size-3.5" aria-hidden />
            Esc
          </button>
        </header>
      ) : (
        <div className="flex items-center justify-between border-b border-carbon-blue/10 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/60">
            Entity Actions
          </p>
          <button
            type="button"
            onClick={() => setCreateOpen(!createOpen)}
            className="border border-carbon-blue/15 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-carbon-blue transition-colors hover:border-upcycle-orange/30 hover:bg-upcycle-orange/[0.04] hover:text-upcycle-orange focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-upcycle-orange/40"
          >
            + New Contact
          </button>
        </div>
      )}
      {createOpen ? (
        <form onSubmit={handleSubmit} className="space-y-3 p-4">
          <ContactFormFields
            form={form}
            onChange={setForm}
            mode="create"
            showCompanySelect
            requireCompany
            companies={companies}
            companyId={companyId}
            onCompanyChange={setCompanyId}
          />
          <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-carbon-blue/10 bg-white/95 px-3 py-2.5 backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={saving || !canSubmit}
                className="border border-upcycle-orange bg-upcycle-orange px-4 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-upcycle-orange/40 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {saving ? "Saving…" : "Create Contact"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={resetAndClose}
                className="border border-carbon-blue/15 bg-white px-3 py-1.5 text-[12px] font-semibold text-carbon-blue/70 transition-colors hover:border-carbon-blue/25 hover:text-carbon-blue focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-upcycle-orange/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
            {error ? (
              <p className="text-[12px] font-medium text-thermal-red" role="alert">
                {error}
              </p>
            ) : validationMessage ? (
              <p className="text-[12px] text-carbon-blue/55" role="status">
                {validationMessage}
              </p>
            ) : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}
