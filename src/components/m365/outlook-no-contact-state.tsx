"use client";

import { useState } from "react";
import { OutlookAddContactDialog } from "@/components/m365/outlook-add-contact-dialog";
import { buildSmartCrmUrl } from "@/lib/m365/outlook-context";

export function OutlookNoContactState({
  email,
  displayName,
  onContactCreated,
}: {
  email: string;
  displayName?: string | null;
  onContactCreated: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <div className="flex h-[100dvh] flex-col justify-center bg-white px-6">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
          SmartCRM
        </p>
        <p className="mt-2 text-sm font-semibold text-carbon-blue">No relationship context</p>
        <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/50">
          This contact is not currently in SmartCRM.
        </p>
        <p className="mt-3 text-[10px] text-carbon-blue/35">{email}</p>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="mt-5 border border-upcycle-orange bg-upcycle-orange px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-white"
        >
          Add to SmartCRM
        </button>
        <a
          href={buildSmartCrmUrl("/companies")}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 text-center text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45 hover:text-upcycle-orange"
        >
          Open SmartCRM
        </a>
      </div>

      <OutlookAddContactDialog
        open={dialogOpen}
        email={email}
        displayName={displayName}
        onClose={() => setDialogOpen(false)}
        onCreated={onContactCreated}
      />
    </>
  );
}
