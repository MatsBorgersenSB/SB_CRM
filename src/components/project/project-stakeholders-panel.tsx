"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Company } from "@/types/company";
import type { Contact } from "@/types/contact";
import { getContactDisplayName } from "@/types/contact";
import type { ProjectStakeholder, StakeholderInfluence } from "@/types/project";
import { contact360Href } from "@/types/relationship-navigation";
import { SmartCRMIcon } from "@/components/ui/smartcrm-icon";

const INFLUENCE_OPTIONS: StakeholderInfluence[] = ["High", "Medium", "Low"];

type ContactOption = {
  contact: Contact;
  companyId: string;
  companyName: string;
};

function buildContactOptions(
  companies: Company[],
  assignedIds: Set<string>,
  linkedCompany?: Company,
): ContactOption[] {
  const sourceCompanies = linkedCompany ? [linkedCompany] : companies;
  const options: ContactOption[] = [];

  for (const company of sourceCompanies) {
    for (const contact of company.contacts) {
      if (assignedIds.has(contact.ContactID)) continue;
      options.push({
        contact,
        companyId: company.CompanyID,
        companyName: company.Title,
      });
    }
  }

  return options.sort((a, b) =>
    getContactDisplayName(a.contact).localeCompare(getContactDisplayName(b.contact)),
  );
}

export function ProjectStakeholdersPanel({
  stakeholders,
  companies,
  linkedCompanyId,
  readOnly = false,
  onAdd,
  onRemove,
}: {
  stakeholders: ProjectStakeholder[];
  companies: Company[];
  linkedCompanyId?: string;
  readOnly?: boolean;
  onAdd?: (stakeholder: ProjectStakeholder) => Promise<void>;
  onRemove?: (index: number) => Promise<void>;
}) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [role, setRole] = useState("");
  const [influence, setInfluence] = useState<StakeholderInfluence>("Medium");
  const [saving, setSaving] = useState(false);
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);

  const linkedCompany = companies.find((company) => company.CompanyID === linkedCompanyId);

  const availableContacts = useMemo(() => {
    const assigned = new Set(
      stakeholders.map((stakeholder) => stakeholder.contactId).filter(Boolean) as string[],
    );
    return buildContactOptions(companies, assigned, linkedCompany);
  }, [companies, linkedCompany, stakeholders]);

  const handleAdd = async () => {
    const option = availableContacts.find((entry) => entry.contact.ContactID === selectedContactId);
    if (!option || !role.trim() || !onAdd) return;

    setSaving(true);
    try {
      await onAdd({
        contactId: option.contact.ContactID,
        name: getContactDisplayName(option.contact),
        role: role.trim(),
        influence,
        companyName: option.companyName,
      });
      setSelectedContactId("");
      setRole("");
      setInfluence("Medium");
      setAssignOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (index: number) => {
    if (!onRemove) return;
    setRemovingIndex(index);
    try {
      await onRemove(index);
    } finally {
      setRemovingIndex(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {stakeholders.length === 0 ? (
        <p className="text-sm text-carbon-blue/45">
          No associated contacts yet. Add stakeholders who influence this project outcome.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-carbon-blue/10 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                <th className="px-2 py-2 font-semibold">Contact</th>
                <th className="px-2 py-2 font-semibold">Role</th>
                <th className="px-2 py-2 font-semibold">Influence</th>
                {!readOnly && onRemove ? <th className="px-2 py-2 font-semibold"> </th> : null}
              </tr>
            </thead>
            <tbody>
              {stakeholders.map((stakeholder, index) => (
                <tr key={`${stakeholder.contactId ?? stakeholder.name}-${stakeholder.role}`} className="border-b border-carbon-blue/5">
                  <td className="px-2 py-2.5">
                    <div>
                      {stakeholder.contactId ? (
                        <Link
                          href={contact360Href(stakeholder.contactId, linkedCompanyId)}
                          className="font-medium text-carbon-blue hover:text-upcycle-orange"
                        >
                          {stakeholder.name}
                        </Link>
                      ) : (
                        <span className="font-medium text-carbon-blue">{stakeholder.name}</span>
                      )}
                      {stakeholder.companyName ? (
                        <p className="text-[12px] text-carbon-blue/45">{stakeholder.companyName}</p>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-carbon-blue/70">{stakeholder.role}</td>
                  <td className="px-2 py-2.5">
                    <InfluenceBadge influence={stakeholder.influence} />
                  </td>
                  {!readOnly && onRemove ? (
                    <td className="px-2 py-2.5">
                      <button
                        type="button"
                        disabled={removingIndex === index}
                        onClick={() => void handleRemove(index)}
                        className="text-[11px] font-semibold text-carbon-blue/45 hover:text-red-600 disabled:opacity-50"
                      >
                        {removingIndex === index ? "…" : "Remove"}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!readOnly && onAdd ? (
        <div>
          {assignOpen ? (
            <div className="border border-carbon-blue/10 bg-carbon-blue/[0.02] p-4">
              <p className="mb-2 text-[11px] text-carbon-blue/55">
                {linkedCompany
                  ? `Select a contact from ${linkedCompany.Title}`
                  : "Select a contact from your portfolio"}
              </p>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">Contact</span>
                <select
                  value={selectedContactId}
                  onChange={(event) => setSelectedContactId(event.target.value)}
                  className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue"
                >
                  <option value="">Select contact…</option>
                  {availableContacts.map((option) => (
                    <option key={option.contact.ContactID} value={option.contact.ContactID}>
                      {getContactDisplayName(option.contact)}
                      {!linkedCompany ? ` · ${option.companyName}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">Role on project</span>
                <input
                  type="text"
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  placeholder="e.g. Project Sponsor"
                  className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue"
                />
              </label>
              <label className="mt-3 block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">Influence</span>
                <select
                  value={influence}
                  onChange={(event) => setInfluence(event.target.value as StakeholderInfluence)}
                  className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue"
                >
                  {INFLUENCE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={saving || !selectedContactId || !role.trim() || availableContacts.length === 0}
                  onClick={() => void handleAdd()}
                  className="border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Adding…" : "Add contact"}
                </button>
                <button
                  type="button"
                  onClick={() => setAssignOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-carbon-blue/55 hover:text-carbon-blue"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAssignOpen(true)}
              disabled={availableContacts.length === 0}
              className="inline-flex items-center gap-1.5 border border-carbon-blue/12 px-3 py-1.5 text-[11px] font-semibold text-carbon-blue/65 transition-colors hover:border-upcycle-orange/30 hover:text-upcycle-orange disabled:opacity-50"
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

function InfluenceBadge({ influence }: { influence: StakeholderInfluence }) {
  const tone =
    influence === "High"
      ? "border-upcycle-orange/30 bg-upcycle-orange/10 text-upcycle-orange"
      : influence === "Medium"
        ? "border-carbon-blue/15 bg-carbon-blue/5 text-carbon-blue/70"
        : "border-carbon-blue/10 bg-white text-carbon-blue/45";

  return (
    <span className={`inline-block border px-2 py-0.5 text-[11px] font-medium ${tone}`}>
      {influence}
    </span>
  );
}
