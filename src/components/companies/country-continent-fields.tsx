"use client";

import { useId } from "react";
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

const CONTINENT_OPTIONS: Exclude<Continent, "">[] = [
  "Africa",
  "Asia",
  "Europe",
  "North America",
  "South America",
  "Oceania",
  "Antarctica",
];

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
 * Country field: pick from catalog or type a new country.
 * Continent is derived for catalog countries; editable for custom ones.
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
  const listId = useId();
  const options = listCountries();
  const matched =
    findCountryEntry(countryCode || country) ??
    (countryCode ? findCountryEntry(countryCode) : null);
  const isCustom = Boolean(country.trim()) && !matched;

  const displayCountry = matched?.name ?? country;
  const displayContinent = matched?.continent || continent || "";

  const labelClass = density === "comfortable" ? LABEL_COMFORTABLE : LABEL_COMPACT;
  const fieldClass = density === "comfortable" ? FIELD_COMFORTABLE : FIELD_COMPACT;

  const shellClass = sideBySide ? "contents" : "grid gap-2 sm:grid-cols-2";

  const applyCountryInput = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      onChange({ country: "", countryCode: "", continent: "" });
      return;
    }

    const entry = findCountryEntry(trimmed);
    if (entry) {
      onChange({
        country: entry.name,
        countryCode: entry.code,
        continent: entry.continent,
      });
      return;
    }

    onChange({
      country: raw,
      countryCode: "",
      continent: continent || "",
    });
  };

  return (
    <div className={shellClass}>
      <label className="block">
        <span className={labelClass}>Country</span>
        <input
          type="text"
          list={listId}
          value={displayCountry}
          disabled={disabled}
          onChange={(event) => applyCountryInput(event.target.value)}
          onBlur={(event) => {
            const entry = findCountryEntry(event.target.value);
            if (entry) {
              onChange({
                country: entry.name,
                countryCode: entry.code,
                continent: entry.continent,
              });
            } else if (event.target.value.trim()) {
              onChange({
                country: event.target.value.trim(),
                countryCode: "",
                continent: continent || "",
              });
            }
          }}
          placeholder="Type or select country…"
          className={fieldClass}
          aria-label="Country"
          autoComplete="country-name"
        />
        <datalist id={listId}>
          {options.map((entry) => (
            <option key={entry.code} value={entry.name} />
          ))}
        </datalist>
        {isCustom ? (
          <p className="mt-1 text-[10px] text-carbon-blue/45">
            Custom country — not in the standard list. Continent can be set manually.
          </p>
        ) : null}
      </label>

      <label className="block">
        <span className={labelClass}>Continent</span>
        {matched ? (
          <input
            type="text"
            value={displayContinent}
            disabled
            readOnly
            className={`${fieldClass} bg-carbon-blue/[0.03] text-carbon-blue/70 disabled:opacity-100`}
            aria-label="Continent (from country)"
            title="Set automatically from country"
          />
        ) : (
          <select
            value={displayContinent}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                country: displayCountry.trim(),
                countryCode: "",
                continent: event.target.value,
              })
            }
            className={fieldClass}
            aria-label="Continent"
          >
            <option value="">Select continent…</option>
            {CONTINENT_OPTIONS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
      </label>
    </div>
  );
}
