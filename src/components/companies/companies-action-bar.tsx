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
import { COMPANY_TYPE_QUICK_FILTERS } from "@/types/company-type";
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
    accountOwnerId: defaultOwner.Id,
    City: "",
    Domain: "",
    Phone: "",
  });

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

  const toggleCompanyType = (type: CompanyType) => {
    setForm((current) => {
      const selected = current.CompanyTypes.includes(type)
        ? current.CompanyTypes.filter((value) => value !== type)
        : [...current.CompanyTypes, type];
      return { ...current, CompanyTypes: selected.length > 0 ? selected : [type] };
    });
  };

  const handleCreate = async () => {
    if (!form.Title.trim() || !form.City.trim() || !form.accountOwnerId) {
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
        accountOwnerId: defaultOwner.Id,
        City: "",
        Domain: "",
        Phone: "",
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
              label="Company Owner"
            />
          </div>
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
            <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              Company Type
            </span>
            <div className="mt-1 flex flex-wrap gap-2">
              {COMPANY_TYPE_QUICK_FILTERS.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleCompanyType(type)}
                  className={`border px-2 py-1 text-[10px] font-semibold ${
                    form.CompanyTypes.includes(type)
                      ? "border-upcycle-orange/30 bg-upcycle-orange/10 text-upcycle-orange"
                      : "border-carbon-blue/12 text-carbon-blue/55"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
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
            disabled={saving || !form.Title.trim() || !form.City.trim() || !form.accountOwnerId}
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
