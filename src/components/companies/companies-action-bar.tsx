"use client";

import { useEffect, useState } from "react";
import { createCompanyRecord } from "@/lib/sync-company";
import { resolveParentCompanyLookup } from "@/lib/company-identity";
import { authUserToAccountOwner, resolveOwnerById } from "@/lib/company-owner";
import { consumeEventCompanyPrefill } from "@/lib/event-planning-prefill";
import { CompanyOwnerSelect } from "@/components/companies/company-owner-select";
import { useAuth } from "@/context/auth-context";
import type { Company } from "@/lib/companies-data";
import { canCreateCompany } from "@/lib/permissions";
import type { CompanyIndustry, CompanyStatus } from "@/types/company";
import { COMPANY_INDUSTRIES, COMPANY_STATUSES } from "@/types/company";
import type { CompanyType } from "@/types/company-type";
import { CompanyTypeMultiSelect } from "@/components/companies/company-type-multi-select";
import { EuropeanRegistrySearch } from "@/components/companies/european-registry-search";
import type { UnifiedEuropeanCompany } from "@/lib/integrations/company-registers/types";
import type { UserRole } from "@/types/auth";

export function CompaniesActionBar({
  onCreated,
  role,
  companies,
  embedded = false,
  open: controlledOpen,
  onOpenChange,
}: {
  onCreated: (company: Company) => void;
  role: UserRole;
  companies: Company[];
  embedded?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const createOpen = controlledOpen ?? internalOpen;
  const setCreateOpen = onOpenChange ?? setInternalOpen;
  const [saving, setSaving] = useState(false);
  const defaultOwner = authUserToAccountOwner(user);
  const [form, setForm] = useState({
    Title: "",
    Industry: "Polymer Processing" as CompanyIndustry,
    Status: "Prospecting" as CompanyStatus,
    CompanyTypes: ["Prospect"] as CompanyType[],
    parentCompanyId: "",
    accountOwnerId: defaultOwner.Id > 0 ? defaultOwner.Id : 0,
    City: "",
    Domain: "",
    Phone: "",
    AddressLine1: "",
    PostalCode: "",
    Country: "",
    countryCode: "",
    continent: "",
    organizationNumber: "",
    vatNumber: "",
    industryNote: "",
  });

  // Auth starts as Guest (id 0); once session resolves, sync a real owner id.
  // Without this the UI shows Mats via fallback but Create stays disabled (!0).
  useEffect(() => {
    if (defaultOwner.Id <= 0) return;
    setForm((current) =>
      current.accountOwnerId > 0
        ? current
        : { ...current, accountOwnerId: defaultOwner.Id },
    );
  }, [defaultOwner.Id]);

  const canCreate =
    Boolean(form.Title.trim()) &&
    Boolean(form.City.trim()) &&
    form.accountOwnerId > 0;

  const applyRegistryResult = (company: UnifiedEuropeanCompany) => {
    setForm((current) => ({
      ...current,
      Title: company.legalName || current.Title,
      organizationNumber: company.registrationNumber || current.organizationNumber,
      vatNumber: company.vatNumber || current.vatNumber,
      AddressLine1: company.streetAddress || current.AddressLine1,
      PostalCode: company.postalCode || current.PostalCode,
      City: company.city || current.City,
      Country: company.country || current.Country,
      countryCode: company.countryCode || current.countryCode,
      continent: company.continent || "Europe",
      industryNote:
        company.industryDescription ||
        (company.industryCode ? `Industry code: ${company.industryCode}` : current.industryNote),
    }));
  };

  useEffect(() => {
    const prefill = consumeEventCompanyPrefill();
    if (!prefill) return;
    setForm((current) => ({
      ...current,
      Title: prefill.Title || current.Title,
      Industry: prefill.Industry ?? current.Industry,
      Domain: prefill.Domain ?? current.Domain,
      City: prefill.City ?? current.City,
      Phone: prefill.Phone ?? current.Phone,
    }));
    setCreateOpen(true);
  }, [setCreateOpen]);

  const toggleCompanyType = (types: CompanyType[]) => {
    setForm((current) => ({
      ...current,
      CompanyTypes: types.length > 0 ? types : current.CompanyTypes,
    }));
  };

  const handleCreate = async () => {
    if (!canCreate) {
      return;
    }

    const accountOwner = resolveOwnerById(form.accountOwnerId, companies) ?? defaultOwner;

    setSaving(true);

    try {
      const company = await createCompanyRecord({
        Title: form.Title.trim(),
        Industry: form.Industry,
        Status: form.Status,
        CompanyTypes: form.CompanyTypes,
        City: form.City.trim(),
        Domain: form.Domain.trim(),
        Phone: form.Phone.trim(),
        AddressLine1: form.AddressLine1.trim() || undefined,
        PostalCode: form.PostalCode.trim() || undefined,
        Country: form.Country.trim()
          ? { Id: 0, Title: form.Country.trim() }
          : undefined,
        countryCode: form.countryCode.trim() || null,
        continent: form.continent.trim() || null,
        organizationNumber: form.organizationNumber.trim() || null,
        vatNumber: form.vatNumber.trim() || null,
        Notes: form.industryNote.trim() || undefined,
        ParentCompany: resolveParentCompanyLookup(form.parentCompanyId, companies),
        AccountOwner: accountOwner,
      });
      onCreated(company);
      setForm({
        Title: "",
        Industry: "Polymer Processing",
        Status: "Prospecting",
        CompanyTypes: ["Prospect"],
        parentCompanyId: "",
        accountOwnerId: defaultOwner.Id > 0 ? defaultOwner.Id : 0,
        City: "",
        Domain: "",
        Phone: "",
        AddressLine1: "",
        PostalCode: "",
        Country: "",
        countryCode: "",
        continent: "",
        organizationNumber: "",
        vatNumber: "",
        industryNote: "",
      });
      setCreateOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (!canCreateCompany(role)) {
    return null;
  }

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
            className="border border-carbon-blue/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue transition-colors hover:border-upcycle-orange/30 hover:bg-upcycle-orange/[0.04] hover:text-upcycle-orange"
          >
            + New Company
          </button>
        </div>
      )}
      {createOpen ? (
        <div className={`grid gap-2 sm:grid-cols-2 ${embedded ? "" : "p-3"}`}>
          <div className="sm:col-span-2">
            <EuropeanRegistrySearch
              domainHint={form.Domain}
              onSelect={applyRegistryResult}
            />
          </div>
          <label className="block sm:col-span-2">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              Company Name (Title)
            </span>
            <input
              type="text"
              value={form.Title}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  Title: event.target.value,
                }))
              }
              className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1 text-xs text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
            />
          </label>
          <div className="sm:col-span-2">
            <CompanyOwnerSelect
              companies={companies}
              value={resolveOwnerById(form.accountOwnerId, companies) ?? defaultOwner}
              onChange={(owner) =>
                setForm((current) => ({ ...current, accountOwnerId: owner.Id }))
              }
              required
              label="Account Owner"
            />
          </div>
          <label className="block">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              Registration number
            </span>
            <input
              type="text"
              value={form.organizationNumber}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  organizationNumber: event.target.value,
                }))
              }
              className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1 text-xs text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
            />
          </label>
          <label className="block">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              VAT number
            </span>
            <input
              type="text"
              value={form.vatNumber}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  vatNumber: event.target.value,
                }))
              }
              className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1 text-xs text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
            />
          </label>
          <label className="block">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              Industry
            </span>
            <select
              value={form.Industry}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  Industry: event.target.value as CompanyIndustry,
                }))
              }
              className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1 text-xs text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
            >
              {COMPANY_INDUSTRIES.map((industry) => (
                <option key={industry} value={industry}>
                  {industry}
                </option>
              ))}
            </select>
          </label>
          <div className="block sm:col-span-2">
            <CompanyTypeMultiSelect
              value={form.CompanyTypes}
              onChange={toggleCompanyType}
              density="compact"
              required
            />
          </div>
          <label className="block">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              Parent Company
            </span>
            <select
              value={form.parentCompanyId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  parentCompanyId: event.target.value,
                }))
              }
              className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1 text-xs text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
            >
              <option value="">None</option>
              {companies.map((record) => (
                <option key={record.CompanyID} value={String(record.id)}>
                  {record.Title}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              Status
            </span>
            <select
              value={form.Status}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  Status: event.target.value as CompanyStatus,
                }))
              }
              className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1 text-xs text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
            >
              {COMPANY_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              Street
            </span>
            <input
              type="text"
              value={form.AddressLine1}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  AddressLine1: event.target.value,
                }))
              }
              className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1 text-xs text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
            />
          </label>
          <label className="block">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              Postal code
            </span>
            <input
              type="text"
              value={form.PostalCode}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  PostalCode: event.target.value,
                }))
              }
              className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1 text-xs text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
            />
          </label>
          <label className="block">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              City
            </span>
            <input
              type="text"
              value={form.City}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  City: event.target.value,
                }))
              }
              className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1 text-xs text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
            />
          </label>
          <label className="block">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              Country
            </span>
            <input
              type="text"
              value={form.Country}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  Country: event.target.value,
                }))
              }
              className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1 text-xs text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
            />
          </label>
          <label className="block">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              Continent
            </span>
            <input
              type="text"
              value={form.continent}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  continent: event.target.value,
                }))
              }
              className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1 text-xs text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
            />
          </label>
          <label className="block">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              Website
            </span>
            <input
              type="text"
              value={form.Domain}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  Domain: event.target.value,
                }))
              }
              className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1 text-xs text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              Phone
            </span>
            <input
              type="text"
              value={form.Phone}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  Phone: event.target.value,
                }))
              }
              className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1 text-xs text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
            />
          </label>
          <button
            type="button"
            disabled={saving || !canCreate}
            onClick={() => void handleCreate()}
            className="border border-upcycle-orange/30 bg-upcycle-orange/10 px-2 py-1.5 text-xs font-semibold text-upcycle-orange transition-colors hover:bg-upcycle-orange/15 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"
          >
            {saving ? "Saving…" : "Create Company"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
