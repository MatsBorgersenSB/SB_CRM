"use client";

import { useEffect, useMemo, useState } from "react";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { Contact, CreateContactInput, UpdateContactInput } from "@/types/contact";
import type { Project } from "@/types/project";
import { getContactDisplayName } from "@/types/contact";
import { getContactProjectRolesOnCompany } from "@/lib/project-team-utils";
import { getActivitiesForContact } from "@/lib/activity-utils";
import { formatRelativeTime } from "@/lib/relative-time";
import { canDeleteContact } from "@/lib/permissions";
import type { UserRole } from "@/types/auth";
import {
  ContactLink,
  EmailActionMenu,
  PhoneActionMenu,
} from "@/components/relationship/relationship-links";
import {
  ContactFormFields,
  emptyContactForm,
  isContactFormValid,
} from "@/components/contacts/contact-form-fields";
import { ActionMenu, ActionMenuItem } from "@/components/relationship/action-menu";
import { DestructiveConfirmPanel } from "@/components/ui/destructive-confirm-panel";
import { IconLabel, SmartCRMIcon } from "@/components/ui/smartcrm-icon";

type ContactRowAction =
  | { contactId: string; type: "reassign" }
  | { contactId: string; type: "delete" }
  | { contactId: string; type: "archive" };

function ContactRowActions({
  contact,
  companyId,
  companies,
  role,
  activeAction,
  onActionChange,
  onContactUpdate,
  onContactDelete,
  onContactReassign,
  onContactArchive,
}: {
  contact: Contact;
  companyId: string;
  companies: Company[];
  role: UserRole;
  activeAction: ContactRowAction | null;
  onActionChange: (action: ContactRowAction | null) => void;
  onContactUpdate?: (contactId: string, patch: UpdateContactInput) => Promise<void>;
  onContactDelete?: (contactId: string) => Promise<void>;
  onContactReassign?: (contactId: string, targetCompanyId: string) => Promise<void>;
  onContactArchive?: (contactId: string, archived: boolean) => Promise<void>;
}) {
  const canManage = canDeleteContact(role);
  const [busy, setBusy] = useState(false);
  const [targetCompanyId, setTargetCompanyId] = useState("");

  const reassignOptions = useMemo(
    () =>
      companies
        .filter((company) => company.CompanyID !== companyId)
        .sort((a, b) => a.Title.localeCompare(b.Title)),
    [companies, companyId],
  );

  if (!canManage) return null;

  const isReassignOpen =
    activeAction?.contactId === contact.ContactID && activeAction.type === "reassign";
  const isDeleteOpen =
    activeAction?.contactId === contact.ContactID && activeAction.type === "delete";
  const isArchiveOpen =
    activeAction?.contactId === contact.ContactID && activeAction.type === "archive";

  const handleToggleSuspicious = async () => {
    if (!onContactUpdate) return;
    setBusy(true);
    try {
      await onContactUpdate(contact.ContactID, {
        IsSuspicious: !contact.IsSuspicious,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleReassign = async () => {
    if (!onContactReassign || !targetCompanyId) return;
    setBusy(true);
    try {
      await onContactReassign(contact.ContactID, targetCompanyId);
      onActionChange(null);
      setTargetCompanyId("");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!onContactDelete) return;
    setBusy(true);
    try {
      await onContactDelete(contact.ContactID);
      onActionChange(null);
    } finally {
      setBusy(false);
    }
  };

  const handleArchive = async () => {
    if (!onContactArchive) return;
    setBusy(true);
    try {
      await onContactArchive(contact.ContactID, !contact.IsArchived);
      onActionChange(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <ActionMenu
        align="right"
        label={
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-carbon-blue/45 hover:text-carbon-blue">
            ···
          </span>
        }
      >
        <ActionMenuItem onClick={() => void handleToggleSuspicious()}>
          {contact.IsSuspicious ? "Clear suspicious flag" : "Mark as suspicious"}
        </ActionMenuItem>
        <ActionMenuItem
          onClick={() => {
            setTargetCompanyId(reassignOptions[0]?.CompanyID ?? "");
            onActionChange({ contactId: contact.ContactID, type: "reassign" });
          }}
        >
          Transfer to another company
        </ActionMenuItem>
        <ActionMenuItem
          onClick={() => onActionChange({ contactId: contact.ContactID, type: "archive" })}
        >
          {contact.IsArchived ? "Restore contact" : "Archive contact"}
        </ActionMenuItem>
        <ActionMenuItem
          href={`/contacts/${encodeURIComponent(contact.ContactID)}?company=${encodeURIComponent(companyId)}&lifecycle=position`}
        >
          Change position
        </ActionMenuItem>
        <ActionMenuItem
          href={`/contacts/${encodeURIComponent(contact.ContactID)}?company=${encodeURIComponent(companyId)}&lifecycle=merge`}
        >
          Merge duplicates
        </ActionMenuItem>
        <ActionMenuItem
          onClick={() => onActionChange({ contactId: contact.ContactID, type: "delete" })}
        >
          Delete contact
        </ActionMenuItem>
      </ActionMenu>

      {isReassignOpen ? (
        <div className="w-full min-w-[220px] border border-carbon-blue/10 bg-carbon-blue/[0.02] p-3 text-left">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
            Reassign contact
          </p>
          <select
            value={targetCompanyId}
            onChange={(event) => setTargetCompanyId(event.target.value)}
            className="mt-2 w-full border border-carbon-blue/15 bg-white px-2 py-1.5 text-[12px] text-carbon-blue"
          >
            {reassignOptions.map((company) => (
              <option key={company.CompanyID} value={company.CompanyID}>
                {company.Title}
              </option>
            ))}
          </select>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy || !targetCompanyId}
              onClick={() => void handleReassign()}
              className="border border-upcycle-orange bg-upcycle-orange px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white disabled:opacity-50"
            >
              {busy ? "Moving…" : "Move"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onActionChange(null)}
              className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/55"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {isArchiveOpen ? (
        <DestructiveConfirmPanel
          title={contact.IsArchived ? "Restore this contact?" : "Archive this contact?"}
          message={
            contact.IsArchived
              ? "Contact will return to active lists."
              : "Contact will be hidden from default lists. All history is preserved."
          }
          confirmLabel={contact.IsArchived ? "Restore" : "Archive"}
          loading={busy}
          onConfirm={() => void handleArchive()}
          onCancel={() => onActionChange(null)}
        />
      ) : null}

      {isDeleteOpen ? (
        <DestructiveConfirmPanel
          title="Delete this contact?"
          message="This removes the contact from the company. Linked activities are not deleted."
          confirmLabel="Delete contact"
          loading={busy}
          onConfirm={() => void handleDelete()}
          onCancel={() => onActionChange(null)}
        />
      ) : null}
    </div>
  );
}

function ContactTableRow({
  contact,
  companyId,
  companies,
  role,
  activities,
  projects = [],
  activeAction,
  onActionChange,
  onContactUpdate,
  onContactDelete,
  onContactReassign,
  onContactArchive,
}: {
  contact: Contact;
  companyId: string;
  companies: Company[];
  role: UserRole;
  activities: Activity[];
  projects?: Project[];
  activeAction: ContactRowAction | null;
  onActionChange: (action: ContactRowAction | null) => void;
  onContactUpdate?: (contactId: string, patch: UpdateContactInput) => Promise<void>;
  onContactDelete?: (contactId: string) => Promise<void>;
  onContactReassign?: (contactId: string, targetCompanyId: string) => Promise<void>;
  onContactArchive?: (contactId: string, archived: boolean) => Promise<void>;
}) {
  const roleLabel = contact.JobTitle || contact.Role || "—";
  const phone = contact.Mobile || contact.Phone;
  const contactActivities = getActivitiesForContact(activities, contact.ContactID, contact);
  const lastInteraction = contactActivities[0];
  const canManage = canDeleteContact(role);
  const projectRoles = getContactProjectRolesOnCompany(
    contact.ContactID,
    companyId,
    projects,
  );
  const projectRoleLabel =
    projectRoles.length === 0
      ? "—"
      : projectRoles.length === 1
        ? `${projectRoles[0]!.projectRole} · ${projectRoles[0]!.projectName}`
        : `${projectRoles[0]!.projectRole} · +${projectRoles.length - 1} more`;

  return (
    <tr className="border-b border-carbon-blue/6 last:border-b-0 hover:bg-carbon-blue/[0.02] align-top">
      <td className="px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <ContactLink
            contactId={contact.ContactID}
            companyId={companyId}
            className="block truncate text-[13px] font-semibold text-carbon-blue"
          >
            {getContactDisplayName(contact)}
          </ContactLink>
          {contact.IsSuspicious ? (
            <span
              className="shrink-0 border border-thermal-red/25 bg-thermal-red/[0.06] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-thermal-red"
              title="Flagged as suspicious — review name, email, or company match"
            >
              Suspicious
            </span>
          ) : null}
        </div>
      </td>
      <td className="truncate px-3 py-2.5 text-[12px] text-carbon-blue/60">{roleLabel}</td>
      <td className="truncate px-3 py-2.5 text-[12px] text-carbon-blue/55" title={projectRoleLabel}>
        {projectRoleLabel}
      </td>
      <td className="px-3 py-2.5 text-[12px]">
        {contact.Email ? (
          <EmailActionMenu email={contact.Email} />
        ) : (
          <span className="text-carbon-blue/35">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-[12px]">
        {phone ? (
          <PhoneActionMenu phone={phone} />
        ) : (
          <span className="text-carbon-blue/35">—</span>
        )}
      </td>
      <td className="truncate px-3 py-2.5 text-[12px] text-carbon-blue/50">
        {lastInteraction
          ? formatRelativeTime(lastInteraction.ActivityDate)
          : "No interaction"}
        {contact.EmploymentStatus && contact.EmploymentStatus !== "Active" ? (
          <span className="ml-2 border border-carbon-blue/15 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/45">
            {contact.EmploymentStatus}
          </span>
        ) : null}
      </td>
      {canManage ? (
        <td className="px-3 py-2.5">
          <ContactRowActions
            contact={contact}
            companyId={companyId}
            companies={companies}
            role={role}
            activeAction={activeAction}
            onActionChange={onActionChange}
            onContactUpdate={onContactUpdate}
            onContactDelete={onContactDelete}
            onContactReassign={onContactReassign}
            onContactArchive={onContactArchive}
          />
        </td>
      ) : null}
    </tr>
  );
}

/**
 * Desktop-optimized contacts table for company workspace panels.
 */
export function CompanyContactsTable({
  contacts,
  companyId,
  companies,
  role,
  activities,
  projects = [],
  onCreateContact,
  onContactUpdate,
  onContactDelete,
  onContactReassign,
  onContactArchive,
  createRequestId = 0,
}: {
  contacts: Contact[];
  companyId: string;
  companies: Company[];
  role: UserRole;
  activities: Activity[];
  projects?: Project[];
  onCreateContact?: (input: CreateContactInput) => Promise<void>;
  onContactUpdate?: (contactId: string, patch: UpdateContactInput) => Promise<void>;
  onContactDelete?: (contactId: string) => Promise<void>;
  onContactReassign?: (contactId: string, targetCompanyId: string) => Promise<void>;
  onContactArchive?: (contactId: string, archived: boolean) => Promise<void>;
  createRequestId?: number;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [activeAction, setActiveAction] = useState<ContactRowAction | null>(null);
  const [contactForm, setContactForm] = useState<CreateContactInput>(() => ({
    ...emptyContactForm(),
    Company: { CompanyID: companyId },
  }));
  const canManage = canDeleteContact(role);

  useEffect(() => {
    if (createRequestId > 0) {
      setCreateOpen(true);
    }
  }, [createRequestId]);

  const handleCreateContact = async () => {
    if (!onCreateContact || !isContactFormValid(contactForm)) return;
    setSavingContact(true);
    try {
      await onCreateContact({
        ...contactForm,
        FirstName: contactForm.FirstName.trim(),
        LastName: contactForm.LastName.trim(),
        JobTitle: contactForm.JobTitle.trim() || contactForm.Role,
        Email: contactForm.Email.trim(),
        Phone: contactForm.Phone.trim(),
        Mobile: contactForm.Mobile.trim(),
        Company: { CompanyID: companyId },
      });
      setContactForm({ ...emptyContactForm(), Company: { CompanyID: companyId } });
      setCreateOpen(false);
    } finally {
      setSavingContact(false);
    }
  };

  if (contacts.length === 0 && !onCreateContact) {
    return <p className="text-sm text-carbon-blue/45">No contacts yet.</p>;
  }

  return (
    <div className="flex min-h-0 flex-col">
      {contacts.length > 0 ? (
        <table className="w-full table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[12%]" />
            <col className="w-[16%]" />
            <col className="w-[18%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            {canManage ? <col className="w-[8%]" /> : null}
          </colgroup>
          <thead>
            <tr className="border-b border-carbon-blue/8 bg-carbon-blue/[0.03]">
              <th className="px-3 py-2 text-left">
                <IconLabel icon="contact" iconSize="xs" className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
                  Name
                </IconLabel>
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
                Role
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
                Project roles
              </th>
              <th className="px-3 py-2 text-left">
                <IconLabel icon="email" iconSize="xs" className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
                  Email
                </IconLabel>
              </th>
              <th className="px-3 py-2 text-left">
                <IconLabel icon="phone" iconSize="xs" className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
                  Phone
                </IconLabel>
              </th>
              <th className="px-3 py-2 text-left">
                <IconLabel icon="meeting" iconSize="xs" className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
                  Last Interaction
                </IconLabel>
              </th>
              {canManage ? (
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => (
              <ContactTableRow
                key={contact.ContactID}
                contact={contact}
                companyId={companyId}
                companies={companies}
                role={role}
                activities={activities}
                projects={projects}
                activeAction={activeAction}
                onActionChange={setActiveAction}
                onContactUpdate={onContactUpdate}
                onContactDelete={onContactDelete}
                onContactReassign={onContactReassign}
                onContactArchive={onContactArchive}
              />
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-carbon-blue/45">No contacts yet.</p>
      )}

      {onCreateContact ? (
        <div className="mt-4 shrink-0">
          {createOpen ? (
            <div className="border border-carbon-blue/10 bg-carbon-blue/[0.02] p-4">
              <ContactFormFields form={contactForm} onChange={setContactForm} />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={savingContact || !isContactFormValid(contactForm)}
                  onClick={() => void handleCreateContact()}
                  className="border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {savingContact ? "Saving…" : "Create contact"}
                </button>
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-carbon-blue/55 hover:text-carbon-blue"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 border border-carbon-blue/12 px-3 py-1.5 text-[11px] font-semibold text-carbon-blue/65 transition-colors hover:border-upcycle-orange/30 hover:text-upcycle-orange"
            >
              <SmartCRMIcon name="add" size="xs" />
              Add Contact
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
