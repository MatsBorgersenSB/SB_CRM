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
import { CompanyTypeMultiSelect } from "@/components/companies/company-type-multi-select";
import type { OsmLookupResult } from "@/lib/geo/nominatim";

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
  const [autofilling, setAutofilling] = useState(false);
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

  const selectedOwner =
    resolveOwnerById(form.accountOwnerId, companies, company.AccountOwner) ??
    (form.accountOwnerId ? authUserToAccountOwner(user) : null);

  const handleSave = async () => {
    if (!form.Title.trim()) {
      setError("Company name is required.");
      return;
    }

    if (!form.accountOwnerId) {
      setError("Account owner is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave(form);
    } catch (saveError) {
      const message =
        saveError instanceof Error && saveError.message.trim()
          ? saveError.message
          : "Unable to save company details.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleAutoFillLocation = async () => {
    setAutofilling(true);
    setError(null);
    try {
      const query = [
        form.streetAddress.trim(),
        form.postalCode.trim() ? `${form.postalCode.trim()} ${form.city.trim()}` : form.city.trim(),
        form.country.trim(),
      ]
        .filter(Boolean)
        .join(", ");

      if (!query.trim()) {
        throw new Error("Enter a street address, city, or country first.");
      }

      const res = await fetch(`/api/geo/lookup?q=${encodeURIComponent(query)}`);
      if (!res.ok) {
        throw new Error(`Geo lookup failed (${res.status})`);
      }

      const osm = (await res.json()) as OsmLookupResult;

      setForm((current) => ({
        ...current,
        streetAddress: osm.streetAddress || current.streetAddress,
        postalCode: osm.postalCode || current.postalCode,
        city: osm.city || current.city,
        stateRegion: osm.stateRegion || current.stateRegion,
        country: osm.country || current.country,
        countryCode: osm.countryCode || current.countryCode,
        continent: osm.continent || current.continent,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to auto-fill location.");
    } finally {
      setAutofilling(false);
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
          label="Account Owner"
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

        <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
          <label className="block sm:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <span className={EDIT_LABEL_CLASS}>Street address</span>
              <button
                type="button"
                disabled={saving || autofilling}
                onClick={() => void handleAutoFillLocation()}
                className="rounded-md border border-carbon-blue/20 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-carbon-blue/70 transition-colors hover:border-upcycle-orange/30 hover:text-upcycle-orange disabled:cursor-not-allowed disabled:opacity-50"
              >
                {autofilling ? "Filling…" : "Auto-Fill Location"}
              </button>
            </div>
            <textarea
              value={form.streetAddress}
              onChange={(event) =>
                setForm((current) => ({ ...current, streetAddress: event.target.value }))
              }
              disabled={saving || autofilling}
              rows={3}
              className={`${EDIT_FIELD_CLASS} resize-none text-[13px]`}
            />
          </label>

          <label className="block">
            <span className={EDIT_LABEL_CLASS}>Postal code</span>
            <input
              type="text"
              value={form.postalCode}
              onChange={(event) => setForm((current) => ({ ...current, postalCode: event.target.value }))}
              disabled={saving || autofilling}
              className={`${EDIT_FIELD_CLASS} text-[13px]`}
            />
          </label>

          <label className="block">
            <span className={EDIT_LABEL_CLASS}>City</span>
            <input
              type="text"
              value={form.city}
              onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
              disabled={saving || autofilling}
              className={`${EDIT_FIELD_CLASS} text-[13px]`}
            />
          </label>

          <label className="block">
            <span className={EDIT_LABEL_CLASS}>State / region</span>
            <input
              type="text"
              value={form.stateRegion}
              onChange={(event) => setForm((current) => ({ ...current, stateRegion: event.target.value }))}
              disabled={saving || autofilling}
              className={`${EDIT_FIELD_CLASS} text-[13px]`}
            />
          </label>

          <label className="block">
            <span className={EDIT_LABEL_CLASS}>Country</span>
            <input
              type="text"
              value={form.country}
              onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))}
              disabled={saving || autofilling}
              className={`${EDIT_FIELD_CLASS} text-[13px]`}
            />
          </label>

          <label className="block">
            <span className={EDIT_LABEL_CLASS}>Continent</span>
            <input
              type="text"
              value={form.continent}
              disabled
              className={`${EDIT_FIELD_CLASS} bg-carbon-blue/[0.03] text-[13px]`}
            />
          </label>
        </div>

        <CompanyTypeMultiSelect
          value={form.CompanyTypes}
          onChange={(types) =>
            setForm((current) => ({
              ...current,
              CompanyTypes: types.length > 0 ? types : current.CompanyTypes,
            }))
          }
          disabled={saving}
          required
          density="comfortable"
        />

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
