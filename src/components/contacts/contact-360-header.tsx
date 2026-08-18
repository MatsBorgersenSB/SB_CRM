"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { Contact } from "@/types/contact";
import { getContactDisplayName } from "@/types/contact";
import { CompanyLink } from "@/components/relationship/relationship-links";
import { EmailActionMenu, PhoneActionMenu } from "@/components/relationship/relationship-links";
import { ActionableField, SmartCRMIcon } from "@/components/ui/smartcrm-icon";
import { Contact360StatusPanel } from "@/components/contacts/contact-360-status-panel";
import type { EmploymentStatus } from "@/types/contact-lifecycle";
import type { RelationshipHealthStatus } from "@/lib/relationship-intelligence";
import type { Contact360Verdict } from "@/lib/contact-360-verdict";

function localTimeString(timezone: string | undefined, now: Date): string | null {
  if (!timezone?.trim()) return null;
  try {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      day: "2-digit",
      month: "short",
      timeZone: timezone,
    }).format(now);
  } catch {
    return null;
  }
}

/**
 * Contact 360 hero — who, what matters, what next.
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
  trailing,
  verdict,
}: {
  contact: Contact;
  companyId: string;
  companyName: string;
  lastInteractionDate?: string;
  healthStatus: RelationshipHealthStatus;
  employmentBusy?: boolean;
  onEmploymentStatusChange: (status: EmploymentStatus) => void;
  editing?: boolean;
  trailing?: ReactNode;
  verdict?: Contact360Verdict;
}) {
  const displayName = getContactDisplayName(contact);
  const position = contact.JobTitle || contact.Role || "—";
  const phone = contact.Mobile || contact.Phone;
  const [clockNow, setClockNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setClockNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const localTime = localTimeString(contact.timezone, clockNow);

  return (
    <div className="flex flex-col gap-4 border border-carbon-blue/10 bg-white p-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h1 className="flex min-w-0 items-center gap-2.5 text-2xl font-semibold tracking-tight text-carbon-blue xl:text-[1.85rem]">
            <SmartCRMIcon name="contact" size="lg" label="Contact" />
            <span className="truncate">{displayName}</span>
            {contact.IsArchived ? (
              <span className="shrink-0 border border-carbon-blue/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/45">
                Archived
              </span>
            ) : null}
          </h1>
          {trailing ? <div className="shrink-0 pt-1">{trailing}</div> : null}
        </div>

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

        {verdict ? (
          <div className="mt-3 max-w-xl">
            <p className="text-[15px] leading-snug text-carbon-blue">{verdict.summary}</p>
            <p className="mt-1 text-[13px] leading-snug text-carbon-blue/70">
              <span className="font-medium text-upcycle-orange">Next </span>
              {verdict.nextAction}
            </p>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          {localTime ? (
            <span className="border border-carbon-blue/12 bg-carbon-blue/[0.03] px-2.5 py-1 text-[11px] font-medium text-carbon-blue/70">
              Local time {localTime}
            </span>
          ) : null}
          <span className="border border-carbon-blue/12 bg-carbon-blue/[0.03] px-2.5 py-1 text-[11px] font-medium text-carbon-blue/70">
            Buying role {contact.buyingRole ?? "Unknown"}
          </span>
        </div>
      </div>

      <Contact360StatusPanel
        contact={contact}
        companyName={companyName}
        lastInteractionDate={lastInteractionDate}
        lastInteractionSource={verdict?.lastInteractionSource ?? null}
        healthStatus={healthStatus}
        employmentBusy={employmentBusy}
        onEmploymentStatusChange={onEmploymentStatusChange}
        editing={editing}
      />
    </div>
  );
}
