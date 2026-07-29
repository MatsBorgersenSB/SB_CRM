"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import type { CompanyType } from "@/types/company-type";
import {
  COMPANY_TYPE_SELECT_OPTIONS,
  canonicalizeCompanyType,
  getCompanyTypeMeta,
} from "@/types/company-type";

type CompanyTypeMultiSelectProps = {
  value: CompanyType[];
  onChange: (types: CompanyType[]) => void;
  options?: CompanyType[];
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  required?: boolean;
  /** Visual density for create vs edit forms */
  density?: "compact" | "comfortable";
};

export function CompanyTypeMultiSelect({
  value,
  onChange,
  options = COMPANY_TYPE_SELECT_OPTIONS,
  disabled = false,
  label = "Company Type",
  placeholder = "Select company types…",
  required = false,
  density = "comfortable",
}: CompanyTypeMultiSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(() => {
    const next: CompanyType[] = [];
    for (const entry of value) {
      const canonical = canonicalizeCompanyType(entry) ?? entry;
      if (!next.includes(canonical)) next.push(canonical);
    }
    return next;
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((type) => {
      const meta = getCompanyTypeMeta(type);
      return (
        meta.label.toLowerCase().includes(q) ||
        meta.plural.toLowerCase().includes(q) ||
        type.toLowerCase().includes(q)
      );
    });
  }, [options, query]);

  const toggle = (type: CompanyType) => {
    const canonical = canonicalizeCompanyType(type) ?? type;
    if (selected.includes(canonical)) {
      const next = selected.filter((entry) => entry !== canonical);
      onChange(next.length > 0 ? next : selected);
      return;
    }
    onChange([...selected, canonical]);
  };

  const remove = (type: CompanyType) => {
    const next = selected.filter((entry) => entry !== type);
    if (next.length === 0) return;
    onChange(next);
  };

  const labelClass =
    density === "compact"
      ? "text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40"
      : "text-[10px] font-bold uppercase tracking-[0.14em] text-upcycle-orange/80";

  return (
    <div ref={rootRef} className="relative w-full">
      <p className={labelClass}>
        {label}
        {required ? " *" : null}
      </p>

      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
        className={`mt-1 flex w-full items-center justify-between gap-2 border ${
          density === "compact"
            ? "border-carbon-blue/15 px-2 py-1"
            : "border-2 border-upcycle-orange/25 px-3 py-2"
        } bg-white text-left outline-none transition-colors focus:border-upcycle-orange focus:ring-2 focus:ring-upcycle-orange/20 disabled:opacity-60`}
      >
        <span
          className={`min-w-0 flex-1 truncate ${
            density === "compact" ? "text-xs" : "text-[13px]"
          } text-carbon-blue/55`}
        >
          {selected.length === 0
            ? placeholder
            : `${selected.length} type${selected.length === 1 ? "" : "s"} selected`}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-carbon-blue/35" aria-hidden />
      </button>

      {selected.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((type) => {
            const meta = getCompanyTypeMeta(type);
            return (
              <span
                key={type}
                className="inline-flex items-center gap-1 border border-upcycle-orange/30 bg-upcycle-orange/10 px-2 py-0.5 text-[11px] font-semibold text-upcycle-orange"
              >
                <span aria-hidden>{meta.emoji}</span>
                {meta.label}
                <button
                  type="button"
                  disabled={disabled || selected.length <= 1}
                  onClick={() => remove(type)}
                  className="rounded-sm p-0.5 transition-colors hover:bg-upcycle-orange/20 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`Remove ${meta.label}`}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            );
          })}
        </div>
      ) : null}

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-multiselectable
          className="absolute z-50 mt-1 w-full overflow-hidden border border-carbon-blue/12 bg-white shadow-lg"
        >
          <div className="border-b border-carbon-blue/8 p-2">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter types…"
              className="w-full border border-carbon-blue/15 bg-white px-2 py-1.5 text-[12px] text-carbon-blue outline-none focus:border-upcycle-orange"
              autoFocus
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-[12px] text-carbon-blue/45">No matching types</li>
            ) : (
              filtered.map((type) => {
                const meta = getCompanyTypeMeta(type);
                const isSelected = selected.includes(type);
                return (
                  <li key={type}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => toggle(type)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12px] text-carbon-blue transition-colors hover:bg-carbon-blue/[0.04]"
                    >
                      <span className="inline-flex items-center gap-2">
                        <span aria-hidden>{meta.emoji}</span>
                        {meta.label}
                      </span>
                      {isSelected ? (
                        <Check className="size-3.5 shrink-0 text-upcycle-orange" aria-hidden />
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
