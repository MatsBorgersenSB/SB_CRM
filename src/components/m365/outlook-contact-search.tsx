"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import type { UserRole } from "@/types/auth";

export type OutlookContactHit = {
  id: string;
  name: string;
  email: string | null;
  companyName: string;
};

/**
 * Search Contact Registry from the Outlook compose pane.
 * Pick an existing person, or add one who is not in SmartCRM yet.
 */
export function OutlookContactSearch({
  role = "superuser",
  disabled = false,
  onSelect,
  onCreateNew,
}: {
  role?: UserRole;
  disabled?: boolean;
  onSelect: (hit: OutlookContactHit) => void;
  onCreateNew: (draft: { query: string; email: string; displayName: string }) => void;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<OutlookContactHit[]>([]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      void (async () => {
        try {
          const response = await fetch(
            `/api/contacts/search?${new URLSearchParams({ q: trimmed })}`,
            {
              headers: { [AUTH_ROLE_HEADER]: role },
              credentials: "include",
              signal: controller.signal,
              cache: "no-store",
            },
          );
          const payload = (await response.json().catch(() => ({}))) as {
            contacts?: OutlookContactHit[];
          };
          if (!response.ok) {
            setHits([]);
            return;
          }
          setHits(Array.isArray(payload.contacts) ? payload.contacts : []);
        } catch (error) {
          if ((error as { name?: string }).name === "AbortError") return;
          setHits([]);
        } finally {
          setLoading(false);
        }
      })();
    }, 220);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, role]);

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

  const trimmed = query.trim();
  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed.toLowerCase());
  const createDraft = {
    query: trimmed,
    email: looksLikeEmail ? trimmed.toLowerCase() : "",
    displayName: looksLikeEmail ? "" : trimmed,
  };

  return (
    <div ref={rootRef} className="relative">
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
        Find contact in SmartCRM
        <input
          type="search"
          value={query}
          disabled={disabled}
          placeholder="Name, email, or company…"
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listId}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          className="mt-1 w-full border border-carbon-blue/15 bg-white px-2 py-1.5 text-[12px] font-medium text-carbon-blue"
        />
      </label>

      {isOpen ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto border border-carbon-blue/15 bg-white shadow-md"
        >
          {trimmed.length < 2 ? (
            <li className="px-3 py-2 text-[11px] text-carbon-blue/50">
              Type at least two letters to search.
            </li>
          ) : loading ? (
            <li className="px-3 py-2 text-[11px] text-carbon-blue/50">Searching…</li>
          ) : hits.length === 0 ? (
            <li className="px-3 py-2 text-[11px] text-carbon-blue/50">
              No matching contact in SmartCRM.
            </li>
          ) : (
            hits.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  role="option"
                  className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-upcycle-orange/10"
                  onClick={() => {
                    onSelect(hit);
                    setQuery(`${hit.name}${hit.email ? ` · ${hit.email}` : ""}`);
                    setIsOpen(false);
                  }}
                >
                  <span className="text-[12px] font-medium text-carbon-blue">{hit.name}</span>
                  <span className="text-[10px] text-carbon-blue/45">
                    {[hit.companyName, hit.email].filter(Boolean).join(" · ")}
                  </span>
                </button>
              </li>
            ))
          )}
          {trimmed.length >= 2 ? (
            <li className="border-t border-carbon-blue/10">
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-[11px] font-semibold text-upcycle-orange hover:bg-upcycle-orange/10"
                onClick={() => {
                  onCreateNew(createDraft);
                  setIsOpen(false);
                }}
              >
                {looksLikeEmail
                  ? `Add ${trimmed.toLowerCase()} as a new contact`
                  : `Add new contact${trimmed ? ` “${trimmed}”` : ""}`}
              </button>
            </li>
          ) : (
            <li className="border-t border-carbon-blue/10">
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-[11px] font-semibold text-upcycle-orange hover:bg-upcycle-orange/10"
                onClick={() => {
                  onCreateNew({ query: "", email: "", displayName: "" });
                  setIsOpen(false);
                }}
              >
                Add a new contact
              </button>
            </li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
