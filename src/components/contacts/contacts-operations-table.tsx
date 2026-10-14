"use client";

import { useState } from "react";
import { getActivitiesForContact } from "@/lib/activity-utils";
import { laterIso } from "@/lib/contact-360-verdict";
import { formatLastContact, formatRelativeTime } from "@/lib/relative-time";
import type { GlobalContactRecord } from "@/lib/contact-utils";
import {
  getContactDisplayName,
  isBuyingRoleUnknown,
  type BuyingRole,
  type Contact,
  type UpdateContactInput,
} from "@/types/contact";
import { BuyingRoleSelect } from "@/components/contacts/contact-form-fields";
import { CompanyLink, ContactLink, EmailActionMenu } from "@/components/relationship/relationship-links";
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

/**
 * People list — five columns.
 * Name · Role at company · Buying role (editable) · Company · Last touch
 * Buying role is the one thing a user can fix from this list in two seconds, so it is a selector.
 */
export function ContactsOperationsTable({
  records,
  activities,
  lastMailByEmail = {},
  onContactUpdate,
}: {
  records: GlobalContactRecord[];
  activities: Activity[];
  /** Lowercased email → latest synced Outlook mail with that person. */
  lastMailByEmail?: Record<string, string>;
  /** When provided, buying role becomes an inline selector persisted through this handler. */
  onContactUpdate?: (companyId: string, contactId: string, patch: UpdateContactInput) => Promise<void>;
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
      <WorkspaceTable className="min-w-[56rem]">
        <colgroup>
          <col className="w-[26%]" />
          <col className="w-[20%]" />
          <col className="w-[16%]" />
          <col className="w-[22%]" />
          <col className="w-[16%]" />
        </colgroup>
        <WorkspaceTableHead>
          <WorkspaceTableHeadRow>
            <WorkspaceTableHeadCell>
              <IconLabel icon="contact" iconSize="xs">
                Name
              </IconLabel>
            </WorkspaceTableHeadCell>
            <WorkspaceTableHeadCell>Role</WorkspaceTableHeadCell>
            <WorkspaceTableHeadCell>Buying role</WorkspaceTableHeadCell>
            <WorkspaceTableHeadCell>Company</WorkspaceTableHeadCell>
            <WorkspaceTableHeadCell>
              <IconLabel icon="meeting" iconSize="xs">
                Last touch
              </IconLabel>
            </WorkspaceTableHeadCell>
          </WorkspaceTableHeadRow>
        </WorkspaceTableHead>
        <WorkspaceTableBody>
          {records.map((record) => {
            const lastActivity = getActivitiesForContact(
              activities,
              record.contact.ContactID,
              record.contact,
            )[0];
            const lastMailAt = record.contact.Email
              ? lastMailByEmail[record.contact.Email.trim().toLowerCase()] ?? null
              : null;
            const lastTouchAt = laterIso(lastActivity?.ActivityDate ?? null, lastMailAt);
            const role = record.contact.JobTitle || record.contact.Role || "—";

            return (
              <WorkspaceTableBodyRow key={`${record.companyId}-${record.contact.ContactID}`}>
                <WorkspaceTableBodyCell className={cellTruncate}>
                  <span className="flex min-w-0 items-center gap-2">
                    <ContactLink
                      contactId={record.contact.ContactID}
                      companyId={record.companyId}
                      className={`${textTruncate} font-semibold text-carbon-blue hover:text-upcycle-orange`}
                    >
                      {getContactDisplayName(record.contact)}
                    </ContactLink>
                    {record.contact.IsArchived ? (
                      <span className="shrink-0 border border-carbon-blue/15 px-1 text-[10px] uppercase tracking-wide text-carbon-blue/50">
                        Archived
                      </span>
                    ) : null}
                  </span>
                  {record.contact.Email ? (
                    <EmailActionMenu
                      email={record.contact.Email}
                      className={`${textTruncate} max-w-full text-[11px] text-carbon-blue/50`}
                    />
                  ) : null}
                </WorkspaceTableBodyCell>
                <WorkspaceTableBodyCell className={`${cellTruncate} text-carbon-blue/65`}>
                  <span className={textTruncate} title={role}>
                    {role}
                  </span>
                </WorkspaceTableBodyCell>
                <WorkspaceTableBodyCell className={cellTruncate}>
                  <BuyingRoleCell
                    contact={record.contact}
                    companyId={record.companyId}
                    onContactUpdate={onContactUpdate}
                  />
                </WorkspaceTableBodyCell>
                <WorkspaceTableBodyCell className={cellTruncate}>
                  <CompanyLink
                    companyId={record.companyId}
                    className={`${textTruncate} text-carbon-blue/75 hover:text-upcycle-orange`}
                  >
                    {record.companyName}
                  </CompanyLink>
                </WorkspaceTableBodyCell>
                <WorkspaceTableBodyCell className={`${cellTruncate} text-carbon-blue/55`}>
                  <span
                    className={textTruncate}
                    title={lastMailAt && lastTouchAt === lastMailAt ? "Latest synced Outlook mail" : undefined}
                  >
                    {lastTouchAt ? formatRelativeTime(lastTouchAt) : formatLastContact(null)}
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

function BuyingRoleCell({
  contact,
  companyId,
  onContactUpdate,
}: {
  contact: Contact;
  companyId: string;
  onContactUpdate?: (companyId: string, contactId: string, patch: UpdateContactInput) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const buyingRole = contact.buyingRole;
  const unknown = isBuyingRoleUnknown(buyingRole);

  if (!onContactUpdate) {
    return (
      <span
        className={
          unknown ? `${textTruncate} font-medium text-upcycle-orange` : `${textTruncate} text-carbon-blue/70`
        }
      >
        {buyingRole ?? "Unknown"}
      </span>
    );
  }

  return (
    <BuyingRoleSelect
      value={buyingRole}
      disabled={busy}
      onChange={(next) => {
        setBusy(true);
        void onContactUpdate(companyId, contact.ContactID, {
          buyingRole: (next ?? "") as BuyingRole,
        }).finally(() => setBusy(false));
      }}
      className={`w-full min-w-0 border bg-white px-1.5 py-1 text-[12px] outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40 ${
        unknown ? "border-upcycle-orange/35 text-upcycle-orange" : "border-carbon-blue/15 text-carbon-blue"
      }`}
    />
  );
}
