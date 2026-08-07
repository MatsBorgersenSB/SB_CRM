"use client";

import {
  findCountryEntry,
  listCountries,
  type Continent,
} from "@/lib/geo/country-continent";

const LABEL_COMPACT =
  "text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40";
const LABEL_COMFORTABLE =
  "text-[10px] font-bold uppercase tracking-[0.14em] text-upcycle-orange/80";

const FIELD_COMPACT =
  "mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1 text-xs text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40";
const FIELD_COMFORTABLE =
  "mt-1 w-full rounded-md border-2 border-upcycle-orange/25 bg-white px-3 py-2 text-[13px] text-carbon-blue outline-none transition-colors focus:border-upcycle-orange focus:ring-2 focus:ring-upcycle-orange/20";

export type CountrySelection = {
  country: string;
  countryCode: string;
  continent: Continent | string;
};

type CountryContinentFieldsProps = {
  country: string;
  countryCode?: string;
  continent: string;
  onChange: (next: CountrySelection) => void;
  disabled?: boolean;
  density?: "compact" | "comfortable";
  /** When true, wraps in a 2-column grid for Country | Continent. */
  sideBySide?: boolean;
};

/**
 * Country dropdown from the canonical catalog; continent is derived and read-only.
 */
export function CountryContinentFields({
  country,
  countryCode = "",
  continent,
  onChange,
  disabled = false,
  density = "compact",
  sideBySide = true,
}: CountryContinentFieldsProps) {
  const options = listCountries();
  const matched =
    findCountryEntry(countryCode || country) ??
    (countryCode ? findCountryEntry(countryCode) : null);

  const selectValue = matched?.code ?? "";
  const displayContinent = matched?.continent || continent || "";

  const labelClass = density === "comfortable" ? LABEL_COMFORTABLE : LABEL_COMPACT;
  const fieldClass = density === "comfortable" ? FIELD_COMFORTABLE : FIELD_COMPACT;

  const shellClass = sideBySide
    ? "contents"
    : "grid gap-2 sm:grid-cols-2";

  return (
    <div className={shellClass}>
      <label className="block">
        <span className={labelClass}>Country</span>
        <select
          value={selectValue}
          disabled={disabled}
          onChange={(event) => {
            const code = event.target.value;
            if (!code) {
              onChange({ country: "", countryCode: "", continent: "" });
              return;
            }
            const entry = options.find((row) => row.code === code);
            if (!entry) return;
            onChange({
              country: entry.name,
              countryCode: entry.code,
              continent: entry.continent,
            });
          }}
          className={fieldClass}
          aria-label="Country"
        >
          <option value="">Select country…</option>
          {options.map((entry) => (
            <option key={entry.code} value={entry.code}>
              {entry.name}
            </option>
          ))}
        </select>
        {!matched && country.trim() ? (
          <p className="mt-1 text-[10px] text-carbon-blue/45">
            Current value “{country}” is not in the catalog — pick a country to standardize.
          </p>
        ) : null}
      </label>

      <label className="block">
        <span className={labelClass}>Continent</span>
        <input
          type="text"
          value={displayContinent}
          disabled
          readOnly
          className={`${fieldClass} bg-carbon-blue/[0.03] text-carbon-blue/70 disabled:opacity-100`}
          aria-label="Continent (from country)"
          title="Set automatically from country"
        />
      </label>
    </div>
  );
}
