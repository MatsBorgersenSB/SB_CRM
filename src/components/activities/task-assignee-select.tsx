"use client";

import type { SharePointPerson } from "@/types/company";
import { findStandardBioUserOption } from "@/lib/standard-bio-users";

const LABEL_CLASS =
  "text-[10px] font-bold uppercase tracking-[0.14em] text-carbon-blue/40";

const FIELD_CLASS =
  "mt-1 w-full border border-carbon-blue/15 bg-white px-2.5 py-2 text-[12px] text-carbon-blue outline-none focus:border-upcycle-orange";

/**
 * Assign a task to a Standard Bio / SmartCRM user (ActivityOwner).
 */
export function TaskAssigneeSelect({
  value,
  onChange,
  options,
  disabled = false,
  required = false,
  label = "Assign to",
  compact = false,
}: {
  value: SharePointPerson | null;
  onChange: (assignee: SharePointPerson) => void;
  options: SharePointPerson[];
  disabled?: boolean;
  required?: boolean;
  label?: string;
  compact?: boolean;
}) {
  return (
    <label className={compact ? "block min-w-[160px]" : "block"}>
      <span className={compact ? "sr-only" : LABEL_CLASS}>
        {label}
        {required ? <span className="text-thermal-red"> *</span> : null}
      </span>
      <select
        value={value?.Id ?? ""}
        disabled={disabled || options.length === 0}
        required={required}
        aria-label={label}
        onChange={(event) => {
          const next = findStandardBioUserOption(options, Number(event.target.value));
          if (next) onChange(next);
        }}
        className={compact ? `${FIELD_CLASS} mt-0 py-1 text-[11px]` : FIELD_CLASS}
      >
        <option value="" disabled>
          {options.length === 0 ? "No assignable users" : "Select assignee…"}
        </option>
        {options.map((option) => (
          <option key={option.Id} value={option.Id}>
            {option.Title}
          </option>
        ))}
      </select>
    </label>
  );
}
