/**
 * Searchable contact picker for project / opportunity assignment.
 */

"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { getContactDisplayName } from "@/types/contact";
import type { ProjectContactOption } from "@/lib/project-stakeholder-contacts";

type ContactComboboxProps = {
  options: ProjectContactOption[];
  selectedContactId: string;
  onSelect: (option: ProjectContactOption | null) => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  emptyMessage?: string;
  groupAccountLabel?: string;
  groupOtherLabel?: string;
};

function matchesQuery(option: ProjectContactOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = getContactDisplayName(option.contact).toLowerCase();
  const email = (option.contact.Email ?? "").toLowerCase();
  const company = option.companyName.toLowerCase();
  const title = (option.contact.JobTitle ?? option.contact.Role ?? "").toLowerCase();
  return (
    name.includes(q) ||
    email.includes(q) ||
    company.includes(q) ||
    title.includes(q)
  );
}

export function ContactCombobox({
  options,
  selectedContactId,
  onSelect,
  disabled = false,
  label = "Contact",
  placeholder = "Search contacts by name, email, or company…",
  emptyMessage = "No contacts match your search.",
  groupAccountLabel = "Connected account",
  groupOtherLabel = "All other contacts",
}: ContactComboboxProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const selected = useMemo(
    () => options.find((option) => option.contact.ContactID === selectedContactId) ?? null,
    [options, selectedContactId],
  );

  useEffect(() => {
    if (selected) {
      setQuery(
        `${getContactDisplayName(selected.contact)} · ${selected.companyName}`,
      );
    } else if (!selectedContactId) {
      setQuery("");
    }
  }, [selected, selectedContactId]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        if (selected) {
          setQuery(
            `${getContactDisplayName(selected.contact)} · ${selected.companyName}`,
          );
        }
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        if (selected) {
          setQuery(
            `${getContactDisplayName(selected.contact)} · ${selected.companyName}`,
          );
        }
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, selected]);

  const filtered = useMemo(
    () => options.filter((option) => matchesQuery(option, query)),
    [options, query],
  );

  const accountMatches = filtered.filter((option) => option.source === "account");
  const otherMatches = filtered.filter((option) => option.source !== "account");

  return (
    <div ref={rootRef} className="relative block">
      <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
        {label}
      </span>
      <div className="relative mt-1">
        <input
          type="search"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listId}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
            if (selectedContactId) onSelect(null);
          }}
          className="w-full border border-carbon-blue/15 bg-white py-2 pl-3 pr-9 text-[12px] text-carbon-blue outline-none focus:border-upcycle-orange"
        />
        <ChevronsUpDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-carbon-blue/35" />
      </div>

      {isOpen ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto border border-carbon-blue/15 bg-white shadow-md"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-[11px] text-carbon-blue/50">{emptyMessage}</li>
          ) : (
            <>
              {accountMatches.length > 0 ? (
                <li className="border-b border-carbon-blue/8 px-3 py-1 text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                  {groupAccountLabel}
                </li>
              ) : null}
              {accountMatches.map((option) => (
                <li key={option.contact.ContactID}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={option.contact.ContactID === selectedContactId}
                    className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-upcycle-orange/10"
                    onClick={() => {
                      onSelect(option);
                      setIsOpen(false);
                    }}
                  >
                    <span className="text-[12px] font-medium text-carbon-blue">
                      {getContactDisplayName(option.contact)}
                    </span>
                    <span className="text-[10px] text-carbon-blue/45">
                      {[option.companyName, option.contact.Email].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
              {otherMatches.length > 0 ? (
                <li className="border-b border-t border-carbon-blue/8 px-3 py-1 text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                  {groupOtherLabel}
                </li>
              ) : null}
              {otherMatches.map((option) => (
                <li key={option.contact.ContactID}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={option.contact.ContactID === selectedContactId}
                    className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-upcycle-orange/10"
                    onClick={() => {
                      onSelect(option);
                      setIsOpen(false);
                    }}
                  >
                    <span className="text-[12px] font-medium text-carbon-blue">
                      {getContactDisplayName(option.contact)}
                    </span>
                    <span className="text-[10px] text-carbon-blue/45">
                      {[option.companyName, option.contact.Email].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
            </>
          )}
        </ul>
      ) : null}
    </div>
  );
}
