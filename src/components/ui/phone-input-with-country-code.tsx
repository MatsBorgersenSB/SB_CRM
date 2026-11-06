"use client";

import { useMemo, useRef } from "react";
import { listCountries } from "@/lib/geo/country-continent";
import {
  isBareDialCode,
  normalizePhoneNumber,
} from "@/lib/m365/phone-normalization";

type PhoneInputWithCountryCodeProps = {
  value: string;
  onChange: (next: string) => void;
  defaultDialCode?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

const PRIORITY_ISO = ["NO", "SE", "DK", "FI", "IS", "DE", "GB", "NL", "FR", "US"];

function extractLeadingDialCode(raw: string): string | null {
  const match = raw.trim().match(/^(\+\d{1,4})\b/);
  return match?.[1] ?? null;
}

function replaceLeadingDialCode(raw: string, nextDialCode: string): string {
  const trimmed = raw.trim();
  const dial = nextDialCode.trim() || "+47";
  if (!trimmed || isBareDialCode(trimmed)) {
    return `${dial} `;
  }
  if (trimmed.startsWith("+")) {
    const rest = trimmed.replace(/^\+\d{1,4}\s*/, "").trim();
    return rest ? `${dial} ${rest}` : `${dial} `;
  }
  return `${dial} ${trimmed}`;
}

export function PhoneInputWithCountryCode({
  value,
  onChange,
  defaultDialCode = "+47",
  disabled = false,
  placeholder,
  className = "",
}: PhoneInputWithCountryCodeProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resolvedDefaultDial = defaultDialCode.trim().startsWith("+")
    ? defaultDialCode.trim()
    : "+47";

  const dialOptions = useMemo(() => {
    const all = listCountries();
    const byCode = new Map(all.map((c) => [c.code, c]));
    const priority = PRIORITY_ISO.map((iso) => byCode.get(iso)).filter(
      (entry): entry is NonNullable<typeof entry> => Boolean(entry),
    );
    const prioritySet = new Set(PRIORITY_ISO);
    const rest = all.filter((entry) => !prioritySet.has(entry.code));
    return [...priority, ...rest];
  }, []);

  const activeDialCode =
    extractLeadingDialCode(value) ?? resolvedDefaultDial;

  const handleFocus = () => {
    if (disabled) return;
    if (!value.trim()) {
      const prefill = `${resolvedDefaultDial} `;
      onChange(prefill);
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (el) {
          el.setSelectionRange(prefill.length, prefill.length);
        }
      });
    }
  };

  const handleChange = (rawNext: string) => {
    if (!rawNext.trim()) {
      onChange("");
      return;
    }

    const prevWasEmpty = !value.trim();
    if (prevWasEmpty && !rawNext.trim().startsWith("+")) {
      const cleaned = rawNext.trim().replace(/^00(?=\d{2,})/, "+");
      if (cleaned.startsWith("+")) {
        onChange(cleaned);
        return;
      }
      onChange(`${resolvedDefaultDial} ${cleaned}`);
      return;
    }

    onChange(rawNext);
  };

  const handleBlur = () => {
    if (isBareDialCode(value)) {
      onChange("");
      return;
    }
    if (value.trim()) {
      onChange(normalizePhoneNumber(value));
    }
  };

  const handleDialSelect = (nextDial: string) => {
    const updated = replaceLeadingDialCode(value, nextDial);
    onChange(updated);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(updated.length, updated.length);
      }
    });
  };

  return (
    <div className="mt-0.5 flex items-stretch gap-1">
      <select
        aria-label="Country calling code"
        value={activeDialCode}
        disabled={disabled}
        onChange={(event) => handleDialSelect(event.target.value)}
        className="w-[82px] shrink-0 border border-carbon-blue/15 bg-carbon-blue/[0.02] px-1.5 py-1 font-mono text-xs text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40 disabled:opacity-50"
        title="Select country code (or edit directly in the phone field)"
      >
        {!dialOptions.some((opt) => opt.dialCode === activeDialCode) ? (
          <option value={activeDialCode}>{activeDialCode}</option>
        ) : null}
        {dialOptions.map((option) => (
          <option key={`${option.code}-${option.dialCode}`} value={option.dialCode}>
            {option.dialCode} {option.code}
          </option>
        ))}
      </select>
      <input
        ref={inputRef}
        type="tel"
        value={value}
        disabled={disabled}
        placeholder={placeholder ?? `${resolvedDefaultDial} 900 00 000`}
        onFocus={handleFocus}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={handleBlur}
        className={`${className} mt-0 flex-1 font-mono`}
      />
    </div>
  );
}
