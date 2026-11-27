"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Sparkles,
  X,
} from "lucide-react";
import { createCompanyRecord } from "@/lib/sync-company";
import { resolveParentCompanyLookup } from "@/lib/company-identity";
import { authUserToAccountOwner, resolveOwnerById } from "@/lib/company-owner";
import { consumeEventCompanyPrefill } from "@/lib/event-planning-prefill";
import { CompanyOwnerSelect } from "@/components/companies/company-owner-select";
import type { StandardBioUserRecord } from "@/types/user-access";
import { useAuth } from "@/context/auth-context";
import type { Company } from "@/lib/companies-data";
import { canCreateCompany } from "@/lib/permissions";
import type { CompanyIndustry, CompanyStatus } from "@/types/company";
import { COMPANY_STATUSES } from "@/types/company";
import { IndustrySelect } from "@/components/ui/industry-select";
import type { CompanyType } from "@/types/company-type";
import { CompanyTypeMultiSelect } from "@/components/companies/company-type-multi-select";
import { CountryContinentFields } from "@/components/companies/country-continent-fields";
import { EuropeanRegistrySearch } from "@/components/companies/european-registry-search";
import type { UnifiedEuropeanCompany } from "@/lib/integrations/company-registers/types";
import type { UserRole } from "@/types/auth";
import { findCountryEntry, inferPhoneDialCode } from "@/lib/geo/country-continent";
import { stripBareDialCode } from "@/lib/m365/phone-normalization";
import { PhoneInputWithCountryCode } from "@/components/ui/phone-input-with-country-code";
import { useWhenChanged } from "@/hooks/use-when-changed";
import { company360Href, companyRouteKey } from "@/types/company-360";
import {
  isSharePointServiceError,
} from "@/services/sharepoint/client/errors";
import Link from "next/link";

const FIELD_CLASS =
  "mt-0.5 w-full border border-carbon-blue/15 bg-white px-2.5 py-1.5 text-[13px] text-carbon-blue outline-none transition-colors focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40";

const LABEL_CLASS =
  "block text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/65";

const MULTI_SELECT_TRIGGER_CLASS =
  "mt-0.5 flex w-full items-center justify-between gap-2 border border-carbon-blue/15 bg-white px-2.5 py-1.5 text-left outline-none transition-colors focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40 disabled:opacity-60";

function normalizeOrganizationNumber(value: string): string {
  return value.trim().toLowerCase().replace(/[\s.-]/g, "");
}

function normalizeCompanyName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function findCompanyByOrganizationNumber(
  companies: Company[],
  organizationNumber: string,
): Company | undefined {
  const needle = normalizeOrganizationNumber(organizationNumber);
  if (!needle) return undefined;
  return companies.find(
    (company) =>
      normalizeOrganizationNumber(company.organizationNumber ?? "") === needle,
  );
}
/** Minimum to create an account — everything else is optional enrichment. */
function missingCreateFields(form: {
  Title: string;
  accountOwnerId: number;
  CompanyTypes: CompanyType[];
}): string[] {
  const missing: string[] = [];
  if (!form.Title.trim()) missing.push("Company name");
  if (!(form.accountOwnerId > 0)) missing.push("Account owner");
  if (form.CompanyTypes.length === 0) missing.push("Company type");
  return missing;
}

function formatMissingFieldsMessage(missing: string[]): string | null {
  if (missing.length === 0) return null;
  if (missing.length === 1) return `${missing[0]} is required.`;
  if (missing.length === 2) {
    return `${missing[0]} and ${missing[1].toLowerCase()} are required.`;
  }
  return `${missing[0]}, ${missing[1].toLowerCase()}, and ${missing[2].toLowerCase()} are required.`;
}

function emptyCompanyForm(accountOwnerId: number) {
  return {
    Title: "",
    Industry: "" as CompanyIndustry,
    Status: "Prospecting" as CompanyStatus,
    CompanyTypes: [] as CompanyType[],
    parentCompanyId: "",
    accountOwnerId,
    City: "",
    Domain: "",
    Email: "",
    Phone: "",
    AddressLine1: "",
    PostalCode: "",
    Country: "",
    countryCode: "",
    continent: "",
    organizationNumber: "",
    vatNumber: "",
    industryNote: "",
  };
}

