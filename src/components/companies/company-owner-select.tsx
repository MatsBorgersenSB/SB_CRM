"use client";

import { buildCompanyOwnerOptions } from "@/lib/company-owner";
import type { Company, SharePointPerson } from "@/types/company";

const LABEL_CLASS =
  "text-[10px] font-bold uppercase tracking-[0.14em] text-carbon-blue/40";

const FIELD_CLASS =
  "mt-1 w-full border border-carbon-blue/15 bg-white px-2.5 py-2 text-[12px] text-carbon-blue outline-none focus:border-upcycle-orange";

export function CompanyOwnerSelect({
  value,
  onChange,
  companies,
  disabled = false,
  required = false,
  label = "Company Owner",
  compact = false,
}: {
  value: SharePointPerson | null;
  onChange: (owner: SharePointPerson) => void;
  companies: Company[];
  disabled?: boolean;
  required?: boolean;
  label?: string;
  compact?: boolean;
}) {
  const options = buildCompanyOwnerOptions(companies, value);

  return (
    <label className={compact ? "block min-w-[200px]" : "block"}>
      <span className={LABEL_CLASS}>{label}</span>
      <select
        value={value?.Id ?? ""}
        disabled={disabled}
        required={required}
        onChange={(event) => {
          const selected = options.find((owner) => owner.Id === Number(event.target.value));
          if (selected) onChange(selected);
        }}
        className={FIELD_CLASS}
        aria-label={label}
      >
        {!value ? <option value="">Select company owner</option> : null}
        {options.map((owner) => (
          <option key={owner.Id} value={owner.Id}>
            {owner.Title}
          </option>
        ))}
      </select>
    </label>
  );
}
