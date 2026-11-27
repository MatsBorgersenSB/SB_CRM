"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Sparkles,
} from "lucide-react";
import type { CreateContactInput } from "@/types/contact";
import {
  BUYING_ROLES,
  CONTACT_SENTIMENTS,
  CONTACT_STATUSES,
  DEFAULT_ENGAGEMENT_CADENCE,
  ENGAGEMENT_CADENCES,
  INFLUENCE_LEVELS,
  RELATIONSHIP_LEVELS,
} from "@/types/contact";
import { EMPLOYMENT_STATUSES } from "@/types/contact-lifecycle";
import { contact360Href } from "@/types/relationship-navigation";
import { CompanyCombobox } from "@/components/companies/company-combobox";
import { CountryContinentFields } from "@/components/companies/country-continent-fields";
import { findCountryEntry, inferPhoneDialCode } from "@/lib/geo/country-continent";
import { ContactRoleSelect } from "@/components/ui/contact-role-select";
import { PhoneInputWithCountryCode } from "@/components/ui/phone-input-with-country-code";
import { extractEmailDomain, isInternalEmail } from "@/lib/domain-rules";
import { normalizeCompanyDomain } from "@/lib/company-domain";
import { fillContactFormFromPastedText } from "@/lib/contact-paste";
import {
  companyNeedsSelectDisambiguation,
  formatCompanySelectLabel,
} from "@/lib/m365/company-resolution";

export type ContactFormCompanyOption = {
  CompanyID: string;
  Title: string;
  City?: string;
  Domain?: string;
  Phone?: string;
  countryCode?: string | null;
  Country?: string | { Title?: string } | null;
  contacts?: Array<{ ContactID: string; Title: string; Email?: string }>;
};

export type PotentialDuplicateContact = {
  contactId: string;
  contactName: string;
  companyId: string;
  companyName: string;
  reason: "Same email" | "Same name";
};

const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "hotmail.no",
  "live.com",
  "live.no",
  "icloud.com",
  "me.com",
  "yahoo.com",
  "yahoo.no",
  "proton.me",
  "protonmail.com",
  "msn.com",
  "online.no",
]);

export const emptyContactForm = (): CreateContactInput => ({
  FirstName: "",
  LastName: "",
  JobTitle: "",
  Role: "",
  Email: "",
  Phone: "",
  Mobile: "",
  LinkedInURL: "",
  Status: "Active",
  RelationshipLevel: "Operational",
  EmploymentStatus: "Active",
  buyingRole: undefined,
  sentiment: undefined,
  influenceLevel: undefined,
  reportsToId: "",
  city: "",
  country: "",
  timezone: "",
  isTimezoneOverridden: false,
  streetAddress: "",
  postalCode: "",
  stateRegion: "",
  countryCode: "",
  continent: "",
  engagementCadence: DEFAULT_ENGAGEMENT_CADENCE,
  backgroundNotes: "",
  preferredLanguage: "",
  Company: { Id: 0, Title: "" },
});

type ContactFormFieldsProps = {
  form: CreateContactInput;
  onChange: (next: CreateContactInput) => void;
  /** "create" shows compact quick-paste; "edit" tucks paste behind a toggle. */
  mode?: "create" | "edit";
  showCompanySelect?: boolean;
  requireCompany?: boolean;
  companies?: ContactFormCompanyOption[];
  companyId?: string;
  currentContactId?: string;
  onCompanyChange?: (companyId: string) => void;
  jobTitleLabel?: string;
};

const FIELD_CLASS =
  "mt-0.5 w-full border border-carbon-blue/15 bg-white px-2.5 py-1.5 text-[13px] text-carbon-blue outline-none transition-colors focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40";

const LABEL_CLASS =
  "block text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/65";

export function BuyingRoleSelect({
  value,
  onChange,
  className = FIELD_CLASS,
  disabled = false,
}: {
  value?: CreateContactInput["buyingRole"];
  onChange: (buyingRole: CreateContactInput["buyingRole"] | undefined) => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <select
      value={value ?? ""}
      disabled={disabled}
      onChange={(event) => {
        const next = event.target.value;
        onChange(next ? (next as CreateContactInput["buyingRole"]) : undefined);
      }}
      className={className}
    >
      <option value="">Unknown</option>
      {BUYING_ROLES.map((role) => (
        <option key={role} value={role}>
          {role}
        </option>
      ))}
    </select>
  );
}

