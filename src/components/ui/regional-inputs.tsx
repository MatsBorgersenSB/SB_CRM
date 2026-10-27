"use client";

import { CalendarDays } from "lucide-react";
import { useRef, useState } from "react";
import {
  datePlaceholder,
  isoDateToDisplay,
  isoTimeToDisplay,
  parseDateInput,
  parseTimeInput,
  timePlaceholder,
} from "@/lib/regional-format-preference";

type BaseProps = {
  /** ISO value: "yyyy-mm-dd" or "HH:mm". Empty string = no value. */
  value: string;
  onValueChange: (iso: string) => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  "aria-label"?: string;
};

/**
 * Text field that shows/accepts dates in the user's chosen format
 * (Administration → Date & time format). The value stays ISO.
 */
export function RegionalDateInput({
  value,
  onValueChange,
  className,
  disabled,
  required,
  min,
  "aria-label": ariaLabel,
}: BaseProps & { min?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    if (draft === null) return;
    const text = draft.trim();
    if (!text) {
      onValueChange("");
    } else {
      const iso = parseDateInput(text);
      if (iso) onValueChange(iso);
    }
    setDraft(null);
  };

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={draft ?? isoDateToDisplay(value)}
        placeholder={datePlaceholder()}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        className={`${className ?? ""} pr-8`}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label="Open calendar"
        onClick={() => pickerRef.current?.showPicker?.()}
        className="absolute inset-y-0 right-1.5 flex items-center text-carbon-blue/50 hover:text-carbon-blue"
      >
        <CalendarDays className="size-3.5" strokeWidth={1.75} />
      </button>
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        min={min}
        value={value}
        onChange={(e) => {
          setDraft(null);
          onValueChange(e.target.value);
        }}
        className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
      />
    </div>
  );
}

/** Time field honouring 24-hour / 12-hour preference. Value stays "HH:mm". */
export function RegionalTimeInput({
  value,
  onValueChange,
  className,
  disabled,
  required,
  "aria-label": ariaLabel,
}: BaseProps) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const text = draft.trim();
    if (!text) {
      onValueChange("");
    } else {
      const hhmm = parseTimeInput(text);
      if (hhmm) onValueChange(hhmm);
    }
    setDraft(null);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={draft ?? isoTimeToDisplay(value)}
      placeholder={timePlaceholder()}
      disabled={disabled}
      required={required}
      aria-label={ariaLabel}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
      }}
      className={className}
    />
  );
}
