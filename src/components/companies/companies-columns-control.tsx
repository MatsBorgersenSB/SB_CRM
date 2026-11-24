"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  COMPANY_LIST_OPTIONAL_COLUMNS,
  countVisibleOptionalColumns,
  type CompanyListColumnVisibility,
  type CompanyListOptionalColumnId,
} from "@/lib/company-list-columns";

type CompaniesColumnsControlProps = {
  visibility: CompanyListColumnVisibility;
  onChange: (id: CompanyListOptionalColumnId, visible: boolean) => void;
};

/**
 * Columns control — toggle optional Companies list fields.
 * Core decision columns stay fixed; only optional columns appear here.
 */
export function CompaniesColumnsControl({
  visibility,
  onChange,
}: CompaniesColumnsControlProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const visibleCount = countVisibleOptionalColumns(visibility);
  const active = visibleCount > 0;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const label =
    visibleCount === 0
      ? "Columns"
      : visibleCount === 1
        ? "Columns (1)"
        : `Columns (${visibleCount})`;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex h-8 items-center gap-1 border px-2.5 text-[12px] font-semibold transition-colors ${
          active
            ? "border-upcycle-orange/35 bg-upcycle-orange/[0.08] text-upcycle-orange"
            : "border-carbon-blue/12 bg-white text-carbon-blue/70 hover:border-carbon-blue/25 hover:text-carbon-blue"
        }`}
      >
        <span className="max-w-[9rem] truncate">{label}</span>
        <ChevronDown className="size-3 shrink-0 opacity-60" strokeWidth={2} />
      </button>

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Optional columns"
          className="absolute left-0 top-full z-50 mt-1 min-w-[14rem] border border-carbon-blue/12 bg-white py-1 shadow-lg"
        >
          <p className="px-3 py-1.5 text-[11px] font-medium text-carbon-blue/55">
            Add to this view
          </p>
          {COMPANY_LIST_OPTIONAL_COLUMNS.map((column) => {
            const selected = visibility[column.id];
            return (
              <button
                key={column.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onChange(column.id, !selected)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-carbon-blue/[0.04] ${
                  selected ? "font-semibold text-carbon-blue" : "text-carbon-blue/75"
                }`}
              >
                <span
                  className={`inline-flex size-3.5 shrink-0 items-center justify-center border ${
                    selected
                      ? "border-upcycle-orange bg-upcycle-orange text-white"
                      : "border-carbon-blue/20 bg-white"
                  }`}
                  aria-hidden
                >
                  {selected ? <span className="text-[10px]">✓</span> : null}
                </span>
                {column.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
