"use client";

import type { Contact } from "@/types/contact";
import { getContactDisplayName } from "@/types/contact";
import { CompanyLink } from "@/components/relationship/relationship-links";
import { EmailActionMenu, PhoneActionMenu } from "@/components/relationship/relationship-links";
import { ActionableField, SmartCRMIcon } from "@/components/ui/smartcrm-icon";
import { Contact360StatusPanel } from "@/components/contacts/contact-360-status-panel";
import type { EmploymentStatus } from "@/types/contact-lifecycle";
import type { RelationshipHealthStatus } from "@/lib/relationship-intelligence";

/**
 * Contact 360 hero — identity and reachability on the left, status on the upper-right (Phase 1.28B).
 */
export function Contact360Header({
  contact,
  companyId,
  companyName,
  lastInteractionDate,
  healthStatus,
  employmentBusy,
  onEmploymentStatusChange,
  editing = false,
}: {
  contact: Contact;
  companyId: string;
  companyName: string;
  lastInteractionDate?: string;
  healthStatus: RelationshipHealthStatus;
  employmentBusy?: boolean;
  onEmploymentStatusChange: (status: EmploymentStatus) => void;
  editing?: boolean;
}) {
  const displayName = getContactDisplayName(contact);
  const position = contact.JobTitle || contact.Role || "—";
  const phone = contact.Mobile || contact.Phone;

  return (
    <div className="flex flex-col gap-4 border border-carbon-blue/10 bg-white p-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 flex-1">
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-carbon-blue xl:text-[1.85rem]">
          <SmartCRMIcon name="contact" size="lg" label="Contact" />
          <span className="truncate">{displayName}</span>
          {contact.IsArchived ? (
            <span className="shrink-0 border border-carbon-blue/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/45">
              Archived
            </span>
          ) : null}
        </h1>

        <p className="mt-2 text-sm text-carbon-blue/65">{position}</p>

        <p className="mt-1.5 text-sm text-carbon-blue/60">
          <CompanyLink companyId={companyId} className="font-medium hover:text-upcycle-orange">
            {companyName}
          </CompanyLink>
        </p>

        <div className="mt-3 flex flex-col gap-1.5 text-[13px] text-carbon-blue/65">
          {contact.Email ? (
            <ActionableField icon="email">
              <EmailActionMenu email={contact.Email} />
            </ActionableField>
          ) : (
            <p className="text-carbon-blue/45">No email on file</p>
          )}
          {phone ? (
            <ActionableField icon="phone">
              <PhoneActionMenu phone={phone} />
            </ActionableField>
          ) : (
            <p className="text-carbon-blue/45">No phone on file</p>
          )}
        </div>
      </div>

      <Contact360StatusPanel
        contact={contact}
        lastInteractionDate={lastInteractionDate}
        healthStatus={healthStatus}
        employmentBusy={employmentBusy}
        onEmploymentStatusChange={onEmploymentStatusChange}
        editing={editing}
      />
    </div>
  );
}
