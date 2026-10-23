"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type WorkspaceAddMenuItem<T extends string> = {
  id: T;
  label: string;
  /** Short explanation shown under the label. */
  hint?: string;
  primary?: boolean;
};

type MenuBox = { top: number; left: number; maxHeight: number };

function placeMenu(anchor: DOMRect): MenuBox {
  const width = 240;
  const margin = 8;
  const top = anchor.bottom + 4;
  const left = Math.max(margin, Math.min(anchor.left, window.innerWidth - width - margin));
  const maxHeight = Math.max(160, window.innerHeight - top - margin);
  return { top, left, maxHeight };
}

/**
 * One "Add…" button for the ways of getting records in.
 * The list is portaled so a card with overflow:hidden cannot clip it.
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
  const [box, setBox] = useState<MenuBox | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    const place = () => {
      if (!rootRef.current) return;
      setBox(placeMenu(rootRef.current.getBoundingClientRect()));
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
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
        className="inline-flex items-center gap-2 border border-upcycle-orange/40 bg-upcycle-orange/10 px-3 py-1.5 text-[12px] font-semibold text-upcycle-orange transition-colors hover:bg-upcycle-orange/15"
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
        className="inline-flex items-center gap-1.5 border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-upcycle-orange/90"
      >
        {label}
      </button>
      {open && box
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{ top: box.top, left: box.left, maxHeight: box.maxHeight }}
              className="fixed z-[80] min-w-[15rem] overflow-y-auto border border-carbon-blue/15 bg-white py-1 shadow-lg"
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
                    className={`block text-[13px] font-semibold ${
                      item.primary ? "text-upcycle-orange" : "text-carbon-blue"
                    }`}
                  >
                    {item.label}
                  </span>
                  {item.hint ? (
                    <span className="block text-[12px] text-carbon-blue/55">{item.hint}</span>
                  ) : null}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
