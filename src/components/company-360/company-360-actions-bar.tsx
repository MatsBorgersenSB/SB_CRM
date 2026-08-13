"use client";

import { useEffect, useRef, useState } from "react";
import { canCreateCompany } from "@/lib/permissions";
import type { UserRole } from "@/types/auth";

export type Company360ActiveTool =
  | null
  | "quick-import"
  | "website-discovery"
  | "edit-company";

type Company360ActionsBarProps = {
  role: UserRole;
  activeTool: Company360ActiveTool;
  onToolChange: (tool: Company360ActiveTool) => void;
  onNewContact: () => void;
};

/**
 * Account tools in overflow — never equal primary CTAs above the company name.
 */
export function Company360ActionsBar({
  role,
  activeTool,
  onToolChange,
  onNewContact,
}: Company360ActionsBarProps) {
  const canManage = canCreateCompany(role);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
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

  if (!canManage) return null;

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  const toggle = (tool: Company360ActiveTool) => {
    onToolChange(activeTool === tool ? null : tool);
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account tools"
        title="Account tools"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center border border-carbon-blue/12 px-2 py-1 text-[11px] font-semibold tracking-wider text-carbon-blue/50 transition-colors hover:border-upcycle-orange/30 hover:text-upcycle-orange"
      >
        ···
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1 min-w-[11.5rem] border border-carbon-blue/15 bg-white py-1 shadow-lg"
        >
          <OverflowItem
            label={activeTool === "quick-import" ? "Close Quick Import" : "Quick Import"}
            onClick={() => run(() => toggle("quick-import"))}
          />
          <OverflowItem
            label={
              activeTool === "website-discovery"
                ? "Close Website Discovery"
                : "Website Discovery"
            }
            onClick={() => run(() => toggle("website-discovery"))}
          />
          <OverflowItem
            label="New Contact"
            onClick={() => run(onNewContact)}
          />
          <OverflowItem
            label={activeTool === "edit-company" ? "Close Edit Company" : "Edit Company"}
            onClick={() => run(() => toggle("edit-company"))}
          />
        </div>
      ) : null}
    </div>
  );
}

function OverflowItem({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="block w-full px-3 py-1.5 text-left text-[11px] text-carbon-blue/75 hover:bg-carbon-blue/[0.04] hover:text-upcycle-orange"
    >
      {label}
    </button>
  );
}