export function inferTimezoneFromCountry(country: string): string {
  const normalized = country.trim().toLowerCase();
  if (!normalized) return "";
  if (normalized.includes("norway") || normalized === "no") return "Europe/Oslo";
  if (normalized.includes("sweden") || normalized === "se") return "Europe/Stockholm";
  if (normalized.includes("denmark") || normalized === "dk") return "Europe/Copenhagen";
  if (normalized.includes("finland") || normalized === "fi") return "Europe/Helsinki";
  if (normalized.includes("iceland") || normalized === "is") return "Atlantic/Reykjavik";
  if (normalized.includes("germany") || normalized === "de") return "Europe/Berlin";
  if (normalized.includes("austria") || normalized === "at") return "Europe/Vienna";
  if (normalized.includes("switzerland") || normalized === "ch") return "Europe/Zurich";
  if (normalized.includes("netherlands") || normalized === "nl") return "Europe/Amsterdam";
  if (normalized.includes("belgium") || normalized === "be") return "Europe/Brussels";
  if (normalized.includes("france") || normalized === "fr") return "Europe/Paris";
  if (normalized.includes("spain") || normalized === "es") return "Europe/Madrid";
  if (normalized.includes("italy") || normalized === "it") return "Europe/Rome";
  if (normalized.includes("poland") || normalized === "pl") return "Europe/Warsaw";
  if (normalized.includes("portugal") || normalized === "pt") return "Europe/Lisbon";
  if (normalized.includes("ireland") || normalized === "ie") return "Europe/Dublin";
  if (normalized.includes("united kingdom") || normalized === "uk" || normalized === "gb") {
    return "Europe/London";
  }
  if (normalized.includes("united states") || normalized === "usa" || normalized === "us") {
    return "America/New_York";
  }
  if (normalized.includes("canada") || normalized === "ca") return "America/Toronto";
  if (normalized.includes("australia") || normalized === "au") return "Australia/Sydney";
  if (normalized.includes("japan") || normalized === "jp") return "Asia/Tokyo";
  if (normalized.includes("singapore") || normalized === "sg") return "Asia/Singapore";
  return "";
}

/**
 * Reality First: suggests an existing company matching the email's corporate domain.
 * Never auto-assigns silently — the user clicks to accept.
 */
export function findSuggestedCompanyByEmail(
  email: string,
  companies: ContactFormCompanyOption[],
): ContactFormCompanyOption | null {
  const domain = extractEmailDomain(email.trim().toLowerCase());
  if (!domain || PERSONAL_EMAIL_DOMAINS.has(domain)) return null;

  const domainMatches = companies.filter(
    (company) => normalizeCompanyDomain(company.Domain ?? "") === domain,
  );
  if (domainMatches.length === 1) return domainMatches[0]!;

  const contactMatches = companies.filter((company) =>
    company.contacts?.some(
      (contact) => extractEmailDomain(contact.Email ?? "") === domain,
    ),
  );
  if (contactMatches.length === 1) return contactMatches[0]!;

  return null;
}

/**
 * FS-002 US-04 / BG-02: detect existing contacts matching the entered email or full name.
 */
export function findPotentialDuplicateContacts({
  email,
  firstName,
  lastName,
  companies,
  currentContactId = "",
}: {
  email: string;
  firstName: string;
  lastName: string;
  companies: ContactFormCompanyOption[];
  currentContactId?: string;
}): PotentialDuplicateContact[] {
  const normalizedEmail = email.trim().toLowerCase();
  const hasEmail = normalizedEmail.includes("@") && normalizedEmail.length >= 5;
  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim().toLowerCase();
  const hasFullName = Boolean(firstName.trim() && lastName.trim());

  if (!hasEmail && !hasFullName) return [];

  const matches: PotentialDuplicateContact[] = [];
  const seen = new Set<string>();

  for (const company of companies) {
    for (const contact of company.contacts ?? []) {
      if (currentContactId && contact.ContactID === currentContactId) continue;
      if (seen.has(contact.ContactID)) continue;

      const existingEmail = contact.Email?.trim().toLowerCase() ?? "";
      const existingName = contact.Title.trim().toLowerCase();

      if (hasEmail && existingEmail && existingEmail === normalizedEmail) {
        seen.add(contact.ContactID);
        matches.push({
          contactId: contact.ContactID,
          contactName: contact.Title,
          companyId: company.CompanyID,
          companyName: company.Title,
          reason: "Same email",
        });
      } else if (hasFullName && existingName && existingName === fullName) {
        seen.add(contact.ContactID);
        matches.push({
          contactId: contact.ContactID,
          contactName: contact.Title,
          companyId: company.CompanyID,
          companyName: company.Title,
          reason: "Same name",
        });
      }
    }
  }

  return matches.slice(0, 3);
}

