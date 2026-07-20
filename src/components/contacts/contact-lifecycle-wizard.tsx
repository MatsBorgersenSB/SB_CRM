"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CONTACT_LIST_ROLES,
  getContactDisplayName,
  type Contact,
} from "@/types/contact";
import {
  EMPLOYMENT_STATUSES,
  type EmploymentStatus,
} from "@/types/contact-lifecycle";
import type { Company } from "@/types/company";
import type { UpdateContactInput } from "@/types/contact";
import { DestructiveConfirmPanel } from "@/components/ui/destructive-confirm-panel";

type WizardMode = "transfer" | "merge" | "position";

type TransferPreview = {
  contact: Contact;
  sourceCompanyId: string;
  targetCompanyName: string;
  preservedReferences: {
    activities: number;
    documents: number;
    opportunities: number;
    emails: number;
  };
};

type ContactLifecycleWizardProps = {
  open: boolean;
  mode: WizardMode;
  contact: Contact;
  companyId: string;
  companies: Company[];
  duplicateCandidates?: { contactId: string; label: string }[];
  onClose: () => void;
  onTransferCompleted: (contact: Contact, targetCompanyId: string) => void;
  onMergeCompleted: (contact: Contact, mergedContactId: string) => void;
  onPositionCompleted?: (contact: Contact) => void;
  onContactUpdate?: (contactId: string, patch: UpdateContactInput) => Promise<void>;
};

