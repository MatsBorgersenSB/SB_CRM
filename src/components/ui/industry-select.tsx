/**
 * Industry sector field — presets plus “Add new industry…”.
 * Reality First: free text is allowed; presets are suggestions only.
 */

"use client";

import { useState } from "react";
import {
  COMPANY_INDUSTRIES,
  normalizeCompanyIndustry,
} from "@/types/company";

const ADD_NEW_VALUE = "__add_new_industry__";

export function IndustrySelect({
  value,
  onChange,
  disabled,
  className,
  id,
  allowEmpty = false,
  emptyLabel = "Select industry…",
  extraOptions = [],
}: {
  value: string;
  onChange: (industry: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  /** Extra sectors already used in data (custom industries). */
  extraOptions?: string[];
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const normalized = normalizeCompanyIndustry(value);
  const options = [
    ...COMPANY_INDUSTRIES,
    ...extraOptions
      .map((item) => normalizeCompanyIndustry(item))
      .filter(
        (item) =>
          item.length > 0 &&
          !COMPANY_INDUSTRIES.some(
            (preset) => preset.toLowerCase() === item.toLowerCase(),
          ),
      ),
  ];
  const uniqueOptions = [...new Set(options)];
  const known =
    !normalized ||
    uniqueOptions.some((item) => item.toLowerCase() === normalized.toLowerCase());

  if (adding) {
    return (
      <div className="flex flex-col gap-1.5">
        <input
          id={id}
          type="text"
          value={draft}
          disabled={disabled}
          autoFocus
          placeholder="e.g. IT Services, Pulp & Paper…"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              const next = normalizeCompanyIndustry(draft);
              if (!next) return;
              onChange(next);
              setAdding(false);
              setDraft("");
            }
            if (event.key === "Escape") {
              setAdding(false);
              setDraft("");
            }
          }}
          className={className}
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={disabled || !normalizeCompanyIndustry(draft)}
            onClick={() => {
              const next = normalizeCompanyIndustry(draft);
              if (!next) return;
              onChange(next);
              setAdding(false);
              setDraft("");
            }}
            className="text-[10px] font-semibold uppercase tracking-wider text-upcycle-orange disabled:opacity-50"
          >
            Save industry
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setAdding(false);
              setDraft("");
            }}
            className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <select
      id={id}
      value={known ? normalized : normalized}
      disabled={disabled}
      onChange={(event) => {
        const next = event.target.value;
        if (next === ADD_NEW_VALUE) {
          setDraft(normalized && !known ? normalized : "");
          setAdding(true);
          return;
        }
        onChange(next);
      }}
      className={className}
    >
      {allowEmpty ? <option value="">{emptyLabel}</option> : null}
      {!known && normalized ? (
        <option value={normalized}>{normalized}</option>
      ) : null}
      {uniqueOptions.map((industry) => (
        <option key={industry} value={industry}>
          {industry}
        </option>
      ))}
      <option value={ADD_NEW_VALUE}>Add new industry…</option>
    </select>
  );
}