function getCompanyCountryName(company?: ContactFormCompanyOption): string {
  if (!company?.Country) return "";
  return typeof company.Country === "string"
    ? company.Country.trim()
    : company.Country.Title?.trim() || "";
}

export function ContactFormFields({
  form,
  onChange,
  mode = "create",
  showCompanySelect = false,
  requireCompany = showCompanySelect,
  companies = [],
  companyId = "",
  currentContactId = "",
  onCompanyChange,
  jobTitleLabel = "Job Title",
}: ContactFormFieldsProps) {
  const selectedCompany = useMemo(
    () => companies.find((company) => company.CompanyID === companyId),
    [companies, companyId],
  );
  const managerOptions =
    selectedCompany?.contacts?.filter((contact) => contact.ContactID !== currentContactId) ?? [];
  const companyCountryName = getCompanyCountryName(selectedCompany);
  const companyCity = selectedCompany?.City?.trim() || "";
  const inheritedTimezone = inferTimezoneFromCountry(companyCountryName);

  const defaultDialCode = inferPhoneDialCode({
    countryCode: form.countryCode || selectedCompany?.countryCode,
    country: form.country || companyCountryName,
    domain: selectedCompany?.Domain,
    email: form.Email,
    companyPhone: selectedCompany?.Phone,
  });

  const companyOptions = useMemo(
    () =>
      companies.map((company) => ({
        id: company.CompanyID,
        name: formatCompanySelectLabel(
          company,
          companyNeedsSelectDisambiguation(company, companies),
        ),
        domain: company.Domain?.trim() || undefined,
      })),
    [companies],
  );

  const suggestedCompany = useMemo(() => {
    if (!showCompanySelect || companyId) return null;
    return findSuggestedCompanyByEmail(form.Email, companies);
  }, [showCompanySelect, companyId, form.Email, companies]);

  const potentialDuplicates = useMemo(
    () =>
      findPotentialDuplicateContacts({
        email: form.Email,
        firstName: form.FirstName,
        lastName: form.LastName,
        companies,
        currentContactId,
      }),
    [form.Email, form.FirstName, form.LastName, companies, currentContactId],
  );

  const applyCompanyInheritance = (nextCompanyId: string) => {
    onCompanyChange?.(nextCompanyId);
    if (!nextCompanyId || form.isTimezoneOverridden) return;

    const nextCompany = companies.find((company) => company.CompanyID === nextCompanyId);
    if (!nextCompany) return;

    const country = getCompanyCountryName(nextCompany);
    const city = nextCompany.City?.trim() || "";
    const geo = findCountryEntry(nextCompany.countryCode || country);
    const timezone = inferTimezoneFromCountry(geo?.name || country);
    onChange({
      ...form,
      country: geo?.name || country,
      countryCode: geo?.code || nextCompany.countryCode || "",
      continent: geo?.continent || "",
      city,
      timezone,
      isTimezoneOverridden: false,
    });
  };

  const [pasteExpanded, setPasteExpanded] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteFilled, setPasteFilled] = useState<string[]>([]);
  const [pasteError, setPasteError] = useState<string | null>(null);

  const [relationshipOpen, setRelationshipOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(Boolean(form.isTimezoneOverridden));
  const [geoFilling, setGeoFilling] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const applyPastedContact = (raw: string) => {
    const result = fillContactFormFromPastedText(form, raw);
    setPasteError(result.error);
    setPasteFilled(result.filled);
    if (result.filled.length > 0) {
      onChange(result.next);
    }
  };

  const handleAutoFillLocation = async () => {
    setGeoFilling(true);
    setGeoError(null);
    try {
      const query = [
        form.streetAddress?.trim() || "",
        form.postalCode?.trim()
          ? `${form.postalCode.trim()} ${form.city?.trim() || ""}`.trim()
          : form.city?.trim() || "",
        form.country?.trim() || "",
      ]
        .filter(Boolean)
        .join(", ");

      if (!query.trim()) {
        setGeoError("Enter a street address, city, or country first.");
        return;
      }

      const res = await fetch(`/api/geo/lookup?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error(`Geo lookup failed (${res.status})`);

      const osm = (await res.json()) as {
        streetAddress: string;
        postalCode: string;
        city: string;
        stateRegion: string;
        country: string;
        countryCode: string;
        continent: string;
      };

      const countryForTz = osm.country?.trim() || form.country || "";

      onChange({
        ...form,
        streetAddress: osm.streetAddress,
        postalCode: osm.postalCode,
        city: osm.city,
        stateRegion: osm.stateRegion,
        country: osm.country,
        countryCode: osm.countryCode,
        continent: osm.continent,
        timezone: inferTimezoneFromCountry(countryForTz) || form.timezone || "",
        isTimezoneOverridden: true,
      });
    } catch (e) {
      setGeoError(e instanceof Error ? e.message : "Unable to auto-fill location.");
    } finally {
      setGeoFilling(false);
    }
  };

  const relationshipSummary = useMemo(() => {
    const bits: string[] = [];
    if (form.buyingRole) bits.push(form.buyingRole);
    if (form.influenceLevel) bits.push(`${form.influenceLevel} influence`);
    if (form.sentiment) bits.push(form.sentiment);
    if (form.Role) bits.push(form.Role);
    if (form.Status && form.Status !== "Active") bits.push(form.Status);
    if (form.EmploymentStatus && form.EmploymentStatus !== "Active") {
      bits.push(form.EmploymentStatus);
    }
    return bits.length > 0
      ? bits.join(" · ")
      : "Optional — buying role, reporting line, status, language";
  }, [
    form.buyingRole,
    form.influenceLevel,
    form.sentiment,
    form.Role,
    form.Status,
    form.EmploymentStatus,
  ]);

  const locationSummary = useMemo(() => {
    if (!form.isTimezoneOverridden) {
      const inheritedPlace = [companyCity, companyCountryName].filter(Boolean).join(", ");
      if (inheritedPlace) {
        return `Uses company location (${inheritedPlace}${inheritedTimezone ? ` · ${inheritedTimezone}` : ""})`;
      }
      return selectedCompany
        ? `Uses location from ${selectedCompany.Title}`
        : "Uses company location & timezone";
    }
    const customPlace = [form.city?.trim(), form.country?.trim()].filter(Boolean).join(", ");
    if (customPlace) {
      return `Custom: ${customPlace}${form.timezone?.trim() ? ` · ${form.timezone.trim()}` : ""}`;
    }
    return "Custom location & timezone";
  }, [
    form.isTimezoneOverridden,
    form.city,
    form.country,
    form.timezone,
    companyCity,
    companyCountryName,
    inheritedTimezone,
    selectedCompany,
  ]);

  const internalEmailBlocked = isInternalEmail(form.Email);

  return (
    <div className="space-y-3">
      {/* Compact SmartAssist Paste Strip */}
      {mode === "edit" && !pasteExpanded ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setPasteExpanded(true)}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-carbon-blue/60 transition-colors hover:text-upcycle-orange"
          >
            <ClipboardPaste className="size-3.5" aria-hidden />
            Paste signature or profile to fill fields
          </button>
        </div>
      ) : (
        <section className="border border-upcycle-orange/20 bg-upcycle-orange/[0.025] px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-upcycle-orange" aria-hidden />
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-carbon-blue/75">
                Quick paste
              </span>
              <span className="text-[12px] text-carbon-blue/55">
                — paste an email signature or website bio to fill name, title, email, phone, LinkedIn, and address.
              </span>
            </div>
            {mode === "edit" ? (
              <button
                type="button"
                onClick={() => setPasteExpanded(false)}
                className="text-[11px] font-semibold text-carbon-blue/55 hover:text-carbon-blue"
              >
                Hide
              </button>
            ) : null}
          </div>
          <div className="mt-1.5 flex flex-col gap-1.5 sm:flex-row sm:items-start">
            <textarea
              value={pasteText}
              onFocus={() => setPasteExpanded(true)}
              onChange={(event) => setPasteText(event.target.value)}
              onPaste={(event) => {
                const pasted = event.clipboardData.getData("text");
                if (!pasted.trim()) return;
                event.preventDefault();
                setPasteText(pasted);
                setPasteExpanded(true);
                applyPastedContact(pasted);
              }}
              rows={pasteExpanded || pasteText ? 3 : 1}
              placeholder="Paste signature here (Ctrl+V) — e.g. Per Egil Strand, Senior salgsingeniør, +47 913 02 266, peregil@tormatic.no"
              className="w-full resize-y border border-carbon-blue/15 bg-white px-2.5 py-1.5 text-[12px] text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
            />
            {pasteText.trim() ? (
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => applyPastedContact(pasteText)}
                  className="border border-upcycle-orange/30 bg-upcycle-orange px-2.5 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPasteText("");
                    setPasteFilled([]);
                    setPasteError(null);
                    setPasteExpanded(false);
                  }}
                  className="border border-carbon-blue/15 bg-white px-2 py-1.5 text-[12px] font-medium text-carbon-blue/65 hover:text-carbon-blue"
                >
                  Clear
                </button>
              </div>
            ) : null}
          </div>
          {pasteFilled.length > 0 ? (
            <p className="mt-1 text-[11px] font-medium text-carbon-blue/70">
              Filled: {pasteFilled.join(", ")}
            </p>
          ) : null}
          {pasteError ? (
            <p className="mt-1 text-[11px] font-medium text-thermal-red" role="alert">
              {pasteError}
            </p>
          ) : null}
        </section>
      )}

      {/* Tier 1 — Primary Essentials (Always Above the Fold) */}
      <section className="border border-carbon-blue/12 bg-white p-4">
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Left Column: Who & Where */}
          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-carbon-blue/65">
              Identity & Organization
            </p>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <label className="block">
                <span className={LABEL_CLASS}>
                  First Name <span className="text-upcycle-orange">*</span>
                </span>
                <input
                  type="text"
                  required
                  autoFocus={mode === "create"}
                  value={form.FirstName}
                  placeholder="First name"
                  onChange={(event) => onChange({ ...form, FirstName: event.target.value })}
                  className={FIELD_CLASS}
                />
              </label>
              <label className="block">
                <span className={LABEL_CLASS}>
                  Last Name <span className="text-upcycle-orange">*</span>
                </span>
                <input
                  type="text"
                  required
                  value={form.LastName}
                  placeholder="Last name"
                  onChange={(event) => onChange({ ...form, LastName: event.target.value })}
                  className={FIELD_CLASS}
                />
              </label>
            </div>

            <label className="block">
              <span className={LABEL_CLASS}>{jobTitleLabel}</span>
              <input
                type="text"
                value={form.JobTitle}
                placeholder="e.g. Project Director, Head of Procurement"
                onChange={(event) => onChange({ ...form, JobTitle: event.target.value })}
                className={FIELD_CLASS}
              />
            </label>

            {showCompanySelect ? (
              <div>
                <span className={LABEL_CLASS}>
                  Company {requireCompany ? <span className="text-upcycle-orange">*</span> : null}
                </span>
                <CompanyCombobox
                  companies={companyOptions}
                  selectedCompanyId={companyId || null}
                  allowCreate={false}
                  hideLabel
                  density="compact"
                  required={requireCompany}
                  placeholder="Search company by name or domain…"
                  onSelectCompany={(company) => applyCompanyInheritance(company?.id ?? "")}
                />
                {suggestedCompany ? (
                  <div className="mt-1.5 flex items-center justify-between gap-2 border border-upcycle-orange/25 bg-upcycle-orange/[0.05] px-2.5 py-1.5 text-[12px]">
                    <span className="text-carbon-blue/80">
                      Email domain matches{" "}
                      <strong className="font-semibold text-carbon-blue">
                        {suggestedCompany.Title}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => applyCompanyInheritance(suggestedCompany.CompanyID)}
                      className="shrink-0 font-semibold text-upcycle-orange hover:underline"
                    >
                      Select company
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Right Column: Reach & Engagement */}
          <div className="space-y-3 lg:border-l lg:border-carbon-blue/8 lg:pl-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-carbon-blue/65">
              Reach & Engagement
            </p>

            <label className="block">
              <span className={LABEL_CLASS}>Email</span>
              <input
                type="email"
                value={form.Email}
                placeholder="name@company.com"
                onChange={(event) => onChange({ ...form, Email: event.target.value })}
                className={`${FIELD_CLASS} font-mono`}
              />
              {internalEmailBlocked ? (
                <p className="mt-1 text-[11px] font-medium text-thermal-red" role="alert">
                  Standard Bio colleagues are users, not contacts. Add them in Users & Access.
                </p>
              ) : null}
            </label>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <label className="block">
                <span className={LABEL_CLASS}>Mobile</span>
                <PhoneInputWithCountryCode
                  value={form.Mobile}
                  defaultDialCode={defaultDialCode}
                  onChange={(Mobile) => onChange({ ...form, Mobile })}
                  className={FIELD_CLASS}
                />
              </label>
              <label className="block">
                <span className={LABEL_CLASS}>Direct Phone</span>
                <PhoneInputWithCountryCode
                  value={form.Phone}
                  defaultDialCode={defaultDialCode}
                  onChange={(Phone) => onChange({ ...form, Phone })}
                  className={FIELD_CLASS}
                />
              </label>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <label className="block">
                <span className={LABEL_CLASS}>Target Cadence</span>
                <select
                  value={form.engagementCadence ?? DEFAULT_ENGAGEMENT_CADENCE}
                  onChange={(event) =>
                    onChange({
                      ...form,
                      engagementCadence: event.target
                        .value as CreateContactInput["engagementCadence"],
                    })
                  }
                  className={FIELD_CLASS}
                >
                  {ENGAGEMENT_CADENCES.map((cadence) => (
                    <option key={cadence} value={cadence}>
                      {cadence}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={LABEL_CLASS}>LinkedIn URL</span>
                <input
                  type="url"
                  value={form.LinkedInURL}
                  placeholder="https://linkedin.com/in/…"
                  onChange={(event) => onChange({ ...form, LinkedInURL: event.target.value })}
                  className={FIELD_CLASS}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Live Duplicate Check (FS-002 US-04 / BG-02) */}
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
              {potentialDuplicates.map((dup) => (
                <li key={dup.contactId} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span>
                    <strong>{dup.contactName}</strong> at {dup.companyName}{" "}
                    <span className="text-carbon-blue/60">({dup.reason})</span>
                  </span>
                  <Link
                    href={contact360Href(dup.contactId, dup.companyId)}
                    className="font-semibold text-upcycle-orange hover:underline"
                  >
                    Open contact
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Quick Notes — right below essentials, still above the fold */}
        <div className="mt-4 border-t border-carbon-blue/8 pt-3">
          <label className="block">
            <span className={LABEL_CLASS}>Background & Personal Notes</span>
            <textarea
              value={form.backgroundNotes ?? ""}
              onChange={(event) => onChange({ ...form, backgroundNotes: event.target.value })}
              rows={2}
              placeholder="How we met, priorities, communication preferences…"
              className={`${FIELD_CLASS} min-h-[54px] resize-y`}
            />
          </label>
        </div>
      </section>

      {/* Tier 2 — Collapsible Progressive Disclosure Accordions */}
      <section className="border border-carbon-blue/10 bg-white">
        <button
          type="button"
          aria-expanded={relationshipOpen}
          onClick={() => setRelationshipOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-carbon-blue/[0.02]"
        >
          <div className="flex min-w-0 items-center gap-2">
            {relationshipOpen ? (
              <ChevronDown className="size-3.5 shrink-0 text-carbon-blue/55" aria-hidden />
            ) : (
              <ChevronRight className="size-3.5 shrink-0 text-carbon-blue/55" aria-hidden />
            )}
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-carbon-blue/70">
              Relationship, Buying Role & Classification
            </span>
          </div>
          <span className="truncate text-[12px] text-carbon-blue/55">{relationshipSummary}</span>
        </button>

        {relationshipOpen ? (
          <div className="space-y-3 border-t border-carbon-blue/8 px-4 py-3">
            <div className="grid gap-2.5 md:grid-cols-3">
              <label className="block">
                <span className={LABEL_CLASS}>Buying Role</span>
                <BuyingRoleSelect
                  value={form.buyingRole}
                  onChange={(buyingRole) => onChange({ ...form, buyingRole })}
                  className={FIELD_CLASS}
                />
              </label>
              <label className="block">
                <span className={LABEL_CLASS}>Influence Level</span>
                <select
                  value={form.influenceLevel ?? ""}
                  onChange={(event) =>
                    onChange({
                      ...form,
                      influenceLevel: event.target.value
                        ? (event.target.value as CreateContactInput["influenceLevel"])
                        : undefined,
                    })
                  }
                  className={FIELD_CLASS}
                >
                  <option value="">Unknown</option>
                  {INFLUENCE_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={LABEL_CLASS}>Sentiment</span>
                <select
                  value={form.sentiment ?? ""}
                  onChange={(event) =>
                    onChange({
                      ...form,
                      sentiment: event.target.value
                        ? (event.target.value as CreateContactInput["sentiment"])
                        : undefined,
                    })
                  }
                  className={FIELD_CLASS}
                >
                  <option value="">Unknown</option>
                  {CONTACT_SENTIMENTS.map((sentiment) => (
                    <option key={sentiment} value={sentiment}>
                      {sentiment}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-2.5 md:grid-cols-3">
              <label className="block">
                <span className={LABEL_CLASS}>Relationship Level</span>
                <select
                  value={form.RelationshipLevel}
                  onChange={(event) =>
                    onChange({
                      ...form,
                      RelationshipLevel: event.target
                        .value as CreateContactInput["RelationshipLevel"],
                    })
                  }
                  className={FIELD_CLASS}
                >
                  {RELATIONSHIP_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={LABEL_CLASS}>Functional Role</span>
                <ContactRoleSelect
                  value={form.Role}
                  onChange={(role) => onChange({ ...form, Role: role })}
                  allowEmpty
                  emptyLabel="Not specified"
                  className={FIELD_CLASS}
                />
              </label>
              <label className="block">
                <span className={LABEL_CLASS}>Reports To</span>
                <select
                  value={form.reportsToId ?? ""}
                  onChange={(event) => onChange({ ...form, reportsToId: event.target.value })}
                  className={FIELD_CLASS}
                >
                  <option value="">
                    {managerOptions.length > 0 ? "None" : "No colleagues at company yet"}
                  </option>
                  {managerOptions.map((contact) => (
                    <option key={contact.ContactID} value={contact.ContactID}>
                      {contact.Title}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-2.5 md:grid-cols-3">
              <label className="block">
                <span className={LABEL_CLASS}>Contact Status</span>
                <select
                  value={form.Status}
                  onChange={(event) =>
                    onChange({
                      ...form,
                      Status: event.target.value as CreateContactInput["Status"],
                    })
                  }
                  className={FIELD_CLASS}
                >
                  {CONTACT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={LABEL_CLASS}>Employment Status</span>
                <select
                  value={form.EmploymentStatus ?? "Active"}
                  onChange={(event) =>
                    onChange({
                      ...form,
                      EmploymentStatus: event.target
                        .value as CreateContactInput["EmploymentStatus"],
                    })
                  }
                  className={FIELD_CLASS}
                >
                  {EMPLOYMENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={LABEL_CLASS}>Preferred Language</span>
                <input
                  type="text"
                  value={form.preferredLanguage ?? ""}
                  placeholder="e.g. Norwegian, English"
                  onChange={(event) =>
                    onChange({ ...form, preferredLanguage: event.target.value })
                  }
                  className={FIELD_CLASS}
                />
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
              Location & Timezone
            </span>
          </div>
          <span className="truncate text-[12px] text-carbon-blue/55">{locationSummary}</span>
        </button>

        {locationOpen ? (
          <div className="space-y-3 border-t border-carbon-blue/8 px-4 py-3">
            <label className="flex items-center gap-2 text-[12px] font-medium text-carbon-blue/80">
              <input
                type="checkbox"
                checked={!form.isTimezoneOverridden}
                onChange={(event) => {
                  const inherit = event.target.checked;
                  if (!inherit) {
                    onChange({ ...form, isTimezoneOverridden: true });
                    return;
                  }
                  const country = companyCountryName || form.country || "";
                  const city = companyCity || form.city || "";
                  const geo = findCountryEntry(selectedCompany?.countryCode || country);
                  onChange({
                    ...form,
                    city,
                    country: geo?.name || country,
                    countryCode: geo?.code || selectedCompany?.countryCode || form.countryCode || "",
                    continent: geo?.continent || form.continent || "",
                    timezone: inferTimezoneFromCountry(geo?.name || country),
                    isTimezoneOverridden: false,
                  });
                }}
              />
              Use company location & timezone
            </label>

            {!form.isTimezoneOverridden ? (
              <p className="border border-carbon-blue/8 bg-carbon-blue/[0.02] px-3 py-2 text-[12px] text-carbon-blue/65">
                {selectedCompany ? (
                  <>
                    Inherited from <strong className="text-carbon-blue">{selectedCompany.Title}</strong>
                    {companyCity || companyCountryName
                      ? `: ${[companyCity, companyCountryName].filter(Boolean).join(", ")}${
                          inheritedTimezone ? ` (${inheritedTimezone})` : ""
                        }.`
                      : " (no address set on company yet)."}
                    {" Uncheck above if this person works from a different office or timezone."}
                  </>
                ) : (
                  "Location and timezone will inherit from the selected company. Uncheck above to enter a custom office address."
                )}
              </p>
            ) : (
              <div className="space-y-3">
                <label className="block">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className={LABEL_CLASS}>Street Address</span>
                    <button
                      type="button"
                      disabled={geoFilling}
                      onClick={() => void handleAutoFillLocation()}
                      className="border border-carbon-blue/20 bg-white px-2.5 py-1 text-[11px] font-semibold text-carbon-blue/75 transition-colors hover:border-upcycle-orange/40 hover:text-upcycle-orange disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {geoFilling ? "Looking up…" : "Auto-fill from address"}
                    </button>
                  </div>
                  <textarea
                    value={form.streetAddress ?? ""}
                    onChange={(event) => onChange({ ...form, streetAddress: event.target.value })}
                    rows={2}
                    placeholder="Street, building, or office address"
                    className={`${FIELD_CLASS} min-h-[54px] resize-y`}
                  />
                </label>

                <CountryContinentFields
                  country={form.country ?? ""}
                  countryCode={form.countryCode ?? ""}
                  continent={form.continent ?? ""}
                  density="compact"
                  sideBySide
                  onChange={(next) =>
                    onChange({
                      ...form,
                      country: next.country,
                      countryCode: next.countryCode,
                      continent: next.continent,
                      timezone: next.country
                        ? inferTimezoneFromCountry(next.country) || form.timezone
                        : form.timezone,
                      isTimezoneOverridden: true,
                    })
                  }
                />

                <div className="grid gap-2.5 md:grid-cols-4">
                  <label className="block">
                    <span className={LABEL_CLASS}>City</span>
                    <input
                      type="text"
                      value={form.city ?? ""}
                      onChange={(event) => onChange({ ...form, city: event.target.value })}
                      className={FIELD_CLASS}
                    />
                  </label>
                  <label className="block">
                    <span className={LABEL_CLASS}>Postal Code</span>
                    <input
                      type="text"
                      value={form.postalCode ?? ""}
                      onChange={(event) => onChange({ ...form, postalCode: event.target.value })}
                      className={FIELD_CLASS}
                    />
                  </label>
                  <label className="block">
                    <span className={LABEL_CLASS}>State / Region</span>
                    <input
                      type="text"
                      value={form.stateRegion ?? ""}
                      onChange={(event) => onChange({ ...form, stateRegion: event.target.value })}
                      className={FIELD_CLASS}
                    />
                  </label>
                  <label className="block">
                    <span className={LABEL_CLASS}>Timezone</span>
                    <input
                      type="text"
                      value={form.timezone ?? ""}
                      placeholder="e.g. Europe/Oslo"
                      onChange={(event) =>
                        onChange({
                          ...form,
                          timezone: event.target.value,
                          isTimezoneOverridden: true,
                        })
                      }
                      className={FIELD_CLASS}
                    />
                  </label>
                </div>

                {geoError ? (
                  <p className="text-[12px] font-medium text-thermal-red" role="alert">
                    {geoError}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function isContactFormValid(form: CreateContactInput): boolean {
  return contactFormValidationMessage(form) === null;
}

/** FS-002: email is optional (0..*). Name is required. Internal domains are users, not contacts. */
export function contactFormValidationMessage(form: CreateContactInput): string | null {
  if (!form.FirstName.trim() || !form.LastName.trim()) {
    return "First and last name are required.";
  }
  if (isInternalEmail(form.Email)) {
    return "Standard Bio colleagues are users, not contacts. Add them in Users & Access.";
  }
  return null;
}
