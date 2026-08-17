"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

export type CompanyComboboxOption = {
  id: string;
  name: string;
  domain?: string;
};

type CompanyComboboxProps = {
  companies: CompanyComboboxOption[];
  selectedCompanyId: string | null;
  onSelectCompany: (company: CompanyComboboxOption | null) => void;
  onCreateNewCompany: (typedName: string) => void | Promise<void>;
  /** Called as the user types so a new name can become “create company”. */
  onTypedNameChange?: (name: string) => void;
  /** Show “Create company …” when typed name has no exact match. Default true. */
  allowCreate?: boolean;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  required?: boolean;
};

/**
 * Searchable company field: pick existing or create new from typed name.
 * Reality First — never invent a company silently; create requires explicit click.
 */
export function CompanyCombobox({
  companies,
  selectedCompanyId,
  onSelectCompany,
  onCreateNewCompany,
  draftName = null,
  onTypedNameChange,
  allowCreate = true,
  disabled = false,
  label = "Company Name",
  placeholder = "Search or type new company…",
  required = true,
}: CompanyComboboxProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const selected = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId],
  );

  useEffect(() => {
    if (selected) {
      setQuery(selected.name);
    } else if (draftName) {
      setQuery(draftName);
    } else if (!selectedCompanyId) {
      setQuery("");
    }
  }, [selected, selectedCompanyId, draftName]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        if (selected) setQuery(selected.name);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        if (selected) setQuery(selected.name);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, selected]);

  const trimmed = query.trim();
  const filteredCompanies =
    trimmed === ""
      ? companies
      : companies.filter(
          (company) =>
            company.name.toLowerCase().includes(trimmed.toLowerCase()) ||
            (company.domain?.toLowerCase().includes(trimmed.toLowerCase()) ?? false),
        );

  const exactMatch = companies.some(
    (company) => company.name.toLowerCase() === trimmed.toLowerCase(),
  );

  const showCreate = allowCreate && trimmed.length > 0 && !exactMatch && !creating;
  const showMenu = isOpen && (trimmed.length > 0 || filteredCompanies.length > 0);

  const handleCreate = async () => {
    if (!showCreate) return;
    setCreating(true);
    try {
      await onCreateNewCompany(trimmed);
      setIsOpen(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={rootRef} className="relative w-full">
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
        {label}
        {required ? " *" : null}
      </label>

      <div className="relative">
        <input
          type="text"
          role="combobox"
          aria-expanded={showMenu}
          aria-controls={listId}
          aria-autocomplete="list"
          disabled={disabled || creating}
          value={query}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            setIsOpen(true);
            onTypedNameChange?.(next);
            if (selected && next.trim() !== selected.name) {
              onSelectCompany(null);
            }
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full border border-carbon-blue/15 bg-white py-2 pl-3 pr-9 text-[12px] text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40 disabled:opacity-60"
          autoComplete="off"
        />
        <ChevronsUpDown
          className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-carbon-blue/35"
          aria-hidden
        />
      </div>

      {showMenu ? (
        <div
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto border border-carbon-blue/12 bg-white shadow-lg"
        >
          {filteredCompanies.length === 0 && !showCreate ? (
            <p className="px-3 py-2 text-[12px] text-carbon-blue/45">No matching companies</p>
          ) : null}

          {filteredCompanies.map((company) => (
            <button
              key={company.id}
              type="button"
              role="option"
              aria-selected={selectedCompanyId === company.id}
              onClick={() => {
                onSelectCompany(company);
                setQuery(company.name);
                setIsOpen(false);
              }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12px] text-carbon-blue transition-colors hover:bg-carbon-blue/[0.04]"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{company.name}</span>
                {company.domain ? (
                  <span className="block truncate text-[10px] text-carbon-blue/40">
                    {company.domain}
                  </span>
                ) : null}
              </span>
              {selectedCompanyId === company.id ? (
                <Check className="size-3.5 shrink-0 text-upcycle-orange" aria-hidden />
              ) : null}
            </button>
          ))}

          {showCreate ? (
            <button
              type="button"
              onClick={() => void handleCreate()}
              className="flex w-full items-center gap-2 border-t border-carbon-blue/8 px-3 py-2 text-left text-[12px] font-medium text-upcycle-orange transition-colors hover:bg-upcycle-orange/[0.06]"
            >
              <Plus className="size-3.5 shrink-0" aria-hidden />
              <span>
                Create company <strong className="font-semibold">“{trimmed}”</strong>
              </span>
            </button>
          ) : null}

          {creating ? (
            <p className="border-t border-carbon-blue/8 px-3 py-2 text-[12px] text-carbon-blue/50">
              Creating company…
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
