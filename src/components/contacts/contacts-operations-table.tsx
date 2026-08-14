"use client";

import { getActivitiesForContact } from "@/lib/activity-utils";
import { formatLastContact, formatRelativeTime } from "@/lib/relative-time";
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

const cellTruncate = "min-w-0 max-w-full overflow-hidden";
const textTruncate = "block min-w-0 truncate";

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
    <div className="w-full overflow-x-auto">
      <WorkspaceTable className="min-w-[80rem]">
        <colgroup>
          <col className="min-w-[10rem] w-[13%]" />
          <col className="min-w-[8rem] w-[10%]" />
          <col className="min-w-[9rem] w-[12%]" />
          <col className="min-w-[10rem] w-[12%]" />
          <col className="min-w-[14rem] w-[16%]" />
          <col className="min-w-[9rem] w-[11%]" />
          <col className="min-w-[7rem] w-[9%]" />
          <col className="min-w-[6rem] w-[8%]" />
          <col className="min-w-[8rem] w-[9%]" />
        </colgroup>
        <WorkspaceTableHead>
          <WorkspaceTableHeadRow>
            <WorkspaceTableHeadCell className="min-w-[10rem]">
              <IconLabel icon="contact" iconSize="xs">
                Name
              </IconLabel>
            </WorkspaceTableHeadCell>
            <WorkspaceTableHeadCell className="min-w-[8rem]">Role</WorkspaceTableHeadCell>
            <WorkspaceTableHeadCell className="min-w-[9rem]">Buying role</WorkspaceTableHeadCell>
            <WorkspaceTableHeadCell className="min-w-[10rem]">Company</WorkspaceTableHeadCell>
            <WorkspaceTableHeadCell className="min-w-[14rem]">
              <IconLabel icon="email" iconSize="xs">
                Email
              </IconLabel>
            </WorkspaceTableHeadCell>
            <WorkspaceTableHeadCell className="min-w-[9rem]">
              <IconLabel icon="phone" iconSize="xs">
                Phone
              </IconLabel>
            </WorkspaceTableHeadCell>
            <WorkspaceTableHeadCell className="min-w-[7rem]">Employment</WorkspaceTableHeadCell>
            <WorkspaceTableHeadCell className="min-w-[6rem]">Status</WorkspaceTableHeadCell>
            <WorkspaceTableHeadCell className="min-w-[8rem]">
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
                <WorkspaceTableBodyCell className={cellTruncate}>
                  <ContactLink
                    contactId={record.contact.ContactID}
                    companyId={record.companyId}
                    className={`${textTruncate} font-semibold text-carbon-blue hover:text-upcycle-orange`}
                  >
                    {getContactDisplayName(record.contact)}
                  </ContactLink>
                </WorkspaceTableBodyCell>
                <WorkspaceTableBodyCell className={`${cellTruncate} text-carbon-blue/65`}>
                  <span className={textTruncate} title={role}>
                    {role}
                  </span>
                </WorkspaceTableBodyCell>
                <WorkspaceTableBodyCell className={cellTruncate}>
                  {record.contact.buyingRole ? (
                    <span className={`${textTruncate} text-carbon-blue/70`}>
                      {record.contact.buyingRole}
                    </span>
                  ) : (
                    <span className={`${textTruncate} font-medium text-upcycle-orange`}>
                      Unknown
                    </span>
                  )}
                </WorkspaceTableBodyCell>
                <WorkspaceTableBodyCell className={cellTruncate}>
                  <CompanyLink
                    companyId={record.companyId}
                    className={`${textTruncate} text-carbon-blue/75 hover:text-upcycle-orange`}
                  >
                    {record.companyName}
                  </CompanyLink>
                </WorkspaceTableBodyCell>
                <WorkspaceTableBodyCell className={cellTruncate}>
                  {record.contact.Email ? (
                    <EmailActionMenu
                      email={record.contact.Email}
                      className={`${textTruncate} max-w-full`}
                    />
                  ) : (
                    <span className="text-carbon-blue/35">—</span>
                  )}
                </WorkspaceTableBodyCell>
                <WorkspaceTableBodyCell className={cellTruncate}>
                  {phone ? (
                    <PhoneActionMenu phone={phone} className={`${textTruncate} max-w-full`} />
                  ) : (
                    <span className="text-carbon-blue/35">—</span>
                  )}
                </WorkspaceTableBodyCell>
                <WorkspaceTableBodyCell className={`${cellTruncate} text-carbon-blue/65`}>
                  <span className={textTruncate}>
                    {record.contact.EmploymentStatus ?? "Active"}
                  </span>
                </WorkspaceTableBodyCell>
                <WorkspaceTableBodyCell className={`${cellTruncate} text-carbon-blue/65`}>
                  <span className={textTruncate}>
                    {record.contact.IsArchived ? "Archived" : record.contact.Status}
                  </span>
                </WorkspaceTableBodyCell>
                <WorkspaceTableBodyCell className={`${cellTruncate} text-carbon-blue/55`}>
                  <span className={textTruncate}>
                    {lastActivity
                      ? formatRelativeTime(lastActivity.ActivityDate)
                      : formatLastContact(null)}
                  </span>
                </WorkspaceTableBodyCell>
              </WorkspaceTableBodyRow>
            );
          })}
        </WorkspaceTableBody>
      </WorkspaceTable>
    </div>
  );
}
