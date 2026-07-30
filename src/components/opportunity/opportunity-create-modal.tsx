"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { CompanyCombobox } from "@/components/companies/company-combobox";
import { OpportunityOfferingsPicker } from "@/components/opportunity/opportunity-offerings-picker";
import {
  ContactDuplicateModal,
  type ContactDuplicateChoice,
} from "@/components/contacts/ContactDuplicateModal";
import { AsyncSubmitButton } from "@/components/ui/async-submit-button";
import { SmartCRMIcon } from "@/components/ui/smartcrm-icon";
import { useFormSubmitLock } from "@/hooks/use-form-submit-lock";
import { withAuthRoleHeaders } from "@/lib/api-auth";
import { canCreateCompany } from "@/lib/permissions";
import { syncCompanyContact } from "@/lib/sync-company";
import type { DedupContactSummary } from "@/lib/validation/deduplication-types";
import type { Company } from "@/types/company";
import type { ContactListRole } from "@/types/contact";
import { CONTACT_LIST_ROLES } from "@/types/contact";
import type { UserRole } from "@/types/auth";
import type { CompanyRole, PipelineRow } from "@/types/pipeline";
import { COMPANY_ROLES } from "@/types/pipeline";
import { contact360Href } from "@/types/relationship-navigation";

type FormState = {
  companyId: string;
  assetName: string;
  companyRole: CompanyRole;
  salesValue: string;
  expectedCloseDate: string;
  offeringIds: string[];
};

type NewCompanyData = {
  name: string;
  domain: string;
};

type NewContactData = {
  contactName: string;
  contactEmail: string;
  role: ContactListRole | "Decision Maker";
};

const EMPTY_FORM: FormState = {
  companyId: "",
  assetName: "",
  companyRole: "Technology Buyer",
  salesValue: "",
  expectedCloseDate: "",
  offeringIds: [],
};

const EMPTY_NEW_COMPANY: NewCompanyData = { name: "", domain: "" };
const EMPTY_NEW_CONTACT: NewContactData = {
  contactName: "",
  contactEmail: "",
  role: "Decision Maker",
};

