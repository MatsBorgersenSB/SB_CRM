"use client";

import { useState } from "react";
import { OutlookAddContactDialog } from "@/components/m365/outlook-add-contact-dialog";
import { OutlookAddOpportunityDialog } from "@/components/m365/outlook-add-opportunity-dialog";
import { buildSmartCrmUrl } from "@/lib/m365/outlook-context";
import type { OutlookAddContactResult } from "@/lib/m365/outlook-sender-types";

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
  const [created, setCreated] = useState<OutlookAddContactResult | null>(null);
  const [opportunityOpen, setOpportunityOpen] = useState(false);

  return (
    <>
      <div className="flex h-[100dvh] flex-col justify-center bg-white px-6">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
          SmartCRM
        </p>
        {created ? (
          <>
            <p className="mt-2 text-sm font-semibold text-carbon-blue">Added to SmartCRM</p>
            <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/50">
              {created.companyCreated
                ? "Contact and company created. Create an opportunity if this mail is a real deal."
                : "Contact linked to the existing company. Create an opportunity if this mail is a real deal."}
            </p>
            <button
              type="button"
              onClick={() => setOpportunityOpen(true)}
              className="mt-5 border border-upcycle-orange bg-upcycle-orange px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-white"
            >
              Create opportunity
            </button>
            <button
              type="button"
              onClick={onContactCreated}
              className="mt-3 text-center text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45 hover:text-upcycle-orange"
            >
              Open relationship card
            </button>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm font-semibold text-carbon-blue">No relationship context</p>
            <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/50">
              This person is not in SmartCRM yet. Add the contact — and create the company only
              when it is not already known.
            </p>
            <p className="mt-3 text-[10px] text-carbon-blue/35">{email}</p>
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="mt-5 border border-upcycle-orange bg-upcycle-orange px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-white"
            >
              Add contact / company
            </button>
            <a
              href={buildSmartCrmUrl("/companies")}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 text-center text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45 hover:text-upcycle-orange"
            >
              Open SmartCRM
            </a>
          </>
        )}
      </div>

      <OutlookAddContactDialog
        open={dialogOpen}
        email={email}
        displayName={displayName}
        onClose={() => setDialogOpen(false)}
        onCreated={(result) => {
          setCreated(result);
          setDialogOpen(false);
        }}
      />

      {created ? (
        <OutlookAddOpportunityDialog
          open={opportunityOpen}
          companyId={created.companyId}
          companyName={created.relationshipCard?.companyName ?? "Company"}
          onClose={() => setOpportunityOpen(false)}
          onCreated={() => {
            setOpportunityOpen(false);
            onContactCreated();
          }}
        />
      ) : null}
    </>
  );
}