export function CompaniesActionBar({
  onCreated,
  role,
  companies,
  assignableUsers = [],
  embedded = false,
  open: controlledOpen,
  onOpenChange,
}: {
  onCreated: (company: Company) => void;
  role: UserRole;
  companies: Company[];
  assignableUsers?: StandardBioUserRecord[];
  embedded?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const createOpen = controlledOpen ?? internalOpen;
  const setCreateOpen = onOpenChange ?? setInternalOpen;
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createErrorHref, setCreateErrorHref] = useState<string | null>(null);
  const [registryFilled, setRegistryFilled] = useState<string[]>([]);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const defaultOwner = authUserToAccountOwner(user);
  const [form, setForm] = useState(() => emptyCompanyForm(defaultOwner.Id));

  // Keep Account Owner aligned once SSO/session resolves — never invent Mats.
  const sessionOwnerId = defaultOwner.Id;
  useWhenChanged([sessionOwnerId], () => {
    const owner = authUserToAccountOwner(user);
    setForm((current) =>
      current.accountOwnerId > 0
        ? current
        : { ...current, accountOwnerId: owner.Id },
    );
  });

  const missingRequired = missingCreateFields(form);
  const validationMessage = formatMissingFieldsMessage(missingRequired);
  const canCreate = missingRequired.length === 0;
  const existingByOrgNumber = useMemo(
    () => findCompanyByOrganizationNumber(companies, form.organizationNumber),
    [companies, form.organizationNumber],
  );

  const potentialDuplicates = useMemo(() => {
    const matches: Array<{ company: Company; reason: string }> = [];
    const seen = new Set<string>();
    if (existingByOrgNumber) {
      seen.add(existingByOrgNumber.CompanyID);
      matches.push({
        company: existingByOrgNumber,
        reason: "Same registration number",
      });
    }
    const normalizedName = normalizeCompanyName(form.Title);
    if (normalizedName.length >= 3) {
      for (const candidate of companies) {
        if (seen.has(candidate.CompanyID)) continue;
        if (normalizeCompanyName(candidate.Title) === normalizedName) {
          seen.add(candidate.CompanyID);
          matches.push({ company: candidate, reason: "Same name" });
        }
      }
    }
    return matches.slice(0, 3);
  }, [companies, existingByOrgNumber, form.Title]);

  const sortedParentOptions = useMemo(
    () =>
      [...companies].sort((a, b) =>
        a.Title.localeCompare(b.Title, undefined, { sensitivity: "base" }),
      ),
    [companies],
  );

  const registrationSummary = useMemo(() => {
    const parts: string[] = [];
    if (form.organizationNumber.trim()) {
      parts.push(`Org ${form.organizationNumber.trim()}`);
    }
    if (form.vatNumber.trim()) {
      parts.push(`VAT ${form.vatNumber.trim()}`);
    }
    if (form.parentCompanyId) {
      const parent = companies.find(
        (record) => String(record.id) === form.parentCompanyId,
      );
      if (parent) parts.push(`Parent: ${parent.Title}`);
    }
    if (form.Status && form.Status !== "Prospecting") {
      parts.push(form.Status);
    }
    return parts.length > 0
      ? parts.join(" · ")
      : "Optional — org number, VAT, parent company, status";
  }, [
    companies,
    form.Status,
    form.organizationNumber,
    form.parentCompanyId,
    form.vatNumber,
  ]);

  const locationSummary = useMemo(() => {
    const parts = [
      form.AddressLine1.trim(),
      [form.PostalCode.trim(), form.City.trim()].filter(Boolean).join(" "),
      form.Country.trim(),
    ].filter(Boolean);
    return parts.length > 0
      ? parts.join(", ")
      : "Optional — street, postal code, city, country";
  }, [form.AddressLine1, form.City, form.Country, form.PostalCode]);

  const resetAndClose = () => {
    setForm(emptyCompanyForm(defaultOwner.Id));
    setCreateError(null);
    setCreateErrorHref(null);
    setRegistryFilled([]);
    setRegistrationOpen(false);
    setLocationOpen(false);
    setCreateOpen(false);
  };

  const applyRegistryResult = (company: UnifiedEuropeanCompany) => {
    const geo =
      findCountryEntry(company.countryCode || company.country || "") ?? null;
    const filled: string[] = [];
    if (company.legalName) filled.push("Company name");
    if (company.registrationNumber) filled.push("Registration number");
    if (company.vatNumber) filled.push("VAT number");
    if (
      company.streetAddress ||
      company.postalCode ||
      company.city ||
      geo?.name ||
      company.country
    ) {
      filled.push("Address");
    }
    if (company.industryDescription || company.industryCode) {
      filled.push("Notes");
    }
    setRegistryFilled(filled);
    setForm((current) => ({
      ...current,
      Title: company.legalName || current.Title,
      organizationNumber: company.registrationNumber || current.organizationNumber,
      vatNumber: company.vatNumber || current.vatNumber,
      AddressLine1: company.streetAddress || current.AddressLine1,
      PostalCode: company.postalCode || current.PostalCode,
      City: company.city || current.City,
      Country: geo?.name || company.country || current.Country,
      countryCode: geo?.code || company.countryCode || current.countryCode,
      continent: geo?.continent || company.continent || current.continent,
      industryNote:
        company.industryDescription ||
        (company.industryCode ? `Industry code: ${company.industryCode}` : current.industryNote),
    }));
  };

  useEffect(() => {
    const prefill = consumeEventCompanyPrefill();
    if (!prefill) return;
    // One-shot hand-off from another screen; also opens the parent's create panel,
    // so it cannot be turned into a render-time adjustment.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm((current) => ({
      ...current,
      Title: prefill.Title || current.Title,
      Industry: prefill.Industry ?? current.Industry,
      Domain: prefill.Domain ?? current.Domain,
      Email: prefill.Email ?? current.Email,
      City: prefill.City ?? current.City,
      Phone: prefill.Phone ?? current.Phone,
    }));
    setCreateOpen(true);
  }, [setCreateOpen]);

  const toggleCompanyType = (types: CompanyType[]) => {
    setForm((current) => ({
      ...current,
      CompanyTypes: types,
    }));
  };

  const handleCreate = async () => {
    if (!canCreate) {
      setCreateError(`Required: ${missingRequired.join(", ")}`);
      setCreateErrorHref(null);
      return;
    }

    const duplicate = findCompanyByOrganizationNumber(
      companies,
      form.organizationNumber,
    );
    if (duplicate) {
      setCreateError(
        `Registration number ${form.organizationNumber.trim()} is already used by ${duplicate.Title}. Open that company instead of creating a duplicate.`,
      );
      setCreateErrorHref(company360Href(duplicate));
      return;
    }

    const accountOwner =
      resolveOwnerById(form.accountOwnerId, companies) ?? defaultOwner;

    setSaving(true);
    setCreateError(null);
    setCreateErrorHref(null);

    try {
      const company = await createCompanyRecord(
        {
          Title: form.Title.trim(),
          Industry: form.Industry,
          Status: form.Status,
          CompanyTypes: form.CompanyTypes,
          City: form.City.trim(),
          Domain: form.Domain.trim(),
          Email: form.Email.trim().toLowerCase() || undefined,
          Phone: stripBareDialCode(form.Phone),
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
        },
        role,
      );
      onCreated(company);
      resetAndClose();
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : "Unable to create company. Please try again.";
      const friendlyDuplicate =
        /organizationNumber|registration number .* already used/i.test(message);
      setCreateError(
        friendlyDuplicate && /Unique constraint failed/i.test(message)
          ? `Registration number ${form.organizationNumber.trim()} is already used by another company. Open that company instead of creating a duplicate.`
          : message,
      );
      let href: string | null = null;
      if (isSharePointServiceError(error)) {
        const details = error.details as
          | {
              details?: { href?: unknown; companyId?: unknown };
              href?: unknown;
              companyId?: unknown;
            }
          | null
          | undefined;
        const candidate =
          (typeof details?.details?.href === "string" && details.details.href) ||
          (typeof details?.href === "string" && details.href) ||
          null;
        const companyId =
          (typeof details?.details?.companyId === "string" &&
            details.details.companyId) ||
          (typeof details?.companyId === "string" && details.companyId) ||
          null;
        href = candidate || (companyId ? company360Href(companyId) : null);
      }
      if (!href && form.organizationNumber.trim()) {
        const existing = findCompanyByOrganizationNumber(
          companies,
          form.organizationNumber,
        );
        if (existing) href = company360Href(existing);
      }
      setCreateErrorHref(href);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleCreate();
  };

  if (!canCreateCompany(role)) {
    return null;
  }

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
              New Company
            </h2>
            <p className="mt-0.5 text-[12px] text-carbon-blue/55">
              Start with name, type, and owner — expand optional details only when needed.
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={resetAndClose}
            aria-label="Close new company card"
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
            + New Company
          </button>
        </div>
      )}
      {createOpen ? (
        <form onSubmit={handleSubmit} className="space-y-3 p-4">
          {/* Compact SmartAssist Registry Lookup Strip */}
          <section className="border border-upcycle-orange/20 bg-upcycle-orange/[0.025] px-3 py-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Sparkles className="size-3.5 text-upcycle-orange" aria-hidden />
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-carbon-blue/75">
                Registry lookup
              </span>
              <span className="text-[12px] text-carbon-blue/55">
                — search European business registries by name, org number, or VAT to fill legal details and address.
              </span>
            </div>
            <div className="mt-1.5">
              <EuropeanRegistrySearch
                hideLabel
                domainHint={form.Domain}
                onSelect={applyRegistryResult}
                inputClassName="w-full border border-carbon-blue/15 bg-white px-2.5 py-1.5 text-[12px] text-carbon-blue outline-none transition-colors focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
              />
            </div>
            {registryFilled.length > 0 ? (
              <p className="mt-1 text-[11px] font-medium text-carbon-blue/70">
                Filled: {registryFilled.join(", ")}
              </p>
            ) : null}
          </section>

          {/* Tier 1 — Primary Essentials (Always Above the Fold) */}
          <section className="border border-carbon-blue/12 bg-white p-4">
            <div className="grid gap-5 lg:grid-cols-2">
              {/* Left Column: Identity & Role */}
              <div className="space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-carbon-blue/65">
                  Identity &amp; Role
                </p>

                <label className="block">
                  <span className={LABEL_CLASS}>
                    Company Name <span className="text-upcycle-orange">*</span>
                  </span>
                  <input
                    type="text"
                    value={form.Title}
                    required
                    autoFocus
                    placeholder="e.g. Hydro Energi AS"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        Title: event.target.value,
                      }))
                    }
                    className={FIELD_CLASS}
                  />
                </label>

                <div>
                  <span className={LABEL_CLASS}>
                    Company Type <span className="text-upcycle-orange">*</span>
                  </span>
                  <CompanyTypeMultiSelect
                    value={form.CompanyTypes}
                    onChange={toggleCompanyType}
                    hideLabel
                    density="compact"
                    required
                    triggerClassName={MULTI_SELECT_TRIGGER_CLASS}
                  />
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2">
                  <label className="block">
                    <span className={LABEL_CLASS}>
                      Account Owner <span className="text-upcycle-orange">*</span>
                    </span>
                    <CompanyOwnerSelect
                      companies={companies}
                      assignableUsers={assignableUsers}
                      extraUsers={[defaultOwner]}
                      value={
                        resolveOwnerById(form.accountOwnerId, companies) ?? defaultOwner
                      }
                      onChange={(owner) =>
                        setForm((current) => ({ ...current, accountOwnerId: owner.Id }))
                      }
                      required
                      hideLabel
                      label="Account Owner"
                      selectClassName={FIELD_CLASS}
                    />
                  </label>
                  <label className="block">
                    <span className={LABEL_CLASS}>Industry</span>
                    <IndustrySelect
                      value={form.Industry}
                      onChange={(industry) =>
                        setForm((current) => ({
                          ...current,
                          Industry: industry,
                        }))
                      }
                      allowEmpty
                      className={FIELD_CLASS}
                    />
                  </label>
                </div>
              </div>

              {/* Right Column: Reach & Presence */}
              <div className="space-y-3 lg:border-l lg:border-carbon-blue/8 lg:pl-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-carbon-blue/65">
                  Reach &amp; Presence
                </p>

                <label className="block">
                  <span className={LABEL_CLASS}>Website</span>
                  <input
                    type="text"
                    value={form.Domain}
                    placeholder="https://company.com"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        Domain: event.target.value,
                      }))
                    }
                    className={FIELD_CLASS}
                  />
                </label>

                <label className="block">
                  <span className={LABEL_CLASS}>Company Email</span>
                  <input
                    type="email"
                    value={form.Email}
                    placeholder="info@company.com"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        Email: event.target.value,
                      }))
                    }
                    className={`${FIELD_CLASS} font-mono`}
                  />
                </label>

                <label className="block">
                  <span className={LABEL_CLASS}>Phone</span>
                  <PhoneInputWithCountryCode
                    value={form.Phone}
                    defaultDialCode={inferPhoneDialCode({
                      countryCode: form.countryCode,
                      country: form.Country,
                      domain: form.Domain,
                    })}
                    onChange={(Phone) =>
                      setForm((current) => ({
                        ...current,
                        Phone,
                      }))
                    }
                    className={FIELD_CLASS}
                  />
                </label>
              </div>
            </div>

            {/* Live Duplicate Check (FS-003 BG-02) */}
            {potentialDuplicates.length > 0 ? (
              <div
                className="mt-3 flex flex-col gap-1 border border-amber-500/35 bg-amber-50/70 px-3 py-2 text-[12px] text-carbon-blue"
                role="status"
              >
                <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                  <AlertTriangle className="size-3.5 shrink-0 text-amber-700" aria-hidden />
                  Possible duplicate already in SmartCRM
                </div>
                <ul className="space-y-0.5 pl-5">
                  {potentialDuplicates.map(({ company: dup, reason }) => (
                    <li
                      key={dup.CompanyID}
                      className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
                    >
                      <span>
                        <strong>{dup.Title}</strong>
                        {companyRouteKey(dup) ? ` (${companyRouteKey(dup)})` : ""}{" "}
                        <span className="text-carbon-blue/60">({reason})</span>
                      </span>
                      <Link
                        href={company360Href(dup)}
                        className="font-semibold text-upcycle-orange hover:underline"
                      >
                        Open company
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Quick Notes — right below essentials, still above the fold */}
            <div className="mt-4 border-t border-carbon-blue/8 pt-3">
              <label className="block">
                <span className={LABEL_CLASS}>Company Notes</span>
                <textarea
                  value={form.industryNote}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      industryNote: event.target.value,
                    }))
                  }
                  rows={2}
                  placeholder="Core business, context, how we connected…"
                  className={`${FIELD_CLASS} min-h-[54px] resize-y`}
                />
              </label>
            </div>
          </section>

          {/* Tier 2 — Collapsible Progressive Disclosure Accordions */}
          <section className="border border-carbon-blue/10 bg-white">
            <button
              type="button"
              aria-expanded={registrationOpen}
              onClick={() => setRegistrationOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-carbon-blue/[0.02]"
            >
              <div className="flex min-w-0 items-center gap-2">
                {registrationOpen ? (
                  <ChevronDown className="size-3.5 shrink-0 text-carbon-blue/55" aria-hidden />
                ) : (
                  <ChevronRight className="size-3.5 shrink-0 text-carbon-blue/55" aria-hidden />
                )}
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-carbon-blue/70">
                  Registration, Hierarchy &amp; Status
                </span>
              </div>
              <span className="truncate text-[12px] text-carbon-blue/55">
                {registrationSummary}
              </span>
            </button>

            {registrationOpen ? (
              <div className="space-y-3 border-t border-carbon-blue/8 px-4 py-3">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <label className="block">
                    <span className={LABEL_CLASS}>Registration Number</span>
                    <input
                      type="text"
                      value={form.organizationNumber}
                      placeholder="e.g. 923 456 789"
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          organizationNumber: event.target.value,
                        }))
                      }
                      className={FIELD_CLASS}
                    />
                  </label>
                  <label className="block">
                    <span className={LABEL_CLASS}>VAT Number</span>
                    <input
                      type="text"
                      value={form.vatNumber}
                      placeholder="e.g. NO923456789MVA"
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          vatNumber: event.target.value,
                        }))
                      }
                      className={FIELD_CLASS}
                    />
                  </label>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2">
                  <label className="block">
                    <span className={LABEL_CLASS}>Parent Company</span>
                    <select
                      value={form.parentCompanyId}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          parentCompanyId: event.target.value,
                        }))
                      }
                      className={FIELD_CLASS}
                    >
                      <option value="">None</option>
                      {sortedParentOptions.map((record) => (
                        <option key={record.CompanyID} value={String(record.id)}>
                          {record.Title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className={LABEL_CLASS}>Status</span>
                    <select
                      value={form.Status}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          Status: event.target.value as CompanyStatus,
                        }))
                      }
                      className={FIELD_CLASS}
                    >
                      {COMPANY_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ) : null}
          </section>

          <section className="border border-carbon-blue/10 bg-white">
            <button
              type="button"
              aria-expanded={locationOpen}
              onClick={() => setLocationOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-carbon-blue/[0.02]"
            >
              <div className="flex min-w-0 items-center gap-2">
                {locationOpen ? (
                  <ChevronDown className="size-3.5 shrink-0 text-carbon-blue/55" aria-hidden />
                ) : (
                  <ChevronRight className="size-3.5 shrink-0 text-carbon-blue/55" aria-hidden />
                )}
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-carbon-blue/70">
                  Location &amp; Address
                </span>
              </div>
              <span className="truncate text-[12px] text-carbon-blue/55">
                {locationSummary}
              </span>
            </button>

            {locationOpen ? (
              <div className="space-y-3 border-t border-carbon-blue/8 px-4 py-3">
                <label className="block">
                  <span className={LABEL_CLASS}>Street</span>
                  <input
                    type="text"
                    value={form.AddressLine1}
                    placeholder="Street address"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        AddressLine1: event.target.value,
                      }))
                    }
                    className={FIELD_CLASS}
                  />
                </label>

                <div className="grid gap-2.5 sm:grid-cols-2">
                  <label className="block">
                    <span className={LABEL_CLASS}>Postal Code</span>
                    <input
                      type="text"
                      value={form.PostalCode}
                      placeholder="Postal code"
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          PostalCode: event.target.value,
                        }))
                      }
                      className={FIELD_CLASS}
                    />
                  </label>
                  <label className="block">
                    <span className={LABEL_CLASS}>City</span>
                    <input
                      type="text"
                      value={form.City}
                      placeholder="City"
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          City: event.target.value,
                        }))
                      }
                      className={FIELD_CLASS}
                    />
                  </label>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2">
                  <CountryContinentFields
                    country={form.Country}
                    countryCode={form.countryCode}
                    continent={form.continent}
                    density="compact"
                    sideBySide
                    onChange={(next) =>
                      setForm((current) => ({
                        ...current,
                        Country: next.country,
                        countryCode: next.countryCode,
                        continent: next.continent,
                      }))
                    }
                  />
                </div>
              </div>
            ) : null}
          </section>

          <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-carbon-blue/10 bg-white/95 px-3 py-2.5 backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={saving || !canCreate}
                className="border border-upcycle-orange bg-upcycle-orange px-4 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-upcycle-orange/40 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {saving ? "Saving…" : "Create Company"}
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
            {createError ? (
              <div
                className="flex flex-wrap items-center gap-2 text-[12px] font-medium text-thermal-red"
                role="alert"
              >
                <span>{createError}</span>
                {createErrorHref ? (
                  <Link
                    href={createErrorHref}
                    className="font-semibold text-upcycle-orange hover:underline"
                  >
                    Open existing company
                  </Link>
                ) : null}
              </div>
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
