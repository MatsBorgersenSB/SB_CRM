"use client";

import { useState } from "react";
import type { CreateContactInput } from "@/types/contact";
import {
  BUYING_ROLES,
  CONTACT_SENTIMENTS,
  CONTACT_STATUSES,
  ENGAGEMENT_CADENCES,
  INFLUENCE_LEVELS,
  RELATIONSHIP_LEVELS,
} from "@/types/contact";
import { EMPLOYMENT_STATUSES } from "@/types/contact-lifecycle";
import { CountryContinentFields } from "@/components/companies/country-continent-fields";
import { findCountryEntry } from "@/lib/geo/country-continent";
import { ContactRoleSelect } from "@/components/ui/contact-role-select";

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
  sentiment: "Neutral",
  influenceLevel: "Medium",
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
  engagementCadence: "Monthly",
  backgroundNotes: "",
  preferredLanguage: "English",
  Company: { Id: 0, Title: "" },
});

type ContactFormFieldsProps = {
  form: CreateContactInput;
  onChange: (next: CreateContactInput) => void;
  showCompanySelect?: boolean;
  companies?: Array<{
    CompanyID: string;
    Title: string;
    City?: string;
    Country?: string | { Title?: string } | null;
    contacts?: Array<{ ContactID: string; Title: string }>;
  }>;
  companyId?: string;
  currentContactId?: string;
  onCompanyChange?: (companyId: string) => void;
  jobTitleLabel?: string;
};

const FIELD_CLASS =
  "mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1 text-xs text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40";

const LABEL_CLASS = "text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40";

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

function inferTimezoneFromCountry(country: string): string {
  const normalized = country.trim().toLowerCase();
  if (!normalized) return "";
  if (normalized.includes("norway")) return "Europe/Oslo";
  if (normalized.includes("sweden")) return "Europe/Stockholm";
  if (normalized.includes("denmark")) return "Europe/Copenhagen";
  if (normalized.includes("finland")) return "Europe/Helsinki";
  if (normalized.includes("germany")) return "Europe/Berlin";
  if (normalized.includes("united kingdom") || normalized === "uk") return "Europe/London";
  if (normalized.includes("united states") || normalized === "usa") return "America/New_York";
  return "Europe/Oslo";
}

