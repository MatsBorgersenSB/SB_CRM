"use client";

import { useMemo, useState } from "react";
import type { Company } from "@/lib/companies-data";
import {
  getAllContacts,
  resolvePipelineTeam,
} from "@/lib/team-utils";
import type { PipelineTeamMember } from "@/types/pipeline";
import { getContactDisplayName } from "@/types/contact";
import {
  ContactLink,
  EmailActionMenu,
  PhoneActionMenu,
} from "@/components/relationship/relationship-links";

type DealTeamSectionProps = {
  team: PipelineTeamMember[];
  companies: Company[];
  onAssign: (contactId: string, projectRole: string) => Promise<void>;
  readOnly?: boolean;
};

function RoleBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center border border-upcycle-orange/30 bg-upcycle-orange/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-upcycle-orange">
      {label}
    </span>
  );
}

export function DealTeamSection({
  team,
  companies,
  onAssign,
  readOnly = false,
}: DealTeamSectionProps) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [dealRole, setDealRole] = useState("");
  const [saving, setSaving] = useState(false);

  const resolvedTeam = useMemo(
    () => resolvePipelineTeam(team, companies),
    [team, companies],
  );

  const availableContacts = useMemo(() => {
    const assigned = new Set(team.map((member) => member.contactId));
    return getAllContacts(companies).filter(
      (contact) => !assigned.has(contact.ContactID),
    );
  }, [companies, team]);

  const handleAssign = async () => {
    if (!selectedContactId || !dealRole.trim()) return;

    setSaving(true);

    try {
      await onAssign(selectedContactId, dealRole.trim());
      setSelectedContactId("");
      setDealRole("");
      setAssignOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="border border-carbon-blue/10">
      <header className="border-b border-carbon-blue/10 px-3 py-1.5">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          Deal Team
        </h3>
      </header>

      <div className="flex flex-col gap-2 p-2">
        {resolvedTeam.length === 0 ? (
          <p className="px-1 py-2 text-xs text-carbon-blue/50">
            No team members assigned.
          </p>
        ) : (
          resolvedTeam.map((member) => {
            const companyId =
              companies.find((company) =>
                company.contacts.some(
                  (contact) => contact.ContactID === member.contact.ContactID,
                ),
              )?.CompanyID ?? member.contact.Company?.Title;

            return (
            <article
              key={`${member.contactId}-${member.projectRole}`}
              className="border border-carbon-blue/10 bg-white px-3 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <ContactLink
                  contactId={member.contact.ContactID}
                  companyId={companyId}
                  className="text-xs font-semibold text-carbon-blue"
                >
                  {getContactDisplayName(member.contact)}
                </ContactLink>
                <RoleBadge label={member.projectRole} />
              </div>
              <div className="mt-1">
                <EmailActionMenu
                  email={member.contact.Email}
                  className="block truncate font-mono text-[10px] text-carbon-blue/50"
                />
              </div>
              <div className="mt-0.5">
                <PhoneActionMenu
                  phone={member.contact.Phone || member.contact.Mobile}
                  className="font-mono text-[10px] text-carbon-blue/50"
                />
              </div>
            </article>
            );
          })
        )}

        {!readOnly ? (
          <>
            <button
              type="button"
              onClick={() => setAssignOpen((open) => !open)}
              className="border border-carbon-blue/15 px-2 py-1.5 text-left text-xs font-medium text-carbon-blue transition-colors hover:border-upcycle-orange/30 hover:bg-upcycle-orange/[0.04] hover:text-upcycle-orange"
            >
              Assign Member
            </button>

            {assignOpen ? (
              <div className="border border-carbon-blue/10 bg-carbon-blue/[0.02] p-2">
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                    Contact
                  </span>
                  <select
                    value={selectedContactId}
                    onChange={(event) => setSelectedContactId(event.target.value)}
                    className="mt-1 w-full border border-carbon-blue/15 bg-white px-2 py-1 text-xs text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
                  >
                    <option value="">Select contact…</option>
                    {availableContacts.map((contact) => (
                      <option key={contact.ContactID} value={contact.ContactID}>
                        {getContactDisplayName(contact)} ({contact.ContactID})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="mt-2 block">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                    Deal Role
                  </span>
                  <input
                    type="text"
                    value={dealRole}
                    onChange={(event) => setDealRole(event.target.value)}
                    placeholder="e.g. Technical Lead"
                    className="mt-1 w-full border border-carbon-blue/15 bg-white px-2 py-1 text-xs text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleAssign();
                      }
                    }}
                  />
                </label>

                <button
                  type="button"
                  disabled={saving || !selectedContactId || !dealRole.trim()}
                  onClick={() => void handleAssign()}
                  className="mt-2 w-full border border-upcycle-orange/30 bg-upcycle-orange/10 px-2 py-1.5 text-xs font-semibold text-upcycle-orange transition-colors hover:bg-upcycle-orange/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Add to Team"}
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}

/** @deprecated Use DealTeamSection */
export const ProjectTeamSection = DealTeamSection;
