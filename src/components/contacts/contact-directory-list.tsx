"use client";

import { useRouter } from "next/navigation";
import { getActivitiesForContact } from "@/lib/activity-utils";
import { formatRelativeTime } from "@/lib/relative-time";
import type { GlobalContactRecord } from "@/lib/contact-utils";
import { getContactDisplayName } from "@/types/contact";
import { contact360Href } from "@/types/relationship-navigation";
import {
  CompanyLink,
  EmailActionMenu,
  PhoneActionMenu,
} from "@/components/relationship/relationship-links";
import { SmartCRMIcon } from "@/components/ui/smartcrm-icon";
import type { Activity } from "@/types/activity";

type ContactDirectoryListProps = {
  records: GlobalContactRecord[];
  activities: Activity[];
};

function ContactDirectoryRow({
  record,
  activities,
  onNavigate,
}: {
  record: GlobalContactRecord;
  activities: Activity[];
  onNavigate: () => void;
}) {
  const { contact, companyId, companyName } = record;
  const displayName = getContactDisplayName(contact);
  const phone = contact.Mobile || contact.Phone;
  const lastActivity = getActivitiesForContact(activities, contact.ContactID)[0];

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={onNavigate}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onNavigate();
          }
        }}
        className="group w-full cursor-pointer border border-carbon-blue/8 bg-white px-4 py-4 text-left transition-colors hover:border-upcycle-orange/25 hover:bg-upcycle-orange/[0.02]"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-carbon-blue group-hover:text-upcycle-orange">
              <SmartCRMIcon name="contact" size="sm" />
              {displayName}
            </p>
            <p className="mt-0.5 text-[11px] text-carbon-blue/50">
              {contact.JobTitle || contact.Role}
              <span className="text-carbon-blue/25"> · </span>
              <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                <CompanyLink companyId={companyId} className="font-medium">
                  {companyName}
                </CompanyLink>
              </span>
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-carbon-blue/40">
              <SmartCRMIcon name="meeting" size="xs" />
              {lastActivity
                ? `Last ${formatRelativeTime(lastActivity.ActivityDate)}`
                : "No interaction"}
            </p>
          </div>

          <div
            className="flex shrink-0 flex-col items-start gap-1 text-[11px] sm:items-end"
            onClick={(e) => e.stopPropagation()}
          >
            {contact.Email ? <EmailActionMenu email={contact.Email} /> : null}
            {phone ? <PhoneActionMenu phone={phone} /> : null}
          </div>
        </div>
      </div>
    </li>
  );
}

/** Relationship-first contact directory — every row opens the living workspace. */
export function ContactDirectoryList({ records, activities }: ContactDirectoryListProps) {
  const router = useRouter();

  if (records.length === 0) {
    return (
      <p className="border border-dashed border-carbon-blue/15 px-6 py-10 text-center text-sm text-carbon-blue/45">
        No contacts yet. Add your first relationship above.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {records.map((record) => (
        <ContactDirectoryRow
          key={`${record.companyId}-${record.contact.ContactID}`}
          record={record}
          activities={activities}
          onNavigate={() =>
            router.push(
              contact360Href(record.contact.ContactID, record.companyId),
            )
          }
        />
      ))}
    </ul>
  );
}