export function ContactFormFields({
  form,
  onChange,
  showCompanySelect = false,
  companies = [],
  companyId = "",
  currentContactId = "",
  onCompanyChange,
  jobTitleLabel = "Job Title",
}: ContactFormFieldsProps) {
  const selectedCompany = companies.find((company) => company.CompanyID === companyId);
  const managerOptions =
    selectedCompany?.contacts?.filter((contact) => contact.ContactID !== currentContactId) ?? [];

  const applyCompanyInheritance = (nextCompanyId: string) => {
    onCompanyChange?.(nextCompanyId);
    if (form.isTimezoneOverridden) return;

    const nextCompany = companies.find((company) => company.CompanyID === nextCompanyId);
    if (!nextCompany) return;

    const country =
      typeof nextCompany.Country === "string"
        ? nextCompany.Country.trim()
        : nextCompany.Country?.Title?.trim() || "";
    const city = nextCompany.City?.trim() || "";
    const timezone = inferTimezoneFromCountry(country);
    onChange({
      ...form,
      country,
      city,
      timezone,
      isTimezoneOverridden: false,
    });
  };

  const [geoFilling, setGeoFilling] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

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
        setGeoError("Enter an address, city, or country first.");
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
        timezone: inferTimezoneFromCountry(countryForTz),
        isTimezoneOverridden: true,
      });
    } catch (e) {
      setGeoError(e instanceof Error ? e.message : "Unable to auto-fill location.");
    } finally {
      setGeoFilling(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="border border-carbon-blue/10 bg-white p-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-carbon-blue/45">
          Identity & Organization
        </p>
        <div className="grid gap-2 md:grid-cols-2">
          <label className="block">
            <span className={LABEL_CLASS}>First Name</span>
            <input
              type="text"
              value={form.FirstName}
              onChange={(event) => onChange({ ...form, FirstName: event.target.value })}
              className={FIELD_CLASS}
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>Last Name</span>
            <input
              type="text"
              value={form.LastName}
              onChange={(event) => onChange({ ...form, LastName: event.target.value })}
              className={FIELD_CLASS}
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>{jobTitleLabel}</span>
            <input
              type="text"
              value={form.JobTitle}
              onChange={(event) => onChange({ ...form, JobTitle: event.target.value })}
              className={FIELD_CLASS}
            />
          </label>
          {showCompanySelect ? (
            <label className="block">
              <span className={LABEL_CLASS}>Company</span>
              <select
                value={companyId}
                onChange={(event) => applyCompanyInheritance(event.target.value)}
                className={FIELD_CLASS}
              >
                {companies.map((company) => (
                  <option key={company.CompanyID} value={company.CompanyID}>
                    {company.Title} ({company.CompanyID})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block md:col-span-2">
            <span className={LABEL_CLASS}>Reports To</span>
            <select
              value={form.reportsToId ?? ""}
              onChange={(event) => onChange({ ...form, reportsToId: event.target.value })}
              className={FIELD_CLASS}
            >
              <option value="">None</option>
              {managerOptions.map((contact) => (
                <option key={contact.ContactID} value={contact.ContactID}>
                  {contact.Title}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="border border-carbon-blue/10 bg-white p-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-carbon-blue/45">
          Contact Channels
        </p>
        <div className="grid gap-2 md:grid-cols-2">
          <label className="block">
            <span className={LABEL_CLASS}>Email</span>
            <input
              type="text"
              value={form.Email}
              onChange={(event) => onChange({ ...form, Email: event.target.value })}
              className={`${FIELD_CLASS} font-mono`}
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>Direct Phone</span>
            <input
              type="text"
              value={form.Phone}
              onChange={(event) => onChange({ ...form, Phone: event.target.value })}
              className={`${FIELD_CLASS} font-mono`}
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>Mobile</span>
            <input
              type="text"
              value={form.Mobile}
              onChange={(event) => onChange({ ...form, Mobile: event.target.value })}
              className={`${FIELD_CLASS} font-mono`}
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>LinkedIn URL</span>
            <input
              type="text"
              value={form.LinkedInURL}
              onChange={(event) => onChange({ ...form, LinkedInURL: event.target.value })}
              className={FIELD_CLASS}
            />
          </label>
        </div>
      </section>

      <section className="border border-carbon-blue/10 bg-white p-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-carbon-blue/45">
          Buying Center Dynamics
        </p>
        <div className="grid gap-2 md:grid-cols-3">
          <label className="block">
            <span className={LABEL_CLASS}>Buying Role</span>
            <BuyingRoleSelect
              value={form.buyingRole}
              onChange={(buyingRole) => onChange({ ...form, buyingRole })}
              className={FIELD_CLASS}
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>Sentiment</span>
            <select
              value={form.sentiment ?? "Neutral"}
              onChange={(event) =>
                onChange({ ...form, sentiment: event.target.value as CreateContactInput["sentiment"] })
              }
              className={FIELD_CLASS}
            >
              {CONTACT_SENTIMENTS.map((sentiment) => (
                <option key={sentiment} value={sentiment}>
                  {sentiment === "Champion / Promoter"
                    ? "Champion / Promoter 🟢"
                    : sentiment === "Neutral"
                      ? "Neutral 🟡"
                      : "Detractor / Skeptic 🔴"}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>Influence Level</span>
            <select
              value={form.influenceLevel ?? "Medium"}
              onChange={(event) =>
                onChange({
                  ...form,
                  influenceLevel: event.target.value as CreateContactInput["influenceLevel"],
                })
              }
              className={FIELD_CLASS}
            >
              {INFLUENCE_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="border border-carbon-blue/10 bg-white p-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-carbon-blue/45">
          Location & Timezone
        </p>
        <label className="mb-3 block">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className={LABEL_CLASS}>Street Address</span>
            <button
              type="button"
              disabled={geoFilling}
              onClick={() => void handleAutoFillLocation()}
              className="rounded-md border border-carbon-blue/20 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-carbon-blue/70 transition-colors hover:border-upcycle-orange/30 hover:text-upcycle-orange disabled:cursor-not-allowed disabled:opacity-50"
            >
              {geoFilling ? "Filling…" : "Auto-Fill Location"}
            </button>
          </div>
          <textarea
            value={form.streetAddress ?? ""}
            onChange={(event) => onChange({ ...form, streetAddress: event.target.value })}
            rows={3}
            className={`${FIELD_CLASS} min-h-[72px] resize-y`}
          />
        </label>

        <label className="mb-2 flex items-center gap-2 text-[11px] text-carbon-blue/70">
          <input
            type="checkbox"
            checked={!form.isTimezoneOverridden}
            onChange={(event) => {
              const inherit = event.target.checked;
              if (!inherit) {
                onChange({ ...form, isTimezoneOverridden: true });
                return;
              }
              const country =
                (typeof selectedCompany?.Country === "string"
                  ? selectedCompany.Country.trim()
                  : selectedCompany?.Country?.Title?.trim()) ||
                form.country ||
                "";
              const city = selectedCompany?.City?.trim() || form.city || "";
              const geo = findCountryEntry(country);
              onChange({
                ...form,
                city,
                country: geo?.name || country,
                countryCode: geo?.code || form.countryCode || "",
                continent: geo?.continent || form.continent || "",
                timezone: inferTimezoneFromCountry(geo?.name || country),
                isTimezoneOverridden: false,
              });
            }}
          />
          Inherit timezone from company
        </label>

        <div className="grid gap-2 md:grid-cols-2">
          <CountryContinentFields
            country={form.country ?? ""}
            countryCode={form.countryCode ?? ""}
            continent={form.continent ?? ""}
            density="compact"
            sideBySide
            disabled={!form.isTimezoneOverridden}
            onChange={(next) =>
              onChange({
                ...form,
                country: next.country,
                countryCode: next.countryCode,
                continent: next.continent,
                timezone: next.country
                  ? inferTimezoneFromCountry(next.country)
                  : form.timezone,
                isTimezoneOverridden: true,
              })
            }
          />
        </div>

        <div className="mt-2 grid gap-2 md:grid-cols-3">
          <label className="block">
            <span className={LABEL_CLASS}>City</span>
            <input
              type="text"
              value={form.city ?? ""}
              onChange={(event) => onChange({ ...form, city: event.target.value })}
              disabled={!form.isTimezoneOverridden}
              className={FIELD_CLASS}
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>Timezone</span>
            <input
              type="text"
              value={form.timezone ?? ""}
              onChange={(event) =>
                onChange({
                  ...form,
                  timezone: event.target.value,
                  isTimezoneOverridden: true,
                })
              }
              disabled={!form.isTimezoneOverridden}
              className={FIELD_CLASS}
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>Postal code</span>
            <input
              type="text"
              value={form.postalCode ?? ""}
              onChange={(event) => onChange({ ...form, postalCode: event.target.value })}
              disabled={!form.isTimezoneOverridden}
              className={FIELD_CLASS}
            />
          </label>
        </div>

        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <label className="block">
            <span className={LABEL_CLASS}>State / region</span>
            <input
              type="text"
              value={form.stateRegion ?? ""}
              onChange={(event) => onChange({ ...form, stateRegion: event.target.value })}
              disabled={!form.isTimezoneOverridden}
              className={FIELD_CLASS}
            />
          </label>
        </div>

        {geoError ? (
          <p className="mt-2 text-[12px] font-medium text-red-700" role="alert">
            {geoError}
          </p>
        ) : null}
      </section>

      <section className="border border-carbon-blue/10 bg-white p-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-carbon-blue/45">
          Relationship & Cadence
        </p>
        <div className="grid gap-2 md:grid-cols-3">
          <label className="block">
            <span className={LABEL_CLASS}>Status</span>
            <select
              value={form.Status}
              onChange={(event) =>
                onChange({ ...form, Status: event.target.value as CreateContactInput["Status"] })
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
            <span className={LABEL_CLASS}>Relationship Level</span>
            <select
              value={form.RelationshipLevel}
              onChange={(event) =>
                onChange({
                  ...form,
                  RelationshipLevel: event.target.value as CreateContactInput["RelationshipLevel"],
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
            <span className={LABEL_CLASS}>Target Engagement Cadence</span>
            <select
              value={form.engagementCadence ?? "Monthly"}
              onChange={(event) =>
                onChange({
                  ...form,
                  engagementCadence: event.target.value as CreateContactInput["engagementCadence"],
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
            <span className={LABEL_CLASS}>Role</span>
            <ContactRoleSelect
              value={form.Role}
              onChange={(role) => onChange({ ...form, Role: role })}
              allowEmpty
              className={FIELD_CLASS}
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>Employment Status</span>
            <select
              value={form.EmploymentStatus ?? "Active"}
              onChange={(event) =>
                onChange({
                  ...form,
                  EmploymentStatus: event.target.value as CreateContactInput["EmploymentStatus"],
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
              onChange={(event) => onChange({ ...form, preferredLanguage: event.target.value })}
              className={FIELD_CLASS}
            />
          </label>
          <label className="block md:col-span-3">
            <span className={LABEL_CLASS}>Background & Personal Notes</span>
            <textarea
              value={form.backgroundNotes ?? ""}
              onChange={(event) => onChange({ ...form, backgroundNotes: event.target.value })}
              rows={4}
              className={`${FIELD_CLASS} min-h-[92px] resize-y`}
            />
          </label>
        </div>
      </section>
    </div>
  );
}

export function isContactFormValid(form: CreateContactInput): boolean {
  return Boolean(form.FirstName.trim() && form.LastName.trim() && form.Email.trim());
}
