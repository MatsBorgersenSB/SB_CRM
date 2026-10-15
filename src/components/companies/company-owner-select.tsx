"use client";

import { buildCompanyOwnerOptions } from "@/lib/company-owner";
import { mergeStandardBioUserOptions } from "@/lib/standard-bio-users";
import type { Company, SharePointPerson } from "@/types/company";
import type { StandardBioUserRecord } from "@/types/user-access";

const LABEL_CLASS =
  "text-[11px] font-bold uppercase tracking-[0.14em] text-carbon-blue/60";

const FIELD_CLASS =
  "mt-1 w-full border border-carbon-blue/15 bg-white px-2.5 py-2 text-[13px] text-carbon-blue outline-none focus:border-upcycle-orange";

const INLINE_CLASS =
  "max-w-[12.5rem] cursor-pointer border-0 bg-transparent py-0 pl-0 pr-5 text-[13px] font-medium text-carbon-blue outline-none focus:text-upcycle-orange disabled:cursor-wait disabled:opacity-60";

export function CompanyOwnerSelect({
  value,
  onChange,
  companies,
  assignableUsers = [],
  extraUsers = [],
  disabled = false,
  required = false,
  label = "Account Owner",
  compact = false,
  appearance = "field",
}: {
  value: SharePointPerson | null;
  onChange: (owner: SharePointPerson) => void;
  companies: Company[];
  assignableUsers?: StandardBioUserRecord[];
  extraUsers?: SharePointPerson[];
  disabled?: boolean;
  required?: boolean;
  label?: string;
  compact?: boolean;
  appearance?: "field" | "inline";
}) {
  const options = buildCompanyOwnerOptions(
    companies,
    value,
    mergeStandardBioUserOptions(assignableUsers, extraUsers),
  );

  const select = (
    <select
      value={value?.Id ?? ""}
      disabled={disabled}
      required={required}
      aria-label={label}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => {
        const selected = options.find((owner) => owner.Id === Number(event.target.value));
        if (selected) onChange(selected);
      }}
      className={appearance === "inline" ? INLINE_CLASS : compact ? `${FIELD_CLASS} mt-0 py-1 text-[12px]` : FIELD_CLASS}
    >
      {!value ? (
        <option value="">
          {appearance === "inline" ? "Assign…" : `Select ${label.toLowerCase()}`}
        </option>
      ) : null}
      {options.map((owner) => (
        <option key={owner.Id} value={owner.Id}>
          {owner.Title}
        </option>
      ))}
    </select>
  );

  if (appearance === "inline") {
    return select;
  }

  return (
    <label className={compact ? "block min-w-[200px]" : "block"}>
      <span className={compact ? "sr-only" : LABEL_CLASS}>
        {label}
        {required ? <span className="text-thermal-red"> *</span> : null}
      </span>
      {select}
    </label>
  );
}
