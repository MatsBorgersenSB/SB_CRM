"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import type { CompanyType } from "@/types/company-type";
import {
  COMPANY_TYPE_SELECT_OPTIONS,
  canonicalizeCompanyType,
  getCompanyTypeMeta,
} from "@/types/company-type";
import { CompanyTypeIcon } from "@/components/companies/company-type-icon";

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
  placeholder = "Select company type(s)…",
  required = false,
  density = "comfortable",
}: CompanyTypeMultiSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const closeDropdown = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    setQuery("");
    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  }, []);

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
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeDropdown(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDropdown(true);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closeDropdown]);

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
      onChange(selected.filter((entry) => entry !== canonical));
    } else {
      const base =
        canonical === "Unclassified"
          ? selected
          : selected.filter((entry) => entry !== "Unclassified");
      onChange([...base, canonical]);
    }
    closeDropdown(true);
  };

  const remove = (type: CompanyType) => {
    onChange(selected.filter((entry) => entry !== type));
  };

  const labelClass =
    density === "compact"
      ? "text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/60"
      : "text-[11px] font-bold uppercase tracking-[0.14em] text-upcycle-orange/80";

  const triggerText =
    selected.length === 0
      ? placeholder
      : selected.length < options.length
        ? `${selected.length} type${selected.length === 1 ? "" : "s"} selected — add another…`
        : `${selected.length} types selected`;

  return (
    <div
      ref={rootRef}
      className="relative w-full"
      onBlur={(event) => {
        if (
          open &&
          event.relatedTarget instanceof Node &&
          !rootRef.current?.contains(event.relatedTarget)
        ) {
          closeDropdown(false);
        }
      }}
    >
      <p className={labelClass}>
        {label}
        {required ? <span className="text-thermal-red"> *</span> : null}
      </p>

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-expanded={open && !disabled}
        aria-controls={listId}
        aria-haspopup="listbox"
        onClick={() => {
          if (open) {
            closeDropdown(false);
          } else {
            setOpen(true);
          }
        }}
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
          {triggerText}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-carbon-blue/50" aria-hidden />
      </button>

      {selected.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((type) => {
            const meta = getCompanyTypeMeta(type);
            return (
              <span
                key={type}
                className="inline-flex items-center gap-1 border border-upcycle-orange/30 bg-upcycle-orange/10 px-2 py-0.5 text-[12px] font-semibold text-upcycle-orange"
              >
                <CompanyTypeIcon icon={meta.icon} />
                {meta.label}
                <button
                  type="button"
                  disabled={disabled}
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

      {open && !disabled ? (
        <div
          id={listId}
          role="listbox"
          aria-multiselectable
          className="absolute z-50 mt-1 w-full overflow-hidden border border-carbon-blue/12 bg-white shadow-lg"
        >
          <div className="border-b border-carbon-blue/8 p-2">
            <input
              aria-label="Filter types"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && filtered.length > 0) {
                  event.preventDefault();
                  toggle(filtered[0]);
                }
              }}
              placeholder="Filter types…"
              className="w-full border border-carbon-blue/15 bg-white px-2 py-1.5 text-[13px] text-carbon-blue outline-none focus:border-upcycle-orange"
              autoFocus
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-[13px] text-carbon-blue/65">No matching types</li>
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
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] text-carbon-blue transition-colors hover:bg-carbon-blue/[0.04] ${
                        isSelected ? "bg-upcycle-orange/[0.06] font-medium" : ""
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <CompanyTypeIcon icon={meta.icon} />
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
