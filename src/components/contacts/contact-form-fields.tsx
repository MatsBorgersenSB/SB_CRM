"use client";

import type { CreateContactInput } from "@/types/contact";
import {
  CONTACT_LIST_ROLES,
  CONTACT_STATUSES,
  RELATIONSHIP_LEVELS,
} from "@/types/contact";
import { EMPLOYMENT_STATUSES } from "@/types/contact-lifecycle";

export const emptyContactForm = (): CreateContactInput => ({
  FirstName: "",
  LastName: "",
  JobTitle: "",
  Role: "Plant Manager",
  Email: "",
  Phone: "",
  Mobile: "",
  LinkedInURL: "",
  Status: "Active",
  RelationshipLevel: "Operational",
  EmploymentStatus: "Active",
  Company: { Id: 0, Title: "" },
});

type ContactFormFieldsProps = {
  form: CreateContactInput;
  onChange: (next: CreateContactInput) => void;
  showCompanySelect?: boolean;
  companies?: { CompanyID: string; Title: string }[];
  companyId?: string;
  onCompanyChange?: (companyId: string) => void;
  jobTitleLabel?: string;
};

export function ContactFormFields({
  form,
  onChange,
  showCompanySelect = false,
  companies = [],
  companyId = "",
  onCompanyChange,
  jobTitleLabel = "Job Title",
}: ContactFormFieldsProps) {
  return (
    <>
      {showCompanySelect ? (
        <label className="block">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Company
          </span>
          <select
            value={companyId}
            onChange={(event) => onCompanyChange?.(event.target.value)}
            className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1 text-xs text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
          >
            {companies.map((company) => (
              <option key={company.CompanyID} value={company.CompanyID}>
                {company.Title} ({company.CompanyID})
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            First Name
          </span>
          <input
            type="text"
            value={form.FirstName}
            onChange={(event) =>
              onChange({ ...form, FirstName: event.target.value })
            }
            className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1 text-xs text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
          />
        </label>
        <label className="block">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Last Name
          </span>
          <input
            type="text"
            value={form.LastName}
            onChange={(event) =>
              onChange({ ...form, LastName: event.target.value })
            }
            className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1 text-xs text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          {jobTitleLabel}
        </span>
        <input
          type="text"
          value={form.JobTitle}
          onChange={(event) =>
            onChange({ ...form, JobTitle: event.target.value })
          }
          className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1 text-xs text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
        />
      </label>
      <label className="block">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          Role
        </span>
        <select
          value={form.Role}
          onChange={(event) =>
            onChange({
              ...form,
              Role: event.target.value as CreateContactInput["Role"],
            })
          }
          className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1 text-xs text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
        >
          {CONTACT_LIST_ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          Email
        </span>
        <input
          type="text"
          value={form.Email}
          onChange={(event) => onChange({ ...form, Email: event.target.value })}
          className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1 font-mono text-xs text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
        />
      </label>
      <label className="block">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          Phone
        </span>
        <input
          type="text"
          value={form.Phone}
          onChange={(event) => onChange({ ...form, Phone: event.target.value })}
          className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1 font-mono text-xs text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
        />
      </label>
      <label className="block">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          Mobile
        </span>
        <input
          type="text"
          value={form.Mobile}
          onChange={(event) => onChange({ ...form, Mobile: event.target.value })}
          className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1 font-mono text-xs text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
        />
      </label>
      <label className="block">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          LinkedIn URL
        </span>
        <input
          type="text"
          value={form.LinkedInURL}
          onChange={(event) =>
            onChange({ ...form, LinkedInURL: event.target.value })
          }
          className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1 font-mono text-xs text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Status
          </span>
          <select
            value={form.Status}
            onChange={(event) =>
              onChange({
                ...form,
                Status: event.target.value as CreateContactInput["Status"],
              })
            }
            className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1 text-xs text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
          >
            {CONTACT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Relationship Level
          </span>
          <select
            value={form.RelationshipLevel}
            onChange={(event) =>
              onChange({
                ...form,
                RelationshipLevel: event.target
                  .value as CreateContactInput["RelationshipLevel"],
              })
            }
            className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1 text-xs text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
          >
            {RELATIONSHIP_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          Employment Status
        </span>
        <select
          value={form.EmploymentStatus ?? "Active"}
          onChange={(event) =>
            onChange({
              ...form,
              EmploymentStatus: event.target.value as CreateContactInput["EmploymentStatus"],
            })
          }
          className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1 text-xs text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
        >
          {EMPLOYMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

export function isContactFormValid(form: CreateContactInput): boolean {
  return Boolean(form.FirstName.trim() && form.LastName.trim() && form.Email.trim());
}