function parseOptionalValue(raw: string): number | undefined {
  const trimmed = raw.trim().replace(/[^\d.]/g, "");
  if (!trimmed) return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

type FullCreateResponse = {
  success?: boolean;
  deal?: PipelineRow;
  company?: Company | null;
  error?: string;
  detail?: string;
  status?: string;
  existingContact?: DedupContactSummary;
  existingContacts?: DedupContactSummary[];
  existingCompany?: { name?: string };
  existingOpportunity?: { name?: string };
};

export function OpportunityCreateModal({
  open,
  onClose,
  onCreated,
  onCompanyCreated,
  companies,
  role,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (deal: PipelineRow) => void;
  onCompanyCreated?: (company: Company) => void;
  companies: Company[];
  role: UserRole;
}) {
  const router = useRouter();
  const { isSubmitting, runLocked } = useFormSubmitLock();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [localCompanies, setLocalCompanies] = useState<Company[]>(companies);
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);
  const [newCompanyData, setNewCompanyData] = useState<NewCompanyData>(EMPTY_NEW_COMPANY);
  const [newContactData, setNewContactData] = useState<NewContactData>(EMPTY_NEW_CONTACT);
  const [error, setError] = useState<string | null>(null);
  const [softMatches, setSoftMatches] = useState<DedupContactSummary[]>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const allowCreateCompany = canCreateCompany(role);

  useEffect(() => {
    if (open) {
      setLocalCompanies(companies);
      setForm(EMPTY_FORM);
      setIsCreatingCompany(false);
      setNewCompanyData(EMPTY_NEW_COMPANY);
      setNewContactData(EMPTY_NEW_CONTACT);
      setError(null);
      setSoftMatches([]);
      setShowDuplicateModal(false);
    }
  }, [open, companies]);

  const companyOptions = useMemo(
    () =>
      [...localCompanies]
        .sort((a, b) => a.Title.localeCompare(b.Title))
        .map((company) => ({
          id: company.CompanyID,
          name: company.Title,
          domain: company.Domain?.trim() || undefined,
        })),
    [localCompanies],
  );

  const hasCompanyTarget =
    (isCreatingCompany && newCompanyData.name.trim().length > 0) ||
    (!isCreatingCompany && form.companyId.length > 0);

  const isValid =
    hasCompanyTarget &&
    form.assetName.trim().length > 0 &&
    COMPANY_ROLES.includes(form.companyRole) &&
    form.offeringIds.length > 0;

  if (!open) return null;

  const resetCompanyCreate = () => {
    setIsCreatingCompany(false);
    setNewCompanyData(EMPTY_NEW_COMPANY);
    setNewContactData(EMPTY_NEW_CONTACT);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setForm(EMPTY_FORM);
    resetCompanyCreate();
    setError(null);
    setSoftMatches([]);
    setShowDuplicateModal(false);
    onClose();
  };

  const handleCreateNewCompanyIntent = (typedName: string) => {
    setError(null);
    setIsCreatingCompany(true);
    setForm((current) => ({ ...current, companyId: "" }));
    setNewCompanyData({ name: typedName, domain: "" });
    setNewContactData(EMPTY_NEW_CONTACT);
  };

  const buildPayload = (forceCreateDistinct = false) => {
    const salesValue = parseOptionalValue(form.salesValue);
    return {
      title: form.assetName.trim(),
      assetName: form.assetName.trim(),
      companyRole: form.companyRole,
      offeringIds: form.offeringIds,
      forceCreateDistinct,
      ...(salesValue !== undefined ? { salesValue, value: salesValue } : {}),
      ...(form.expectedCloseDate.trim()
        ? { expectedCloseDate: form.expectedCloseDate.trim() }
        : {}),
      ...(isCreatingCompany
        ? {
            newCompany: {
              name: newCompanyData.name.trim(),
              domain: newCompanyData.domain.trim() || undefined,
            },
            newContact:
              newContactData.contactName.trim() || newContactData.contactEmail.trim()
                ? {
                    contactName: newContactData.contactName.trim() || undefined,
                    contactEmail: newContactData.contactEmail.trim() || undefined,
                    role: newContactData.role,
                  }
                : null,
          }
        : { companyId: form.companyId }),
    };
  };

  const createWithOptions = async (forceCreateDistinct = false) => {
    if (!isValid) return;

    await runLocked(async () => {
      setError(null);
      try {
        const response = await fetch("/api/opportunities/full", {
          method: "POST",
          headers: withAuthRoleHeaders(role, { "Content-Type": "application/json" }),
          body: JSON.stringify(buildPayload(forceCreateDistinct)),
        });
        const body = (await response.json().catch(() => ({}))) as FullCreateResponse;

        if (response.status === 409) {
          if (body.status === "EXACT_EMAIL_EXISTS" && body.existingContact) {
            setError(
              `A contact with this email already exists (${body.existingContact.fullName}).`,
            );
            return;
          }
          if (
            body.status === "NAME_SIMILARITY_MATCH" &&
            body.existingContacts?.length
          ) {
            setSoftMatches(body.existingContacts);
            setShowDuplicateModal(true);
            return;
          }
          setError(body.detail || body.error || "Duplicate record detected.");
          return;
        }

        if (!response.ok || !body.deal) {
          throw new Error(
            body.detail || body.error || `Create failed (${response.status})`,
          );
        }

        if (body.company) {
          setLocalCompanies((current) =>
            current.some((row) => row.CompanyID === body.company!.CompanyID)
              ? current
              : [...current, body.company!],
          );
          onCompanyCreated?.(body.company);
        }

        setForm(EMPTY_FORM);
        resetCompanyCreate();
        setSoftMatches([]);
        setShowDuplicateModal(false);
        onCreated(body.deal);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create opportunity");
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
      setError(
        "Using the existing contact — create the opportunity against that company, or open the contact to continue.",
      );
      router.push(
        choice.contact.companyId
          ? contact360Href(choice.contact.contactId, choice.contact.companyId)
          : contact360Href(choice.contact.contactId),
      );
      return;
    }

    if (choice.action === "update_existing") {
      setShowDuplicateModal(false);
      await runLocked(async () => {
        try {
          const nameParts = newContactData.contactName.trim().split(/\s+/).filter(Boolean);
          await syncCompanyContact(
            choice.contact.companyId ?? form.companyId,
            choice.contact.contactId,
            {
              FirstName: nameParts[0] || choice.contact.firstName,
              LastName: nameParts.slice(1).join(" ") || choice.contact.lastName,
              Email: newContactData.contactEmail.trim() || choice.contact.email,
            },
          );
          setError(
            "Existing contact updated. Choose that company and create the opportunity without inventing a new person.",
          );
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-carbon-blue/30 p-4 backdrop-blur-[2px]"
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="opportunity-create-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-carbon-blue/10 bg-white shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-carbon-blue/8 px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              Create
            </p>
            <h2
              id="opportunity-create-title"
              className="mt-0.5 text-sm font-semibold text-carbon-blue"
            >
              New Opportunity
            </h2>
            <p className="mt-0.5 text-[11px] text-carbon-blue/50">
              What the customer wants — then decide what happens next.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="rounded p-1 text-carbon-blue/40 transition-colors hover:bg-carbon-blue/5 hover:text-carbon-blue"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid gap-3 p-4">
          <CompanyCombobox
            companies={companyOptions}
            selectedCompanyId={isCreatingCompany ? null : form.companyId || null}
            draftName={isCreatingCompany ? newCompanyData.name : null}
            onSelectCompany={(company) => {
              resetCompanyCreate();
              setForm((current) => ({
                ...current,
                companyId: company?.id ?? "",
              }));
            }}
            onCreateNewCompany={handleCreateNewCompanyIntent}
            allowCreate={allowCreateCompany}
            disabled={isSubmitting}
          />

          {isCreatingCompany ? (
            <div className="space-y-3 border border-carbon-blue/10 bg-carbon-blue/[0.02] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-upcycle-orange">
                  New Company Details
                </p>
                <button
                  type="button"
                  onClick={resetCompanyCreate}
                  disabled={isSubmitting}
                  className="text-[10px] font-semibold text-carbon-blue/45 hover:text-carbon-blue"
                >
                  Cancel new company
                </button>
              </div>

              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                  Company Name
                </span>
                <input
                  type="text"
                  value={newCompanyData.name}
                  onChange={(event) =>
                    setNewCompanyData((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                  Domain (optional)
                </span>
                <input
                  type="text"
                  placeholder="company.com"
                  value={newCompanyData.domain}
                  onChange={(event) =>
                    setNewCompanyData((current) => ({
                      ...current,
                      domain: event.target.value,
                    }))
                  }
                  className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
                />
              </label>

              <p className="pt-1 text-[10px] font-semibold uppercase tracking-wider text-upcycle-orange">
                Primary Contact (optional)
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  placeholder="Contact name"
                  value={newContactData.contactName}
                  onChange={(event) =>
                    setNewContactData((current) => ({
                      ...current,
                      contactName: event.target.value,
                    }))
                  }
                  className="border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
                />
                <input
                  type="email"
                  placeholder="Contact email"
                  value={newContactData.contactEmail}
                  onChange={(event) =>
                    setNewContactData((current) => ({
                      ...current,
                      contactEmail: event.target.value,
                    }))
                  }
                  className="border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
                />
              </div>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                  Contact role
                </span>
                <select
                  value={newContactData.role}
                  onChange={(event) =>
                    setNewContactData((current) => ({
                      ...current,
                      role: event.target.value as NewContactData["role"],
                    }))
                  }
                  className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
                >
                  <option value="Decision Maker">Decision Maker</option>
                  {CONTACT_LIST_ROLES.map((listRole) => (
                    <option key={listRole} value={listRole}>
                      {listRole}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
              Opportunity Name
            </span>
            <input
              type="text"
              value={form.assetName}
              onChange={(event) =>
                setForm((current) => ({ ...current, assetName: event.target.value }))
              }
              placeholder="e.g. Ottem pyrolysis unit"
              className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
              Company Role
            </span>
            <select
              value={form.companyRole}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  companyRole: event.target.value as CompanyRole,
                }))
              }
              className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
            >
              {COMPANY_ROLES.map((roleOption) => (
                <option key={roleOption} value={roleOption}>
                  {roleOption}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
              Offerings in scope
            </span>
            <div className="mt-1">
              <OpportunityOfferingsPicker
                selectedIds={form.offeringIds}
                onChange={(offeringIds) =>
                  setForm((current) => ({ ...current, offeringIds }))
                }
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                Value (optional)
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={form.salesValue}
                onChange={(event) =>
                  setForm((current) => ({ ...current, salesValue: event.target.value }))
                }
                placeholder="e.g. 850000"
                className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                Expected close (optional)
              </span>
              <input
                type="date"
                value={form.expectedCloseDate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    expectedCloseDate: event.target.value,
                  }))
                }
                className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
              />
            </label>
          </div>

          {error ? (
            <p className="text-[11px] text-thermal-red" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-carbon-blue/8 px-4 py-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-3 py-1.5 text-[11px] font-semibold text-carbon-blue/55 transition-colors hover:text-carbon-blue"
          >
            Cancel
          </button>
          <AsyncSubmitButton
            isSubmitting={isSubmitting}
            disabled={!isValid}
            onClick={() => void createWithOptions(false)}
            idleLabel={
              <>
                <SmartCRMIcon name="add" size="xs" />
                Create Opportunity
              </>
            }
            submittingLabel="Creating…"
            className="border border-upcycle-orange/30 bg-upcycle-orange/10 px-3 py-1.5 text-[11px] font-semibold text-upcycle-orange transition-colors hover:bg-upcycle-orange/15"
          />
        </div>
      </div>

      <ContactDuplicateModal
        open={showDuplicateModal}
        matches={softMatches}
        pendingName={newContactData.contactName.trim() || "this contact"}
        onChoose={(choice) => void handleDuplicateChoice(choice)}
      />
    </div>
  );
}
