"use client";

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

  return (
    <div className="flex flex-wrap items-center gap-2 border border-carbon-blue/10 bg-white px-3 py-2">
      <button
        type="button"
        onClick={onEditOpen}
        className={`border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
          editing
            ? "border-upcycle-orange/40 bg-upcycle-orange/10 text-upcycle-orange"
            : "border-carbon-blue/15 text-carbon-blue/60 hover:border-upcycle-orange/30 hover:text-upcycle-orange"
        }`}
      >
        {editing ? "Editing…" : "Edit contact"}
      </button>

      {canManage ? (
        <>
          <button
            type="button"
            onClick={() => onWizardOpen("transfer")}
            className="border border-carbon-blue/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/60 hover:border-upcycle-orange/30 hover:text-upcycle-orange"
          >
            Change company
          </button>
          <button
            type="button"
            onClick={() => onWizardOpen("position")}
            className="border border-carbon-blue/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/60 hover:border-upcycle-orange/30 hover:text-upcycle-orange"
          >
            Change position
          </button>
          <button
            type="button"
            onClick={() => onWizardOpen("merge")}
            className="border border-carbon-blue/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/60 hover:border-upcycle-orange/30 hover:text-upcycle-orange"
          >
            Merge duplicates
          </button>
          <button
            type="button"
            onClick={onArchiveOpen}
            className="border border-carbon-blue/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/60 hover:border-upcycle-orange/30 hover:text-upcycle-orange"
          >
            {contact.IsArchived ? "Restore contact" : "Archive contact"}
          </button>
        </>
      ) : null}
    </div>
  );
}
