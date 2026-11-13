"use client";

import { useState } from "react";
import { OutlookMailTagPanel } from "@/components/m365/outlook-mail-tag-panel";
import type { UserRole } from "@/types/auth";

/**
 * Secondary Outlook action: save / link mail.
 * Collapsed by default so the Relationship Card owns the first three seconds.
 */
export function OutlookMailSaveExpander({
  email,
  opportunityEligible,
  role,
}: {
  email: string;
  opportunityEligible?: boolean;
  role?: UserRole;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-carbon-blue/10 bg-white">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
      >
        <span>
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-carbon-blue">
            Save / link this mail
          </span>
          <span className="mt-0.5 block text-[11px] leading-snug text-carbon-blue/55">
            Optional — file onto contact, project, or opportunity
          </span>
        </span>
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-upcycle-orange">
          {open ? "Hide" : "Open"}
        </span>
      </button>
      {open ? (
        <div className="border-t border-carbon-blue/8 px-1 pb-1">
          <OutlookMailTagPanel
            email={email}
            opportunityEligible={opportunityEligible}
            role={role}
          />
        </div>
      ) : null}
    </div>
  );
}
