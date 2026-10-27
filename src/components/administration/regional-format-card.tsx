"use client";

import { useSyncExternalStore } from "react";
import {
  DATE_FORMAT_OPTIONS,
  DEFAULT_DATE_FORMAT,
  DEFAULT_TIME_FORMAT,
  TIME_FORMAT_OPTIONS,
  formatDateWith,
  formatTimeWith,
  readStoredDateFormat,
  readStoredTimeFormat,
  subscribeRegionalFormat,
  writeStoredDateFormat,
  writeStoredTimeFormat,
  type DateFormatPreference,
  type TimeFormatPreference,
} from "@/lib/regional-format-preference";

// A fixed sample keeps the preview unambiguous (day 27 can't be read as a month).
const SAMPLE = new Date(2026, 9, 27, 15, 45);

function OptionGroup<T extends string>({
  step,
  legend,
  options,
  value,
  onChange,
  preview,
}: {
  step: number;
  legend: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  preview: (value: T) => string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-[12px] font-semibold uppercase tracking-wider text-carbon-blue/60">
        {step}. {legend}
      </legend>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <label
            key={option.value}
            className={`flex cursor-pointer items-center justify-between gap-3 border px-3 py-2 text-sm transition-colors ${
              selected
                ? "border-upcycle-orange bg-upcycle-orange/5"
                : "border-carbon-blue/10 hover:bg-carbon-blue/[0.02]"
            }`}
          >
            <span className="flex items-center gap-2 text-carbon-blue">
              <input
                type="radio"
                name={legend}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="accent-upcycle-orange"
              />
              {option.label}
            </span>
            <span className="font-mono text-[12px] text-carbon-blue/60">{preview(option.value)}</span>
          </label>
        );
      })}
    </fieldset>
  );
}

export function RegionalFormatCard() {
  const dateFormat = useSyncExternalStore(
    subscribeRegionalFormat,
    readStoredDateFormat,
    () => DEFAULT_DATE_FORMAT,
  );
  const timeFormat = useSyncExternalStore(
    subscribeRegionalFormat,
    readStoredTimeFormat,
    () => DEFAULT_TIME_FORMAT,
  );

  return (
    <div className="space-y-5">
      <OptionGroup<DateFormatPreference>
        step={1}
        legend="Select date format"
        options={DATE_FORMAT_OPTIONS}
        value={dateFormat}
        onChange={writeStoredDateFormat}
        preview={(v) => formatDateWith(SAMPLE, v)}
      />
      <OptionGroup<TimeFormatPreference>
        step={2}
        legend="Select time format"
        options={TIME_FORMAT_OPTIONS}
        value={timeFormat}
        onChange={writeStoredTimeFormat}
        preview={(v) => formatTimeWith(SAMPLE, v)}
      />
      <p className="text-sm text-carbon-blue/55">
        Dates and times will appear as{" "}
        <span className="font-medium text-carbon-blue">
          {formatDateWith(SAMPLE, dateFormat)}, {formatTimeWith(SAMPLE, timeFormat)}
        </span>
        .
      </p>
    </div>
  );
}
