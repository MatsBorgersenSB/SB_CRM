"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { CompanyCombobox } from "@/components/companies/company-combobox";
import { OpportunityOfferingsPicker } from "@/components/opportunity/opportunity-offerings-picker";
import { OpportunityValueFields } from "@/components/opportunity/opportunity-value-fields";
import { SmartCRMIcon } from "@/components/ui/smartcrm-icon";
import { withAuthRoleHeaders } from "@/lib/api-auth";
import {
  DEFAULT_OPPORTUNITY_CURRENCY,
  parseMoneyInput,
} from "@/lib/geo/currencies";
import { canCreateCompany } from "@/lib/permissions";
import type { Company } from "@/types/company";
import type { ContactListRole } from "@/types/contact";
import { ContactRoleSelect } from "@/components/ui/contact-role-select";
import type { UserRole } from "@/types/auth";
import type { CompanyRole, PipelineCurrency, PipelineRow } from "@/types/pipeline";
import { COMPANY_ROLES } from "@/types/pipeline";

type FormState = {
  companyId: string;
  assetName: string;
  companyRole: CompanyRole;
  salesValue: string;
  currency: PipelineCurrency;
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
  role: ContactListRole;
};

const EMPTY_FORM: FormState = {
  companyId: "",
  assetName: "",
  companyRole: "Technology Buyer",
  salesValue: "",
  currency: DEFAULT_OPPORTUNITY_CURRENCY,
  expectedCloseDate: "",
  offeringIds: [],
};

const EMPTY_NEW_COMPANY: NewCompanyData = { name: "", domain: "" };
const EMPTY_NEW_CONTACT: NewContactData = {
  contactName: "",
  contactEmail: "",
  role: "Decision Maker",
};

type FullCreateResponse = {
  success?: boolean;
  deal?: PipelineRow;
  company?: Company | null;
  error?: string;
  detail?: string;
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
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [localCompanies, setLocalCompanies] = useState<Company[]>(companies);
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);
  const [newCompanyData, setNewCompanyData] = useState<NewCompanyData>(EMPTY_NEW_COMPANY);
  const [newContactData, setNewContactData] = useState<NewContactData>(EMPTY_NEW_CONTACT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allowCreateCompany = canCreateCompany(role);

  useEffect(() => {
    if (open) {
      setLocalCompanies(companies);
      setForm(EMPTY_FORM);
      setIsCreatingCompany(false);
      setNewCompanyData(EMPTY_NEW_COMPANY);
      setNewContactData(EMPTY_NEW_CONTACT);
      setError(null);
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
    if (saving) return;
    setForm(EMPTY_FORM);
    resetCompanyCreate();
    setError(null);
    onClose();
  };

  const handleCreateNewCompanyIntent = (typedName: string) => {
    setError(null);
    setIsCreatingCompany(true);
    setForm((current) => ({ ...current, companyId: "" }));
    setNewCompanyData({ name: typedName, domain: "" });
    setNewContactData(EMPTY_NEW_CONTACT);
  };

  const handleCreate = async () => {
    if (!isValid) return;
    setSaving(true);
    setError(null);
    try {
      const salesValue = parseMoneyInput(form.salesValue);
      const payload = {
        title: form.assetName.trim(),
        assetName: form.assetName.trim(),
        companyRole: form.companyRole,
        offeringIds: form.offeringIds,
        currency: form.currency || DEFAULT_OPPORTUNITY_CURRENCY,
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
                newContactData.contactName.trim() ||
                newContactData.contactEmail.trim()
                  ? {
                      contactName: newContactData.contactName.trim() || undefined,
                      contactEmail: newContactData.contactEmail.trim() || undefined,
                      role: newContactData.role,
                    }
                  : null,
            }
          : { companyId: form.companyId }),
      };

      const response = await fetch("/api/opportunities/full", {
        method: "POST",
        headers: withAuthRoleHeaders(role, { "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => ({}))) as FullCreateResponse;
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
      onCreated(body.deal);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create opportunity");
    } finally {
      setSaving(false);
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
            disabled={saving}
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
            disabled={saving}
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
                  disabled={saving}
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
                <ContactRoleSelect
                  value={newContactData.role}
                  onChange={(role) =>
                    setNewContactData((current) => ({
                      ...current,
                      role,
                    }))
                  }
                  extraOptions={["Decision Maker"]}
                  className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
                />
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
              Offerings in scope <span className="text-thermal-red">*</span>
            </span>
            <div className="mt-1">
              <OpportunityOfferingsPicker
                selectedIds={form.offeringIds}
                onChange={(offeringIds) =>
                  setForm((current) => ({ ...current, offeringIds }))
                }
                required
                defaultOpen
                label="Selected offerings"
                helper="Select at least one Standard Bio offering — required to create."
              />
            </div>
          </div>

          <div className="grid gap-3">
            <OpportunityValueFields
              salesValue={form.salesValue}
              currency={form.currency}
              disabled={saving}
              valueLabel="Value"
              onSalesValueChange={(salesValue) =>
                setForm((current) => ({ ...current, salesValue }))
              }
              onCurrencyChange={(currency) =>
                setForm((current) => ({ ...current, currency }))
              }
            />
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

        <div className="flex flex-col gap-2 border-t border-carbon-blue/8 px-4 py-3 sm:flex-row sm:items-center sm:justify-end">
          {!isValid && !saving ? (
            <p className="text-[11px] text-carbon-blue/55 sm:mr-auto">
              {!hasCompanyTarget
                ? "Select or create a company to continue."
                : form.assetName.trim().length === 0
                  ? "Enter an opportunity name."
                  : form.offeringIds.length === 0
                    ? "Add at least one offering to enable Create."
                    : "Complete the required fields."}
            </p>
          ) : null}
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="px-3 py-1.5 text-[11px] font-semibold text-carbon-blue/55 transition-colors hover:text-carbon-blue"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={!isValid || saving}
            className="inline-flex items-center gap-1.5 border border-upcycle-orange/30 bg-upcycle-orange/10 px-3 py-1.5 text-[11px] font-semibold text-upcycle-orange transition-colors hover:bg-upcycle-orange/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <SmartCRMIcon name="add" size="xs" />
            {saving ? "Creating…" : "Create Opportunity"}
          </button>
        </div>
      </div>
    </div>
  );
}
