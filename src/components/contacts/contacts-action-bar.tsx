"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createContactRecord } from "@/lib/sync-company";
import { syncCompanyContact } from "@/lib/sync-company";
import type { Company, Contact } from "@/lib/companies-data";
import type { CreateContactInput } from "@/types/contact";
import type { DedupContactSummary } from "@/lib/validation/deduplication-types";
import {
  ContactFormFields,
  emptyContactForm,
  isContactFormValid,
} from "@/components/contacts/contact-form-fields";
import {
  ContactDuplicateModal,
  type ContactDuplicateChoice,
} from "@/components/contacts/ContactDuplicateModal";
import { AsyncSubmitButton } from "@/components/ui/async-submit-button";
import { useFormSubmitLock } from "@/hooks/use-form-submit-lock";
import { contact360Href } from "@/types/relationship-navigation";

type ContactsActionBarProps = {
  companies: Company[];
  onCreated: (companyId: string, contact: Contact) => void;
};

type DedupeConflictPayload = {
  status?: string;
  error?: string;
  existingContact?: DedupContactSummary;
  existingContacts?: DedupContactSummary[];
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
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const createOpen = controlledOpen ?? internalOpen;
  const setCreateOpen = onOpenChange ?? setInternalOpen;
  const { isSubmitting, runLocked } = useFormSubmitLock();
  const [companyId, setCompanyId] = useState(companies[0]?.CompanyID ?? "");
  const [form, setForm] = useState<CreateContactInput>(emptyContactForm());
  const [error, setError] = useState<string | null>(null);
  const [softMatches, setSoftMatches] = useState<DedupContactSummary[]>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  const buildPayload = (forceCreateDistinct = false) => ({
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
    forceCreateDistinct,
  });

  const finalizeCreated = (createdCompanyId: string, contact: Contact) => {
    onCreated(createdCompanyId, contact);
    setForm(emptyContactForm());
    setCreateOpen(false);
    setError(null);
    setSoftMatches([]);
    setShowDuplicateModal(false);
  };

  const createWithOptions = async (forceCreateDistinct = false) => {
    if (!companyId || !isContactFormValid(form)) return;

    await runLocked(async () => {
      setError(null);
      try {
        const response = await fetch(
          `/api/companies/${encodeURIComponent(companyId)}/contacts`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildPayload(forceCreateDistinct)),
          },
        );
        const payload = (await response.json()) as Contact & DedupeConflictPayload;

        if (response.status === 409) {
          if (payload.status === "EXACT_EMAIL_EXISTS" && payload.existingContact) {
            setError(
              `A contact with this email already exists (${payload.existingContact.fullName}).`,
            );
            setShowDuplicateModal(false);
            return;
          }
          if (
            payload.status === "NAME_SIMILARITY_MATCH" &&
            payload.existingContacts?.length
          ) {
            setSoftMatches(payload.existingContacts);
            setShowDuplicateModal(true);
            return;
          }
          setError(payload.error ?? "Duplicate contact detected.");
          return;
        }

        if (!response.ok) {
          setError(payload.error ?? "Failed to create contact");
          return;
        }

        finalizeCreated(companyId, payload);
      } catch {
        // Fallback to legacy browser service if fetch shape differs
        try {
          const contact = await createContactRecord(companyId, buildPayload(forceCreateDistinct));
          finalizeCreated(companyId, contact);
        } catch (fallbackError) {
          setError(
            fallbackError instanceof Error
              ? fallbackError.message
              : "Failed to create contact",
          );
        }
      }
    });
  };

  const handleDuplicateChoice = async (choice: ContactDuplicateChoice) => {
    if (choice.action === "cancel") {
      setShowDuplicateModal(false);
      return;
    }

    if (choice.action === "create_distinct") {
      setShowDuplicateModal(false);
      await createWithOptions(true);
      return;
    }

    if (choice.action === "use_existing") {
      setShowDuplicateModal(false);
      router.push(
        choice.contact.companyId
          ? contact360Href(choice.contact.contactId, choice.contact.companyId)
          : contact360Href(choice.contact.contactId),
      );
      setCreateOpen(false);
      return;
    }

    if (choice.action === "update_existing") {
      setShowDuplicateModal(false);
      await runLocked(async () => {
        try {
          const updated = await syncCompanyContact(
            choice.contact.companyId ?? companyId,
            choice.contact.contactId,
            {
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
              EmploymentStatus: form.EmploymentStatus,
            },
          );
          finalizeCreated(choice.contact.companyId ?? companyId, updated);
          router.push(
            choice.contact.companyId
              ? contact360Href(choice.contact.contactId, choice.contact.companyId)
              : contact360Href(choice.contact.contactId),
          );
        } catch (updateError) {
          setError(
            updateError instanceof Error
              ? updateError.message
              : "Failed to update existing contact",
          );
        }
      });
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
          {error ? (
            <p className="text-[12px] font-medium text-thermal-red" role="alert">
              {error}
            </p>
          ) : null}
          <AsyncSubmitButton
            isSubmitting={isSubmitting}
            disabled={!companyId || !isContactFormValid(form)}
            onClick={() => void createWithOptions(false)}
            idleLabel="Create Contact"
            submittingLabel="Saving…"
            className="border border-upcycle-orange/30 bg-upcycle-orange/10 px-2 py-1.5 text-xs font-semibold text-upcycle-orange transition-colors hover:bg-upcycle-orange/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-upcycle-orange/40"
          />
        </div>
      ) : null}

      <ContactDuplicateModal
        open={showDuplicateModal}
        matches={softMatches}
        pendingName={`${form.FirstName} ${form.LastName}`.trim()}
        onChoose={(choice) => void handleDuplicateChoice(choice)}
      />
    </section>
  );
}
