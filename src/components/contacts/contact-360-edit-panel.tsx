"use client";

import { useEffect, useState } from "react";
import { DestructiveConfirmPanel } from "@/components/ui/destructive-confirm-panel";
import {
  ContactFormFields,
  contactFormValidationMessage,
  isContactFormValid,
} from "@/components/contacts/contact-form-fields";
import type { GlobalContactRecord } from "@/lib/contact-utils";
import type { Company } from "@/types/company";
import type { CreateContactInput, UpdateContactInput } from "@/types/contact";
import { buildContactTitle } from "@/types/contact";
import { SmartCRMIcon } from "@/components/ui/smartcrm-icon";

type Contact360EditPanelProps = {
  record: GlobalContactRecord;
  companies: Company[];
  canDelete?: boolean;
  onCancel: () => void;
  onContactUpdate: (contactId: string, patch: UpdateContactInput) => Promise<void>;
  onContactDelete?: (contactId: string) => Promise<void>;
  onCompanyChange?: (contactId: string, targetCompanyId: string) => void;
};

function contactToForm(
  contact: GlobalContactRecord["contact"],
  companyName: string,
): CreateContactInput {
  return {
    FirstName: contact.FirstName ?? "",
    LastName: contact.LastName ?? "",
    JobTitle: contact.JobTitle ?? "",
    Role: contact.Role ?? "Plant Manager",
    Email: contact.Email ?? "",
    Phone: contact.Phone ?? "",
    Mobile: contact.Mobile ?? "",
    LinkedInURL: contact.LinkedInURL ?? "",
    Status: contact.Status ?? "Active",
    RelationshipLevel: contact.RelationshipLevel ?? "Operational",
    buyingRole: contact.buyingRole ?? "Champion",
    sentiment: contact.sentiment ?? "Neutral",
    influenceLevel: contact.influenceLevel ?? "Medium",
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
    engagementCadence: contact.engagementCadence ?? "Monthly",
    backgroundNotes: contact.backgroundNotes ?? "",
    preferredLanguage: contact.preferredLanguage ?? "English",
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
    setForm(contactToForm(record.contact, record.companyName));
    setCompanyId(record.companyId);
  }, [record]);

  const handleSave = async () => {
    const validationMessage = contactFormValidationMessage(form);
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
        ...(companyId !== record.companyId
          ? { Company: { CompanyID: companyId } }
          : {}),
      });

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

  return (
    <div className="border border-upcycle-orange/30 bg-upcycle-orange/[0.04] p-4">
      <header className="mb-4 flex items-center gap-2">
        <SmartCRMIcon name="edit" size="sm" />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-upcycle-orange">
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
          showCompanySelect
          companies={companies.map((company) => ({
            CompanyID: company.CompanyID,
            Title: company.Title,
            City: company.City,
            Country: company.Country?.Title ?? "",
            contacts: company.contacts.map((contact) => ({
              ContactID: contact.ContactID,
              Title: contact.Title,
            })),
          }))}
          companyId={companyId}
          currentContactId={record.contact.ContactID}
          onCompanyChange={setCompanyId}
          jobTitleLabel="Position"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-carbon-blue/10 pt-4">
        <button
          type="button"
          disabled={saving || !isContactFormValid(form)}
          onClick={() => void handleSave()}
          className="border border-upcycle-orange bg-upcycle-orange px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onCancel}
          className="border border-carbon-blue/15 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/70 hover:border-carbon-blue/25"
        >
          Cancel
        </button>
      </div>

      {!isContactFormValid(form) ? (
        <p className="mt-2 text-[12px] font-medium text-carbon-blue/55" role="status">
          {contactFormValidationMessage(form)}
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 text-[12px] font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}

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
              className="text-[11px] font-semibold text-thermal-red hover:underline"
            >
              Delete contact
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
