"use client";

import { useMemo, useState } from "react";
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
import { CompanyOwnerSelect } from "@/components/companies/company-owner-select";
import { CompanyLink, ContactLink, EmailActionMenu } from "@/components/relationship/relationship-links";
import { formatAccountOwnerDisplay, hasContactOwner } from "@/lib/company-owner";
import type { Company, SharePointPerson } from "@/types/company";
import type { StandardBioUserRecord } from "@/types/user-access";
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

type SortKey = "name" | "role" | "buyingRole" | "company" | "owner" | "lastTouch";

const SORT_COLUMNS: [SortKey, string][] = [
  ["name", "Name"],
  ["role", "Role"],
  ["buyingRole", "Buying role"],
  ["company", "Company"],
  ["owner", "Owner"],
  ["lastTouch", "Last touch"],
];

const cellTruncate = "min-w-0 max-w-full overflow-hidden";
const textTruncate = "block min-w-0 truncate";

/**
 * People list — six columns.
 * Name · Role · Buying role · Company · Owner · Last touch
 * Buying role and owner are the two decisions a user can make from this list.
 */
export function ContactsOperationsTable({
  records,
  activities,
  lastMailByEmail = {},
  companies = [],
  assignableUsers = [],
  canReassignOwner = false,
  savingOwnerId = null,
  onContactUpdate,
  onOwnerChange,
}: {
  records: GlobalContactRecord[];
  activities: Activity[];
  /** Lowercased email → latest synced Outlook mail with that person. */
  lastMailByEmail?: Record<string, string>;
  companies?: Company[];
  assignableUsers?: StandardBioUserRecord[];
  canReassignOwner?: boolean;
  savingOwnerId?: string | null;
  /** When provided, buying role becomes an inline selector persisted through this handler. */
  onContactUpdate?: (companyId: string, contactId: string, patch: UpdateContactInput) => Promise<void>;
  onOwnerChange?: (companyId: string, contactId: string, owner: SharePointPerson) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);

  const rows = useMemo(() => {
    const enriched = records.map((record) => {
      const lastActivity = getActivitiesForContact(
        activities,
        record.contact.ContactID,
        record.contact,
      )[0];
      const lastMailAt = record.contact.Email
        ? lastMailByEmail[record.contact.Email.trim().toLowerCase()] ?? null
        : null;
      const lastTouchAt = laterIso(lastActivity?.ActivityDate ?? null, lastMailAt);
      return { record, lastMailAt, lastTouchAt };
    });
    if (!sort) return enriched;

    const text = (row: (typeof enriched)[number]): string | null => {
      const { contact } = row.record;
      switch (sort.key) {
        case "name":
          return getContactDisplayName(contact).trim() || null;
        case "role":
          return (contact.JobTitle || contact.Role || "").trim() || null;
        case "buyingRole":
          return isBuyingRoleUnknown(contact.buyingRole) ? null : String(contact.buyingRole);
        case "company":
          return row.record.companyName?.trim() || null;
        case "owner":
          return hasContactOwner(contact)
            ? formatAccountOwnerDisplay(contact.ContactOwner)?.trim() || null
            : null;
        default:
          return null;
      }
    };
    const dirFactor = sort.dir === "asc" ? 1 : -1;
    return [...enriched].sort((a, b) => {
      // Empty values always sink to the bottom, whichever direction.
      if (sort.key === "lastTouch") {
        const av = a.lastTouchAt ? Date.parse(a.lastTouchAt) : null;
        const bv = b.lastTouchAt ? Date.parse(b.lastTouchAt) : null;
        if (av === null && bv === null) return 0;
        if (av === null) return 1;
        if (bv === null) return -1;
        return (av - bv) * dirFactor;
      }
      const av = text(a);
      const bv = text(b);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return av.localeCompare(bv, undefined, { sensitivity: "base", numeric: true }) * dirFactor;
    });
  }, [records, activities, lastMailByEmail, sort]);

  /** Click cycles: ascending → descending → original order. */
  const toggleSort = (key: SortKey) =>
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: key === "lastTouch" ? "desc" : "asc" };
      const firstDir = key === "lastTouch" ? "desc" : "asc";
      return prev.dir === firstDir ? { key, dir: firstDir === "asc" ? "desc" : "asc" } : null;
    });
  const dirFor = (key: SortKey) => (sort?.key === key ? sort.dir : null);

  if (records.length === 0) {
    return (
      <p className="text-sm text-carbon-blue/65">
        No contacts match this filter. Try another view or broaden your search.
      </p>
    );
  }

  return (
    <div className="w-full">
      <WorkspaceTable>
        <colgroup>
          <col className="w-[22%]" />
          <col className="w-[14%]" />
          <col className="w-[16%]" />
          <col className="w-[16%]" />
          <col className="w-[16%]" />
          <col className="w-[16%]" />
        </colgroup>
        <WorkspaceTableHead>
          <WorkspaceTableHeadRow>
            {SORT_COLUMNS.map(([key, label]) => (
              <WorkspaceTableHeadCell
                key={key}
                sortDirection={dirFor(key)}
                onSort={() => toggleSort(key)}
              >
                {label}
              </WorkspaceTableHeadCell>
            ))}
          </WorkspaceTableHeadRow>
        </WorkspaceTableHead>
        <WorkspaceTableBody>
          {rows.map(({ record, lastMailAt, lastTouchAt }) => {
            const role = record.contact.JobTitle || record.contact.Role || "—";

            return (
              <WorkspaceTableBodyRow key={`${record.companyId}-${record.contact.ContactID}`}>
                <WorkspaceTableBodyCell className={cellTruncate}>
                  <span className="flex min-w-0 items-center gap-2">
                    <ContactLink
                      contactId={record.contact.ContactID}
                      companyId={record.companyId}
                      showIcon={false}
                      className={`${textTruncate} font-semibold text-carbon-blue hover:text-upcycle-orange`}
                    >
                      {getContactDisplayName(record.contact)}
                    </ContactLink>
                    {record.contact.IsArchived ? (
                      <span className="shrink-0 border border-carbon-blue/15 px-1 text-[11px] uppercase tracking-wide text-carbon-blue/50">
                        Archived
                      </span>
                    ) : null}
                  </span>
                  {record.contact.Email ? (
                    <EmailActionMenu
                      email={record.contact.Email}
                      showIcon={false}
                      className={`${textTruncate} max-w-full text-[13px] text-carbon-blue/60`}
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
                    showIcon={false}
                    className={`${textTruncate} text-carbon-blue/75 hover:text-upcycle-orange`}
                  >
                    {record.companyName}
                  </CompanyLink>
                </WorkspaceTableBodyCell>
                <WorkspaceTableBodyCell className={cellTruncate}>
                  {canReassignOwner && onOwnerChange ? (
                    <CompanyOwnerSelect
                      appearance="inline"
                      label={`Owner for ${getContactDisplayName(record.contact)}`}
                      companies={companies}
                      assignableUsers={assignableUsers}
                      extraUsers={
                        record.contact.ContactOwner ? [record.contact.ContactOwner] : []
                      }
                      value={
                        hasContactOwner(record.contact)
                          ? record.contact.ContactOwner ?? null
                          : null
                      }
                      disabled={savingOwnerId === record.contact.ContactID}
                      onChange={(owner) =>
                        onOwnerChange(record.companyId, record.contact.ContactID, owner)
                      }
                    />
                  ) : (
                    <span className={`${textTruncate} text-carbon-blue/65`}>
                      {formatAccountOwnerDisplay(record.contact.ContactOwner) ?? "Unassigned"}
                    </span>
                  )}
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
      <span className={`${textTruncate} ${unknown ? "text-carbon-blue/65" : "text-carbon-blue/75"}`}>
        {unknown ? "Not set" : buyingRole}
      </span>
    );
  }

  // Unknown is the normal state for most people — a quiet dashed affordance, not an alarm.
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
      className={`w-full min-w-0 bg-transparent px-1.5 py-1 text-[13px] outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40 ${
        unknown
          ? "border border-dashed border-carbon-blue/25 text-carbon-blue/50 hover:border-carbon-blue/45"
          : "border border-transparent text-carbon-blue hover:border-carbon-blue/20"
      }`}
    />
  );
}
