"use client";

import { getActivitiesForContact } from "@/lib/activity-utils";
import { formatRelativeTime } from "@/lib/relative-time";
import type { GlobalContactRecord } from "@/lib/contact-utils";
import { getContactDisplayName } from "@/types/contact";
import {
  CompanyLink,
  ContactLink,
  EmailActionMenu,
  PhoneActionMenu,
} from "@/components/relationship/relationship-links";
import { IconLabel } from "@/components/ui/smartcrm-icon";
import {
  WorkspaceTable,
  WorkspaceTableBody,
  WorkspaceTableBodyCell,
  WorkspaceTableBodyRow,
  WorkspaceTableHead,
  WorkspaceTableHeadCell,
  WorkspaceTableHeadRow,
} from "@/components/ui/workspace-table";
import type { Activity } from "@/types/activity";

export function ContactsOperationsTable({
  records,
  activities,
}: {
  records: GlobalContactRecord[];
  activities: Activity[];
}) {
  if (records.length === 0) {
    return (
      <p className="text-sm text-carbon-blue/45">
        No contacts match this filter. Try another view or broaden your search.
      </p>
    );
  }

  return (
    <WorkspaceTable>
      <colgroup>
        <col className="w-[18%]" />
        <col className="w-[14%]" />
        <col className="w-[16%]" />
        <col className="w-[18%]" />
        <col className="w-[12%]" />
        <col className="w-[10%]" />
        <col className="w-[10%]" />
        <col className="w-[10%]" />
      </colgroup>
      <WorkspaceTableHead>
        <WorkspaceTableHeadRow>
          <WorkspaceTableHeadCell>
            <IconLabel icon="contact" iconSize="xs">
              Name
            </IconLabel>
          </WorkspaceTableHeadCell>
          <WorkspaceTableHeadCell>Role</WorkspaceTableHeadCell>
          <WorkspaceTableHeadCell>Company</WorkspaceTableHeadCell>
          <WorkspaceTableHeadCell>
            <IconLabel icon="email" iconSize="xs">
              Email
            </IconLabel>
          </WorkspaceTableHeadCell>
          <WorkspaceTableHeadCell>
            <IconLabel icon="phone" iconSize="xs">
              Phone
            </IconLabel>
          </WorkspaceTableHeadCell>
          <WorkspaceTableHeadCell>Employment</WorkspaceTableHeadCell>
          <WorkspaceTableHeadCell>Status</WorkspaceTableHeadCell>
          <WorkspaceTableHeadCell>
            <IconLabel icon="meeting" iconSize="xs">
              Last Contact
            </IconLabel>
          </WorkspaceTableHeadCell>
        </WorkspaceTableHeadRow>
      </WorkspaceTableHead>
      <WorkspaceTableBody>
        {records.map((record) => {
          const phone = record.contact.Mobile || record.contact.Phone;
          const lastActivity = getActivitiesForContact(
            activities,
            record.contact.ContactID,
            record.contact,
          )[0];
          const role = record.contact.JobTitle || record.contact.Role || "—";

          return (
            <WorkspaceTableBodyRow key={`${record.companyId}-${record.contact.ContactID}`}>
              <WorkspaceTableBodyCell>
                <ContactLink
                  contactId={record.contact.ContactID}
                  companyId={record.companyId}
                  className="block truncate font-semibold text-carbon-blue hover:text-upcycle-orange"
                >
                  {getContactDisplayName(record.contact)}
                </ContactLink>
              </WorkspaceTableBodyCell>
              <WorkspaceTableBodyCell className="truncate text-carbon-blue/65">
                {role}
              </WorkspaceTableBodyCell>
              <WorkspaceTableBodyCell>
                <CompanyLink
                  companyId={record.companyId}
                  className="block truncate text-carbon-blue/75 hover:text-upcycle-orange"
                >
                  {record.companyName}
                </CompanyLink>
              </WorkspaceTableBodyCell>
              <WorkspaceTableBodyCell>
                {record.contact.Email ? (
                  <EmailActionMenu email={record.contact.Email} />
                ) : (
                  <span className="text-carbon-blue/35">—</span>
                )}
              </WorkspaceTableBodyCell>
              <WorkspaceTableBodyCell>
                {phone ? (
                  <PhoneActionMenu phone={phone} />
                ) : (
                  <span className="text-carbon-blue/35">—</span>
                )}
              </WorkspaceTableBodyCell>
              <WorkspaceTableBodyCell className="text-carbon-blue/65">
                {record.contact.EmploymentStatus ?? "Active"}
              </WorkspaceTableBodyCell>
              <WorkspaceTableBodyCell className="text-carbon-blue/65">
                {record.contact.IsArchived ? "Archived" : record.contact.Status}
              </WorkspaceTableBodyCell>
              <WorkspaceTableBodyCell className="text-carbon-blue/55">
                {lastActivity
                  ? formatRelativeTime(lastActivity.ActivityDate)
                  : "No interaction"}
              </WorkspaceTableBodyCell>
            </WorkspaceTableBodyRow>
          );
        })}
      </WorkspaceTableBody>
    </WorkspaceTable>
  );
}
