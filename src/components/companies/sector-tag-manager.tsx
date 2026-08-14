"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
import type { Company } from "@/types/company";
import {
  COMPANY_SECTOR_PRESETS,
  normalizeCompanySectors,
  normalizeSectorLabel,
  sectorTintClass,
} from "@/lib/company-sectors";

type SectorTagManagerProps = {
  companyId: string;
  sectors: string[] | null | undefined;
  disabled?: boolean;
  density?: "header" | "outlook";
  onUpdated?: (company: Company) => void;
};

export function SectorTagManager({
  companyId,
  sectors,
  disabled = false,
  density = "header",
  onUpdated,
}: SectorTagManagerProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );
  const [localSectors, setLocalSectors] = useState(() =>
    normalizeCompanySectors(sectors),
  );

  useEffect(() => {
    setLocalSectors(normalizeCompanySectors(sectors));
    setError(null);
    setOpen(false);
    setQuery("");
  }, [companyId]);

  useEffect(() => {
    if (!open) return;

    const placeMenu = () => {
      const anchor = rootRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const width = Math.min(256, Math.max(208, rect.width));
      const left = Math.min(rect.left, window.innerWidth - width - 8);
      setMenuPos({
        top: rect.bottom + 4,
        left: Math.max(8, left),
        width,
      });
    };

    placeMenu();

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
      setQuery("");
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };

    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", placeMenu, true);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const persist = async (next: string[]) => {
    const normalized = normalizeCompanySectors(next);
    const previous = localSectors;
    setLocalSectors(normalized);
    setError(null);
    setSaving(true);
    try {
      const { syncCompanyRecord } = await import("@/lib/sync-company");
      const updated = await syncCompanyRecord(companyId, { Sectors: normalized });
      setLocalSectors(normalizeCompanySectors(updated.Sectors));
      onUpdated?.(updated);
    } catch (caught) {
      setLocalSectors(previous);
      setError(caught instanceof Error ? caught.message : "Could not save sectors");
    } finally {
      setSaving(false);
    }
  };

  const addSector = (raw: string) => {
    const label = normalizeSectorLabel(raw);
    if (!label) return;
    if (localSectors.some((entry) => entry.toLowerCase() === label.toLowerCase())) {
      setOpen(false);
      setQuery("");
      return;
    }
    setOpen(false);
    setQuery("");
    void persist([...localSectors, label]);
  };

  const removeSector = (sector: string) => {
    void persist(localSectors.filter((entry) => entry !== sector));
  };

  const q = query.trim();
  const availablePresets = useMemo(() => {
    const assigned = new Set(localSectors.map((entry) => entry.toLowerCase()));
    return COMPANY_SECTOR_PRESETS.filter((preset) => {
      if (assigned.has(preset.toLowerCase())) return false;
      if (!q) return true;
      return preset.toLowerCase().includes(q.toLowerCase());
    });
  }, [localSectors, q]);

  const customLabel = normalizeSectorLabel(q);
  const canCreateCustom =
    Boolean(customLabel) &&
    !localSectors.some((entry) => entry.toLowerCase() === customLabel.toLowerCase()) &&
    !COMPANY_SECTOR_PRESETS.some(
      (preset) => preset.toLowerCase() === customLabel.toLowerCase(),
    );

  const compact = density === "outlook";
  const pillText = compact ? "text-[10px]" : "text-[11px]";
  const pillPad = compact ? "px-1.5 py-0.5" : "px-2 py-0.5";

  const menu =
    open && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            className="overflow-hidden border border-carbon-blue/12 bg-white shadow-lg"
            style={{
              position: "fixed",
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
              zIndex: 80,
            }}
          >
            <div className="border-b border-carbon-blue/8 p-1.5">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (availablePresets[0]) addSector(availablePresets[0]);
                    else if (canCreateCustom) addSector(customLabel);
                  }
                }}
                placeholder="Search or create…"
                className="w-full border border-carbon-blue/15 bg-white px-2 py-1.5 text-[12px] text-carbon-blue outline-none focus:border-upcycle-orange"
                autoFocus
              />
            </div>
            <ul className="max-h-44 overflow-y-auto py-1">
              {availablePresets.map((preset) => (
                <li key={preset}>
                  <button
                    type="button"
                    role="option"
                    onClick={() => addSector(preset)}
                    className="flex w-full items-center px-3 py-1.5 text-left text-[12px] text-carbon-blue transition-colors hover:bg-carbon-blue/[0.04]"
                  >
                    {preset}
                  </button>
                </li>
              ))}
              {canCreateCustom ? (
                <li>
                  <button
                    type="button"
                    role="option"
                    onClick={() => addSector(customLabel)}
                    className="flex w-full items-center px-3 py-1.5 text-left text-[12px] text-upcycle-orange transition-colors hover:bg-upcycle-orange/[0.06]"
                  >
                    Create “{customLabel}”
                  </button>
                </li>
              ) : null}
              {availablePresets.length === 0 && !canCreateCustom ? (
                <li className="px-3 py-2 text-[12px] text-carbon-blue/45">
                  {q ? "No matching sectors" : "All presets assigned"}
                </li>
              ) : null}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className="relative min-w-0">
      <div className="flex flex-wrap items-center gap-1.5">
        {localSectors.map((sector) => (
          <span
            key={sector}
            className={`inline-flex max-w-full items-center gap-1 border ${pillPad} ${pillText} font-medium ${sectorTintClass(sector)}`}
          >
            <span className="truncate">{sector}</span>
            <button
              type="button"
              disabled={disabled || saving}
              onClick={() => removeSector(sector)}
              className="shrink-0 p-0.5 opacity-60 transition-opacity hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={`Remove ${sector}`}
            >
              <X className="size-2.5" aria-hidden />
            </button>
          </span>
        ))}

        <button
          type="button"
          disabled={disabled || saving}
          aria-expanded={open}
          aria-controls={listId}
          aria-haspopup="listbox"
          onClick={() => {
            if (open) {
              setOpen(false);
              setQuery("");
              return;
            }
            const anchor = rootRef.current;
            if (anchor) {
              const rect = anchor.getBoundingClientRect();
              const width = Math.min(256, Math.max(208, rect.width));
              const left = Math.min(rect.left, window.innerWidth - width - 8);
              setMenuPos({
                top: rect.bottom + 4,
                left: Math.max(8, left),
                width,
              });
            }
            setOpen(true);
          }}
          className={`inline-flex items-center gap-1 border border-dashed border-carbon-blue/25 bg-white ${pillPad} ${pillText} font-medium text-carbon-blue/55 transition-colors hover:border-upcycle-orange/50 hover:text-upcycle-orange disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <Plus className="size-2.5" aria-hidden />
          Add Sector
        </button>
      </div>

      {error ? (
        <p className="mt-1 text-[10px] text-thermal-red">{error}</p>
      ) : null}

      {menu}
    </div>
  );
}
