"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import {
  buildCompanyHeroQuickEdit,
  type CompanyHeroQuickEdit,
} from "@/lib/company-identity";
import { authUserToAccountOwner, resolveOwnerById } from "@/lib/company-owner";
import { CompanyOwnerSelect } from "@/components/companies/company-owner-select";
import { useAuth } from "@/context/auth-context";
import type { Company } from "@/types/company";
import { COMPANY_INDUSTRIES } from "@/types/company";
import type { CompanyType } from "@/types/company-type";
import { COMPANY_TYPE_QUICK_FILTERS } from "@/types/company-type";

const EDIT_FIELD_CLASS =
  "mt-1 w-full rounded-md border-2 border-upcycle-orange/25 bg-white px-3 py-2 text-carbon-blue outline-none transition-colors focus:border-upcycle-orange focus:ring-2 focus:ring-upcycle-orange/20";

const EDIT_LABEL_CLASS =
  "text-[10px] font-bold uppercase tracking-[0.14em] text-upcycle-orange/80";

export function CompanyInlineEditPanel({
  company,
  companies,
  onSave,
  onCancel,
  autoFocus = true,
}: {
  company: Company;
  companies: Company[];
  onSave: (edit: CompanyHeroQuickEdit) => Promise<void>;
  onCancel: () => void;
  autoFocus?: boolean;
}) {
  const { user } = useAuth();
  const panelRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<CompanyHeroQuickEdit>(() =>
    buildCompanyHeroQuickEdit(company),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = buildCompanyHeroQuickEdit(company);
    if (!next.accountOwnerId) {
      next.accountOwnerId = authUserToAccountOwner(user).Id;
    }
    setForm(next);
  }, [company, user]);

  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (autoFocus) {
      nameInputRef.current?.focus();
    }
  }, [autoFocus]);

  const parentOptions = companies.filter((record) => record.CompanyID !== company.CompanyID);

  const toggleCompanyType = (type: CompanyType) => {
    setForm((current) => {
      const selected = current.CompanyTypes.includes(type)
        ? current.CompanyTypes.filter((value) => value !== type)
        : [...current.CompanyTypes, type];
      return {
        ...current,
        CompanyTypes: selected.length > 0 ? selected : [type],
      };
    });
  };

  const selectedOwner =
    resolveOwnerById(form.accountOwnerId, companies, company.AccountOwner) ??
    (form.accountOwnerId ? authUserToAccountOwner(user) : null);

  const handleSave = async () => {
    if (!form.Title.trim()) {
      setError("Company name is required.");
      return;
    }

    if (!form.accountOwnerId) {
      setError("Company owner is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave(form);
    } catch {
      setError("Unable to save company details.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={panelRef}
      role="form"
      aria-label="Edit company"
      className="rounded-lg border-2 border-upcycle-orange/45 bg-upcycle-orange/[0.05] shadow-sm ring-4 ring-upcycle-orange/10"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-upcycle-orange/25 bg-upcycle-orange/10 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-upcycle-orange/15">
            <Pencil className="size-4 text-upcycle-orange" strokeWidth={2} />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-upcycle-orange">
              Editing company
            </p>
            <p className="text-[13px] font-medium text-carbon-blue/70">
              Changes are not saved until you confirm
            </p>
          </div>
        </div>
        <EditActions
          saving={saving}
          canSave={Boolean(form.Title.trim() && form.accountOwnerId)}
          onSave={handleSave}
          onCancel={onCancel}
        />
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <label className="block">
          <span className={EDIT_LABEL_CLASS}>Company name</span>
          <input
            ref={nameInputRef}
            type="text"
            value={form.Title}
            onChange={(event) => setForm((current) => ({ ...current, Title: event.target.value }))}
            disabled={saving}
            className={`${EDIT_FIELD_CLASS} text-lg font-semibold`}
          />
        </label>

        <CompanyOwnerSelect
          companies={companies}
          value={selectedOwner}
          onChange={(owner) =>
            setForm((current) => ({ ...current, accountOwnerId: owner.Id }))
          }
          disabled={saving}
          required
          label="Company Owner"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={EDIT_LABEL_CLASS}>Website</span>
            <input
              type="text"
              value={form.Domain}
              onChange={(event) => setForm((current) => ({ ...current, Domain: event.target.value }))}
              disabled={saving}
              placeholder="example.com"
              className={`${EDIT_FIELD_CLASS} text-[13px]`}
            />
          </label>

          <label className="block">
            <span className={EDIT_LABEL_CLASS}>Phone</span>
            <input
              type="text"
              value={form.Phone}
              onChange={(event) => setForm((current) => ({ ...current, Phone: event.target.value }))}
              disabled={saving}
              className={`${EDIT_FIELD_CLASS} text-[13px]`}
            />
          </label>

          <label className="block">
            <span className={EDIT_LABEL_CLASS}>Email</span>
            <input
              type="email"
              value={form.Email}
              onChange={(event) => setForm((current) => ({ ...current, Email: event.target.value }))}
              disabled={saving}
              className={`${EDIT_FIELD_CLASS} text-[13px]`}
            />
          </label>

          <label className="block">
            <span className={EDIT_LABEL_CLASS}>Industry</span>
            <select
              value={form.Industry}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  Industry: event.target.value as CompanyHeroQuickEdit["Industry"],
                }))
              }
              disabled={saving}
              className={`${EDIT_FIELD_CLASS} text-[13px]`}
            >
              {COMPANY_INDUSTRIES.map((industry) => (
                <option key={industry} value={industry}>
                  {industry}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className={EDIT_LABEL_CLASS}>Address</span>
          <textarea
            value={form.address}
            onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
            disabled={saving}
            rows={3}
            className={`${EDIT_FIELD_CLASS} resize-none text-[13px]`}
          />
        </label>

        <div>
          <span className={EDIT_LABEL_CLASS}>Company type</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {COMPANY_TYPE_QUICK_FILTERS.map((type) => {
              const selected = form.CompanyTypes.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  disabled={saving}
                  onClick={() => toggleCompanyType(type)}
                  className={`border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    selected
                      ? "border-upcycle-orange bg-upcycle-orange/15 text-upcycle-orange"
                      : "border-carbon-blue/15 bg-white text-carbon-blue/55 hover:border-upcycle-orange/30"
                  }`}
                >
                  {type}
                </button>
              );
            })}
          </div>
        </div>

        <label className="block">
          <span className={EDIT_LABEL_CLASS}>Tags</span>
          <input
            type="text"
            value={form.tagsInput}
            onChange={(event) => setForm((current) => ({ ...current, tagsInput: event.target.value }))}
            disabled={saving}
            placeholder="biochar, nordics, priority"
            className={`${EDIT_FIELD_CLASS} text-[13px]`}
          />
          <p className="mt-1 text-[10px] text-carbon-blue/45">Separate tags with commas</p>
        </label>

        <label className="block">
          <span className={EDIT_LABEL_CLASS}>Notes</span>
          <textarea
            value={form.Notes}
            onChange={(event) => setForm((current) => ({ ...current, Notes: event.target.value }))}
            disabled={saving}
            rows={3}
            placeholder="Internal notes about this account…"
            className={`${EDIT_FIELD_CLASS} resize-none text-[13px]`}
          />
        </label>

        <label className="block">
          <span className={EDIT_LABEL_CLASS}>Parent company</span>
          <select
            value={form.parentCompanyId}
            onChange={(event) =>
              setForm((current) => ({ ...current, parentCompanyId: event.target.value }))
            }
            disabled={saving}
            className={`${EDIT_FIELD_CLASS} text-[13px]`}
          >
            <option value="">None</option>
            {parentOptions.map((record) => (
              <option key={record.CompanyID} value={String(record.id)}>
                {record.Title}
              </option>
            ))}
          </select>
        </label>

        {error ? <p className="text-[12px] font-medium text-red-700">{error}</p> : null}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-upcycle-orange/20 bg-white/60 px-4 py-3 sm:px-5">
        <EditActions
          saving={saving}
          canSave={Boolean(form.Title.trim() && form.accountOwnerId)}
          onSave={handleSave}
          onCancel={onCancel}
        />
      </div>
    </div>
  );
}

function EditActions({
  saving,
  canSave,
  onSave,
  onCancel,
}: {
  saving: boolean;
  canSave: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => void onSave()}
        disabled={saving || !canSave}
        className="rounded-md border border-upcycle-orange bg-upcycle-orange px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="rounded-md border border-carbon-blue/20 bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-carbon-blue/60 transition-colors hover:border-carbon-blue/35 hover:text-carbon-blue"
      >
        Cancel
      </button>
    </>
  );
}
