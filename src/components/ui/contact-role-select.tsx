/**
 * Contact Role field — presets plus “Add new role…”.
 * Reality First: free text is allowed; presets are suggestions only.
 */

"use client";

import { useState } from "react";
import {
  CONTACT_LIST_ROLES,
  normalizeContactListRole,
} from "@/types/contact";

const ADD_NEW_VALUE = "__add_new_contact_role__";

export function ContactRoleSelect({
  value,
  onChange,
  disabled,
  className,
  id,
  allowEmpty = false,
  emptyLabel = "Select role…",
  extraOptions = [],
}: {
  value: string;
  onChange: (role: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  /** Extra roles already used in data (custom roles). */
  extraOptions?: string[];
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const normalized = normalizeContactListRole(value);
  const options = [
    ...CONTACT_LIST_ROLES,
    ...extraOptions
      .map((item) => normalizeContactListRole(item))
      .filter(
        (item) =>
          item.length > 0 &&
          !CONTACT_LIST_ROLES.some(
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
          placeholder="e.g. Site Manager, HSE Lead…"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              const next = normalizeContactListRole(draft);
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
            disabled={disabled || !normalizeContactListRole(draft)}
            onClick={() => {
              const next = normalizeContactListRole(draft);
              if (!next) return;
              onChange(next);
              setAdding(false);
              setDraft("");
            }}
            className="text-[10px] font-semibold uppercase tracking-wider text-upcycle-orange disabled:opacity-50"
          >
            Save role
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
      value={normalized}
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
      {uniqueOptions.map((role) => (
        <option key={role} value={role}>
          {role}
        </option>
      ))}
      <option value={ADD_NEW_VALUE}>Add new role…</option>
    </select>
  );
}
