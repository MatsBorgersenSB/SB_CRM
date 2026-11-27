"use client";

import { useEffect, useState, type FormEvent } from "react";
import { DestructiveConfirmPanel } from "@/components/ui/destructive-confirm-panel";
import {
  ContactFormFields,
  contactFormValidationMessage,
} from "@/components/contacts/contact-form-fields";
import type { GlobalContactRecord } from "@/lib/contact-utils";
import type { Company } from "@/types/company";
import type { CreateContactInput, UpdateContactInput } from "@/types/contact";
import { buildContactTitle, DEFAULT_ENGAGEMENT_CADENCE } from "@/types/contact";
import { stripBareDialCode } from "@/lib/m365/phone-normalization";
import { SmartCRMIcon } from "@/components/ui/smartcrm-icon";

type Contact360EditPanelProps = {
  record: GlobalContactRecord;
  companies: Company[];
  canDelete?: boolean;
  onCancel: () => void;
  onContactUpdate: (contactId: string, patch: UpdateContactInput) => Promise<void>;
  onContactDelete?: (contactId: string) => Promise<void>;
  onCompanyChange?: (contactId: string, targetCompanyId: string) => void | Promise<void>;
};

function contactToForm(
  contact: GlobalContactRecord["contact"],
  companyName: string,
): CreateContactInput {
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
    buyingRole: contact.buyingRole,
    sentiment: contact.sentiment,
    influenceLevel: contact.influenceLevel,
    reportsToId: contact.reportsToId ?? "",
    streetAddress: contact.streetAddress ?? "",
    postalCode: contact.postalCode ?? "",
    stateRegion: contact.stateRegion ?? "",
    countryCode: contact.countryCode ?? "",
    continent: contact.continent ?? "",
    city: contact.city ?? "",
    country: contact.country ?? "",
    timezone: contact.timezone ?? "",
    isTimezoneOverridden: contact.isTimezoneOverridden ?? false,
    engagementCadence: contact.engagementCadence ?? DEFAULT_ENGAGEMENT_CADENCE,
    backgroundNotes: contact.backgroundNotes ?? "",
    preferredLanguage: contact.preferredLanguage ?? "",
    EmploymentStatus: contact.EmploymentStatus ?? "Active",
    Company: { Id: 0, Title: companyName },
  };
}

/**
 * Inline contact edit — opens at header level, not History (Phase 1.31).
 */
export function Contact360EditPanel({
  record,
  companies,
  canDelete = false,
  onCancel,
  onContactUpdate,
  onContactDelete,
  onCompanyChange,
}: Contact360EditPanelProps) {
  const [form, setForm] = useState<CreateContactInput>(() =>
    contactToForm(record.contact, record.companyName),
  );
  const [companyId, setCompanyId] = useState(record.companyId);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(contactToForm(record.contact, record.companyName));
    setCompanyId(record.companyId);
    // Reset only when switching people — a new `record` object on parent render
    // must not wipe in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.contact.ContactID, record.companyId]);

  const validationMessage = contactFormValidationMessage(form);

  const handleSave = async () => {
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onContactUpdate(record.contact.ContactID, {
        FirstName: form.FirstName.trim(),
        LastName: form.LastName.trim(),
        Title: buildContactTitle(form.FirstName.trim(), form.LastName.trim()),
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
        countryCode: form.countryCode?.trim() || undefined,
        continent: form.continent?.trim() || undefined,
        city: form.city?.trim() || undefined,
        country: form.country?.trim() || undefined,
        timezone: form.timezone?.trim() || undefined,
        isTimezoneOverridden: Boolean(form.isTimezoneOverridden),
        engagementCadence: form.engagementCadence,
        backgroundNotes: form.backgroundNotes?.trim() || undefined,
        preferredLanguage: form.preferredLanguage?.trim() || undefined,
        EmploymentStatus: form.EmploymentStatus,
        IsSuspicious: form.EmploymentStatus === "Suspicious",
      });

      if (companyId !== record.companyId) {
        if (!onCompanyChange) {
          throw new Error("Unable to change company for this contact.");
        }
        await onCompanyChange(record.contact.ContactID, companyId);
      }

      onCancel();
    } catch (saveError) {
      const message =
        saveError instanceof Error && saveError.message.trim()
          ? saveError.message
          : "Unable to save contact details.";
      setError(message);
      console.error("[Contact360] Failed to save contact:", saveError);
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
      onCancel();
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleSave();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-5xl border border-upcycle-orange/30 bg-upcycle-orange/[0.03] p-4"
    >
      <header className="mb-3 flex items-center gap-2">
        <SmartCRMIcon name="edit" size="sm" />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-upcycle-orange">
            Editing contact
          </p>
          <p className="text-sm font-semibold text-carbon-blue">
            {form.FirstName || form.LastName
              ? `${form.FirstName} ${form.LastName}`.trim()
              : "Contact details"}
          </p>
        </div>
      </header>

      <div className="space-y-3">
        <ContactFormFields
          form={form}
          onChange={setForm}
          mode="edit"
          showCompanySelect
          requireCompany
          companies={companies.map((company) => ({
            CompanyID: company.CompanyID,
            Title: company.Title,
            City: company.City,
            Domain: company.Domain,
            Phone: company.Phone,
            countryCode: company.countryCode,
            Country: company.Country?.Title ?? "",
            contacts: company.contacts.map((contact) => ({
              ContactID: contact.ContactID,
              Title: contact.Title,
              Email: contact.Email,
            })),
          }))}
          companyId={companyId}
          currentContactId={record.contact.ContactID}
          onCompanyChange={setCompanyId}
          jobTitleLabel="Position"
        />
      </div>

      <div className="sticky bottom-0 mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-carbon-blue/10 bg-white/95 px-3 py-2.5 backdrop-blur-sm">
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving || Boolean(validationMessage) || !companyId}
            className="border border-upcycle-orange bg-upcycle-orange px-4 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="border border-carbon-blue/15 bg-white px-3 py-1.5 text-[12px] font-semibold text-carbon-blue/70 hover:border-carbon-blue/25"
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
        ) : !companyId ? (
          <p className="text-[12px] text-carbon-blue/55" role="status">
            Select a company.
          </p>
        ) : null}
      </div>

      {canDelete && onContactDelete ? (
        <div className="mt-3">
          {deleteConfirmOpen ? (
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
              className="text-[12px] font-semibold text-thermal-red hover:underline"
            >
              Delete contact
            </button>
          )}
        </div>
      ) : null}
    </form>
  );
}
