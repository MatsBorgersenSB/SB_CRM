"use client";

import {
  BUYING_CENTER_CUSTOM_ROLE_VALUE,
  BUYING_CENTER_ROLE_PRESETS,
  buildOpportunityStakeholderRoleOptions,
  isBuyingCenterPresetRole,
  normalizeStakeholderRole,
} from "@/lib/opportunity-stakeholder-utils";

type StakeholderRoleSelectProps = {
  /** Persisted role string (preset or custom title). */
  value: string;
  /** Extra roles already on the roster / offerings — merged into the list. */
  extraRoles?: string[];
  onChange: (role: string) => void;
  disabled?: boolean;
  id?: string;
  label?: string;
  className?: string;
};

/**
 * Buying Center role selector — standard presets + “+ Custom Role” free text.
 * Always emits a plain string suitable for `projectRole` persistence.
 */
export function StakeholderRoleSelect({
  value,
  extraRoles = [],
  onChange,
  disabled = false,
  id,
  label = "Stakeholder role",
  className = "",
}: StakeholderRoleSelectProps) {
  const trimmed = normalizeStakeholderRole(value);
  const options = buildOpportunityStakeholderRoleOptions(extraRoles);
  const knownOption = trimmed.length > 0 && options.includes(trimmed);
  const selectValue = knownOption
    ? trimmed
    : trimmed.length > 0
      ? BUYING_CENTER_CUSTOM_ROLE_VALUE
      : "";
  const showCustomInput = selectValue === BUYING_CENTER_CUSTOM_ROLE_VALUE;
  const customInputValue = showCustomInput && !knownOption ? trimmed : "";

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label ? (
        <label
          htmlFor={id}
          className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45"
        >
          {label}
        </label>
      ) : null}
      <select
        id={id}
        value={selectValue}
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.value;
          if (next === BUYING_CENTER_CUSTOM_ROLE_VALUE) {
            onChange(knownOption ? "" : trimmed);
            return;
          }
          onChange(next);
        }}
        className="w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40 disabled:opacity-50"
      >
        <option value="" disabled>
          Select role…
        </option>
        <optgroup label="Buying Center">
          {BUYING_CENTER_ROLE_PRESETS.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </optgroup>
        {options.filter((role) => !isBuyingCenterPresetRole(role)).length > 0 ? (
          <optgroup label="Also used">
            {options
              .filter((role) => !isBuyingCenterPresetRole(role))
              .map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
          </optgroup>
        ) : null}
        <option value={BUYING_CENTER_CUSTOM_ROLE_VALUE}>+ Custom Role</option>
      </select>

      {showCustomInput ? (
        <input
          type="text"
          value={customInputValue}
          disabled={disabled}
          onChange={(event) => onChange(normalizeStakeholderRole(event.target.value))}
          placeholder="e.g. Legal Approver, Security Officer"
          className="w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40 disabled:opacity-50"
          aria-label="Custom stakeholder role"
          autoFocus
        />
      ) : null}
    </div>
  );
}

/** Contact badge for opportunity / buying-center roles (presets + custom strings). */
export function StakeholderRoleBadge({
  role,
  className = "",
}: {
  role: string;
  className?: string;
}) {
  const label = normalizeStakeholderRole(role);
  if (!label) return null;

  const isPreset = isBuyingCenterPresetRole(label);

  return (
    <span
      title={label}
      className={`inline-flex max-w-full items-center truncate border px-2 py-0.5 text-[10px] font-semibold ${
        isPreset
          ? "border-upcycle-orange/30 bg-upcycle-orange/10 uppercase tracking-wider text-upcycle-orange"
          : "border-carbon-blue/15 bg-carbon-blue/[0.04] normal-case tracking-normal text-carbon-blue/80"
      } ${className}`}
    >
      {label}
    </span>
  );
}