export function ContactLifecycleWizard({
  open,
  mode,
  contact,
  companyId,
  companies,
  duplicateCandidates = [],
  onClose,
  onTransferCompleted,
  onMergeCompleted,
  onPositionCompleted,
  onContactUpdate,
}: ContactLifecycleWizardProps) {
  const [targetCompanyId, setTargetCompanyId] = useState("");
  const [secondaryContactId, setSecondaryContactId] = useState("");
  const [newRole, setNewRole] = useState(contact.Role);
  const [newJobTitle, setNewJobTitle] = useState(contact.JobTitle);
  const [employmentStatus, setEmploymentStatus] = useState<EmploymentStatus>(
    contact.EmploymentStatus ?? "Active",
  );
  const [preview, setPreview] = useState<TransferPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transferOptions = useMemo(
    () =>
      companies
        .filter((company) => company.CompanyID !== companyId)
        .sort((a, b) => a.Title.localeCompare(b.Title)),
    [companies, companyId],
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    setTargetCompanyId(transferOptions[0]?.CompanyID ?? "");
    setSecondaryContactId(duplicateCandidates[0]?.contactId ?? "");
    setNewRole(contact.Role);
    setNewJobTitle(contact.JobTitle);
    setEmploymentStatus(contact.EmploymentStatus ?? "Active");
  }, [open, contact, transferOptions, duplicateCandidates]);

  useEffect(() => {
    if (!open || mode !== "transfer" || !targetCompanyId) return;

    setLoading(true);
    void fetch(`/api/contacts/${encodeURIComponent(contact.ContactID)}/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetCompanyId, preview: true }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load transfer preview");
        const body = (await response.json()) as { preview: TransferPreview };
        setPreview(body.preview);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load preview");
      })
      .finally(() => setLoading(false));
  }, [open, mode, contact.ContactID, targetCompanyId]);

  if (!open) return null;

  async function handleConfirmTransfer() {
    if (!targetCompanyId) {
      setError("Select a target company.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/contacts/${encodeURIComponent(contact.ContactID)}/transfer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetCompanyId,
            newRole,
            newJobTitle,
            employmentStatus,
          }),
        },
      );

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Transfer failed");
      }

      const body = (await response.json()) as { contact: Contact };
      onTransferCompleted(body.contact, targetCompanyId);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmMerge() {
    if (!secondaryContactId) {
      setError("Select a contact to merge.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/contacts/${encodeURIComponent(contact.ContactID)}/merge`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secondaryContactId }),
        },
      );

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Merge failed");
      }

      const body = (await response.json()) as { contact: Contact };
      onMergeCompleted(body.contact, secondaryContactId);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Merge failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmPosition() {
    if (!onContactUpdate) {
      setError("Position update is unavailable.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onContactUpdate(contact.ContactID, {
        Role: newRole,
        JobTitle: newJobTitle,
      });
      onPositionCompleted?.({
        ...contact,
        Role: newRole,
        JobTitle: newJobTitle,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Position update failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbon-blue/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-carbon-blue/15 bg-white shadow-lg"
      >
        <header className="flex items-center justify-between border-b border-carbon-blue/10 px-4 py-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-carbon-blue/40">
              {mode === "transfer"
                ? "Change company"
                : mode === "position"
                  ? "Change position"
                  : "Merge duplicate contacts"}
            </p>
            <h2 className="text-sm font-semibold text-carbon-blue">
              {getContactDisplayName(contact)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-carbon-blue/45 hover:text-carbon-blue"
          >
            Close
          </button>
        </header>

        <div className="space-y-3 px-4 py-4">
          {mode === "transfer" ? (
            <>
              <p className="text-[11px] text-carbon-blue/65">
                Relationship history is preserved across company changes — activities, timeline,
                and transfer records remain linked to this person.
              </p>
              <label className="block">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                  New company
                </span>
                <select
                  value={targetCompanyId}
                  onChange={(event) => setTargetCompanyId(event.target.value)}
                  className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1.5 text-xs text-carbon-blue"
                >
                  {transferOptions.map((company) => (
                    <option key={company.CompanyID} value={company.CompanyID}>
                      {company.Title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                    New role
                  </span>
                  <select
                    value={newRole}
                    onChange={(event) =>
                      setNewRole(event.target.value as Contact["Role"])
                    }
                    className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1.5 text-xs text-carbon-blue"
                  >
                    {CONTACT_LIST_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                    Employment status
                  </span>
                  <select
                    value={employmentStatus}
                    onChange={(event) =>
                      setEmploymentStatus(event.target.value as EmploymentStatus)
                    }
                    className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1.5 text-xs text-carbon-blue"
                  >
                    {EMPLOYMENT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                  Job title
                </span>
                <input
                  type="text"
                  value={newJobTitle}
                  onChange={(event) => setNewJobTitle(event.target.value)}
                  className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1.5 text-xs text-carbon-blue"
                />
              </label>

              {loading ? (
                <p className="text-xs text-carbon-blue/50">Loading preview…</p>
              ) : preview ? (
                <div className="border border-carbon-blue/10 bg-carbon-blue/[0.02] p-3 text-[11px] text-carbon-blue/70">
                  <p className="font-semibold text-carbon-blue">
                    Transfer to {preview.targetCompanyName}
                  </p>
                  <p className="mt-1">
                    Preserved: {preview.preservedReferences.activities} activities,{" "}
                    {preview.preservedReferences.opportunities} opportunities,{" "}
                    {preview.preservedReferences.documents} documents,{" "}
                    {preview.preservedReferences.emails} emails
                  </p>
                </div>
              ) : null}
            </>
          ) : mode === "position" ? (
            <>
              <p className="text-[11px] text-carbon-blue/65">
                Update role and job title at the current company. The contact timeline records
                this position change — relationship history is preserved.
              </p>
              <label className="block">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                  Role
                </span>
                <select
                  value={newRole}
                  onChange={(event) => setNewRole(event.target.value as Contact["Role"])}
                  className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1.5 text-xs text-carbon-blue"
                >
                  {CONTACT_LIST_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                  Job title / position
                </span>
                <input
                  type="text"
                  value={newJobTitle}
                  onChange={(event) => setNewJobTitle(event.target.value)}
                  className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1.5 text-xs text-carbon-blue"
                />
              </label>
            </>
          ) : (
            <>
              <p className="text-[11px] text-carbon-blue/65">
                Merge combines relationship history into this contact. The secondary record will
                be removed after activities are rewired.
              </p>
              <label className="block">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                  Merge with
                </span>
                <select
                  value={secondaryContactId}
                  onChange={(event) => setSecondaryContactId(event.target.value)}
                  className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1.5 text-xs text-carbon-blue"
                >
                  {duplicateCandidates.map((candidate) => (
                    <option key={candidate.contactId} value={candidate.contactId}>
                      {candidate.label}
                    </option>
                  ))}
                </select>
              </label>
              {duplicateCandidates.length === 0 ? (
                <label className="block">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                    Contact ID to merge
                  </span>
                  <input
                    type="text"
                    value={secondaryContactId}
                    onChange={(event) => setSecondaryContactId(event.target.value)}
                    placeholder="e.g. CT-10012"
                    className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1.5 font-mono text-xs text-carbon-blue"
                  />
                </label>
              ) : null}
            </>
          )}

          {error ? <p className="text-xs text-thermal-red">{error}</p> : null}
        </div>

        <footer className="flex justify-end gap-2 border-t border-carbon-blue/10 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="border border-carbon-blue/15 px-3 py-1.5 text-xs font-semibold text-carbon-blue/60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() =>
              void (
                mode === "transfer"
                  ? handleConfirmTransfer()
                  : mode === "position"
                    ? handleConfirmPosition()
                    : handleConfirmMerge()
              )
            }
            className="border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {submitting
              ? "Saving…"
              : mode === "transfer"
                ? "Confirm company change"
                : mode === "position"
                  ? "Confirm position change"
                  : "Confirm merge"}
          </button>
        </footer>
      </div>
    </div>
  );
}

export function ContactArchiveConfirm({
  open,
  contactName,
  archived,
  onConfirm,
  onCancel,
  loading,
}: {
  open: boolean;
  contactName: string;
  archived: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  if (!open) return null;

  return (
    <DestructiveConfirmPanel
      title={archived ? "Archive contact?" : "Restore contact?"}
      message={
        archived
          ? `${contactName} will be hidden from default lists. All history is preserved.`
          : `${contactName} will be restored to active contact lists.`
      }
      confirmLabel={archived ? "Archive" : "Restore"}
      onConfirm={onConfirm}
      onCancel={onCancel}
      loading={loading}
    />
  );
}
