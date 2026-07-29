"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { UnifiedEuropeanCompany } from "@/lib/integrations/company-registers/types";

type EuropeanRegistrySearchProps = {
  onSelect: (company: UnifiedEuropeanCompany) => void;
  /** Prefill / domain TLD hint (e.g. company website). */
  domainHint?: string;
  countryHint?: string;
  label?: string;
  placeholder?: string;
  className?: string;
};

/**
 * Combobox that searches Pan-European business registries and returns a
 * UnifiedEuropeanCompany for form autofill (Reality First — user must select).
 */
export function EuropeanRegistrySearch({
  onSelect,
  domainHint,
  countryHint,
  label = "European Registry Search",
  placeholder = "Search company name, orgnr, SIREN, CVR, VAT…",
  className = "",
}: EuropeanRegistrySearchProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<UnifiedEuropeanCompany[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    debounceRef.current = setTimeout(() => {
      void (async () => {
        const requestId = ++requestIdRef.current;
        try {
          const params = new URLSearchParams({ q: trimmed });
          if (countryHint) params.set("country", countryHint);
          if (domainHint) params.set("domain", domainHint);
          const response = await fetch(`/api/discovery/registry?${params.toString()}`);
          const body = (await response.json()) as {
            results?: UnifiedEuropeanCompany[];
            error?: string;
          };
          if (requestId !== requestIdRef.current) return;
          if (!response.ok) {
            setResults([]);
            setError(body.error ?? "Registry search failed");
            return;
          }
          setResults(body.results ?? []);
          setIsOpen(true);
        } catch {
          if (requestId !== requestIdRef.current) return;
          setResults([]);
          setError("Registry search unavailable");
        } finally {
          if (requestId === requestIdRef.current) setLoading(false);
        }
      })();
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, countryHint, domainHint]);

  const handleSelect = (company: UnifiedEuropeanCompany) => {
    setSelectedLabel(
      `${company.legalName} · ${company.registrationNumber} · ${company.countryCode}`,
    );
    setQuery(company.legalName);
    setIsOpen(false);
    onSelect(company);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <label className="block">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          {label}
        </span>
        <input
          type="search"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedLabel(null);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1 text-xs text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
        />
      </label>
      {loading ? (
        <p className="mt-1 text-[10px] text-carbon-blue/45">Searching registries…</p>
      ) : null}
      {error ? <p className="mt-1 text-[10px] text-thermal-red">{error}</p> : null}
      {selectedLabel && !isOpen ? (
        <p className="mt-1 text-[10px] text-carbon-blue/50">Selected: {selectedLabel}</p>
      ) : null}
      {isOpen && query.trim().length >= 2 && !loading ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto border border-carbon-blue/15 bg-white shadow-sm"
        >
          {results.length === 0 ? (
            <li className="px-2 py-2 text-[11px] text-carbon-blue/45">No registry matches</li>
          ) : (
            results.map((company) => (
              <li key={`${company.countryCode}-${company.registrationNumber}-${company.legalName}`}>
                <button
                  type="button"
                  role="option"
                  className="flex w-full flex-col gap-0.5 px-2 py-2 text-left hover:bg-upcycle-orange/[0.06]"
                  onClick={() => handleSelect(company)}
                >
                  <span className="text-xs font-semibold text-carbon-blue">
                    {company.legalName}
                  </span>
                  <span className="text-[10px] text-carbon-blue/55">
                    {company.registrationNumber}
                    {company.vatNumber ? ` · ${company.vatNumber}` : ""}
                    {" · "}
                    {[company.city, company.country].filter(Boolean).join(", ")}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-carbon-blue/35">
                    {company.sourceRegistry}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
