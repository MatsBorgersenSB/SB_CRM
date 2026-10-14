"use client";

import { useEffect, useRef, useState } from "react";

export type WorkspaceAddMenuItem<T extends string> = {
  id: T;
  label: string;
  /** Short explanation shown under the label. */
  hint?: string;
  primary?: boolean;
};

/**
 * One "Add…" button for the admin-ish ways of getting records in
 * (new, quick import, website discovery, bulk import). Keeps the list header
 * about the business, not about data entry. Opening a tool keeps the button
 * labelled with it so the user can see what is expanded and close it.
 */
export function WorkspaceAddMenu<T extends string>({
  items,
  activeTool,
  onSelect,
  label = "Add…",
}: {
  items: WorkspaceAddMenuItem<T>[];
  activeTool: T | null;
  onSelect: (tool: T | null) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = items.find((item) => item.id === activeTool) ?? null;

  if (active) {
    return (
      <button
        type="button"
        onClick={() => onSelect(null)}
        className="inline-flex items-center gap-2 border border-upcycle-orange/40 bg-upcycle-orange/10 px-3 py-1.5 text-[11px] font-semibold text-upcycle-orange transition-colors hover:bg-upcycle-orange/15"
        title="Close"
      >
        {active.label}
        <span aria-hidden className="text-[13px] leading-none">×</span>
      </button>
    );
  }

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1.5 border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-upcycle-orange/90"
      >
        {label}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 z-40 mt-1 min-w-[15rem] border border-carbon-blue/15 bg-white py-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSelect(item.id);
              }}
              className="block w-full px-3 py-2 text-left hover:bg-carbon-blue/[0.04]"
            >
              <span
                className={`block text-[12px] font-semibold ${
                  item.primary ? "text-upcycle-orange" : "text-carbon-blue"
                }`}
              >
                {item.label}
              </span>
              {item.hint ? (
                <span className="block text-[11px] text-carbon-blue/55">{item.hint}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
