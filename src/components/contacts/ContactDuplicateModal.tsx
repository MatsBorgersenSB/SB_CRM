"use client";

import type { DedupContactSummary } from "@/lib/validation/deduplication-types";
import { contact360Href } from "@/types/relationship-navigation";
import { SmartCRMIcon } from "@/components/ui/smartcrm-icon";

export type ContactDuplicateChoice =
  | { action: "use_existing"; contact: DedupContactSummary }
  | { action: "update_existing"; contact: DedupContactSummary }
  | { action: "create_distinct" }
  | { action: "cancel" };

type ContactDuplicateModalProps = {
  open: boolean;
  matches: DedupContactSummary[];
  pendingName: string;
  onChoose: (choice: ContactDuplicateChoice) => void;
};

/**
 * Disambiguation when a soft name match is found during contact create/edit.
 * SmartAssist recommends; the user decides.
 */
export function ContactDuplicateModal({
  open,
  matches,
  pendingName,
  onChoose,
}: ContactDuplicateModalProps) {
  if (!open || matches.length === 0) return null;

  const primary = matches[0]!;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-carbon-blue/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-duplicate-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-carbon-blue/15 bg-[var(--dashboard-surface)] shadow-lg">
        <header className="border-b border-carbon-blue/10 px-4 py-3">
          <p
            id="contact-duplicate-title"
            className="text-[14px] font-semibold text-carbon-blue"
          >
            ⚠️ Potential Duplicate Contact Found
          </p>
          <p className="mt-1 text-[12px] text-carbon-blue/60">
            Similar records already exist for{" "}
            <span className="font-semibold text-carbon-blue">{pendingName}</span>. Choose how
            to proceed — the system recommends reusing existing knowledge.
          </p>
        </header>

        <div className="space-y-3 px-4 py-3">
          {matches.map((contact) => (
            <div
              key={contact.id}
              className="border border-carbon-blue/10 bg-carbon-blue/[0.02] px-3 py-2.5"
            >
              <p className="text-[13px] font-semibold text-carbon-blue">{contact.fullName}</p>
              <p className="mt-0.5 text-[11px] text-carbon-blue/60">
                {contact.companyName}
                {contact.jobTitle ? ` · ${contact.jobTitle}` : ""}
              </p>
              <p className="mt-0.5 text-[11px] text-carbon-blue/50">
                {contact.email || "No email on file"}
              </p>
              <a
                href={
                  contact.companyId
                    ? contact360Href(contact.contactId, contact.companyId)
                    : contact360Href(contact.contactId)
                }
                className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-upcycle-orange hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                <SmartCRMIcon name="contact" size="xs" />
                Open contact
              </a>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t border-carbon-blue/10 px-4 py-3">
          <button
            type="button"
            onClick={() => onChoose({ action: "use_existing", contact: primary })}
            className="border border-upcycle-orange bg-upcycle-orange px-3 py-2 text-[12px] font-semibold text-white hover:bg-upcycle-orange/90"
          >
            Use Existing Contact
          </button>
          <button
            type="button"
            onClick={() => onChoose({ action: "update_existing", contact: primary })}
            className="border border-carbon-blue/20 bg-white px-3 py-2 text-[12px] font-semibold text-carbon-blue hover:border-carbon-blue/40"
          >
            Update Existing Contact
          </button>
          <button
            type="button"
            onClick={() => onChoose({ action: "create_distinct" })}
            className="border border-carbon-blue/15 bg-carbon-blue/[0.03] px-3 py-2 text-[12px] font-semibold text-carbon-blue/70 hover:border-carbon-blue/30"
          >
            Create as Distinct Person
          </button>
          <button
            type="button"
            onClick={() => onChoose({ action: "cancel" })}
            className="px-3 py-1.5 text-[11px] font-semibold text-carbon-blue/45 hover:text-carbon-blue"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
