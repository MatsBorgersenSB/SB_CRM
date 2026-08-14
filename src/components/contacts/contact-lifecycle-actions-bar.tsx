"use client";

import { useEffect, useRef, useState } from "react";
import type { Contact } from "@/types/contact";
import type { UserRole } from "@/types/auth";
import { canDeleteContact } from "@/lib/permissions";

type LifecycleWizardMode = "transfer" | "merge" | "position" | null;

export function ContactLifecycleActionsBar({
  contact,
  role,
  onWizardOpen,
  onArchiveOpen,
  onEditOpen,
  editing = false,
}: {
  contact: Contact;
  role: UserRole;
  onWizardOpen: (mode: NonNullable<LifecycleWizardMode>) => void;
  onArchiveOpen: () => void;
  onEditOpen: () => void;
  editing?: boolean;
}) {
  const canManage = canDeleteContact(role);
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

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Contact tools"
        title="Contact tools"
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
            label={editing ? "Close Edit Contact" : "Edit Contact"}
            onClick={() => run(onEditOpen)}
          />
          {canManage ? (
            <>
              <OverflowItem
                label="Change Company"
                onClick={() => run(() => onWizardOpen("transfer"))}
              />
              <OverflowItem
                label="Change Position"
                onClick={() => run(() => onWizardOpen("position"))}
              />
              <OverflowItem
                label="Merge Duplicates"
                onClick={() => run(() => onWizardOpen("merge"))}
              />
              <OverflowItem
                label={contact.IsArchived ? "Restore Contact" : "Archive Contact"}
                onClick={() => run(onArchiveOpen)}
              />
            </>
          ) : null}
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
