"use client";

import {
  currencyLabel,
  DEFAULT_OPPORTUNITY_CURRENCY,
  formatMoneyInput,
  listCurrenciesForSelect,
} from "@/lib/geo/currencies";
import type { PipelineCurrency } from "@/types/pipeline";

const CURRENCY_OPTIONS = listCurrenciesForSelect();

const FIELD_CLASS =
  "mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40";

export function OpportunityValueFields({
  salesValue,
  currency,
  onSalesValueChange,
  onCurrencyChange,
  disabled = false,
  valueLabel = "Estimated Value",
  optional = true,
}: {
  salesValue: string;
  currency: PipelineCurrency;
  onSalesValueChange: (value: string) => void;
  onCurrencyChange: (currency: PipelineCurrency) => void;
  disabled?: boolean;
  valueLabel?: string;
  optional?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <label className="block min-w-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
          {valueLabel}
          {optional ? (
            <span className="font-medium normal-case"> (optional)</span>
          ) : null}
        </span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          value={salesValue}
          onChange={(event) => onSalesValueChange(formatMoneyInput(event.target.value))}
          placeholder="e.g. 2,500,000"
          className={FIELD_CLASS}
          aria-label={valueLabel}
        />
      </label>
      <label className="block min-w-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
          Currency
        </span>
        <select
          value={currency || DEFAULT_OPPORTUNITY_CURRENCY}
          disabled={disabled}
          onChange={(event) =>
            onCurrencyChange(event.target.value as PipelineCurrency)
          }
          className={FIELD_CLASS}
          aria-label="Currency"
        >
          {CURRENCY_OPTIONS.map((option) => (
            <option key={option.code} value={option.code}>
              {currencyLabel(option)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
