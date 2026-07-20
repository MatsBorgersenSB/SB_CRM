"use client";

import type { Contact } from "@/types/contact";
import { getContactDisplayName } from "@/types/contact";
import { formatRelativeTime } from "@/lib/relative-time";
import { EmailActionMenu, PhoneActionMenu } from "@/components/relationship/relationship-links";
import { ActionableField, SmartCRMIcon } from "@/components/ui/smartcrm-icon";

/**
 * Full-width balanced contact header — identity left, reachability right.
 */
export function ContactWorkspaceHeader({
  contact,
  lastInteractionDate,
}: {
  contact: Contact;
  lastInteractionDate?: string;
}) {
  const displayName = getContactDisplayName(contact);
  const phone = contact.Mobile || contact.Phone;

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 flex-1">
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-carbon-blue xl:text-[1.85rem]">
          <SmartCRMIcon name="contact" size="lg" label="Contact" />
          <span className="truncate">{displayName}</span>
        </h1>

        <p className="mt-2 text-sm text-carbon-blue/65">{contact.JobTitle || contact.Role || "—"}</p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="border border-carbon-blue/10 bg-carbon-blue/[0.03] px-2.5 py-1 text-[12px] font-medium text-carbon-blue/70">
            {contact.RelationshipLevel}
          </span>
          <span className="border border-carbon-blue/10 px-2.5 py-1 text-[12px] font-medium text-carbon-blue/70">
            {contact.Status}
          </span>
          <span className="border border-carbon-blue/10 px-2.5 py-1 text-[12px] font-medium text-carbon-blue/55">
            {contact.Role}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-2 text-[13px] text-carbon-blue/65 lg:min-w-[240px] lg:items-end lg:text-right xl:min-w-[280px]">
        {contact.Email ? (
          <ActionableField icon="email" className="lg:justify-end">
            <EmailActionMenu email={contact.Email} />
          </ActionableField>
        ) : null}
        {phone ? (
          <ActionableField icon="phone" className="lg:justify-end">
            <PhoneActionMenu phone={phone} />
          </ActionableField>
        ) : null}
        <p className="text-[13px] text-carbon-blue/55">
          Last interaction{" "}
          <span className="font-medium text-carbon-blue">
            {lastInteractionDate ? formatRelativeTime(lastInteractionDate) : "never recorded"}
          </span>
        </p>
      </div>
    </div>
  );
}
