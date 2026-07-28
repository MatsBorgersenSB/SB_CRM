"use client";

import { useMemo, useState } from "react";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { Contact, RelationshipLevel } from "@/types/contact";
import { getContactDisplayName } from "@/types/contact";
import type { PipelineTeamMember } from "@/types/pipeline";
import { getActivitiesForContact, getActivitiesForDeal } from "@/lib/activity-utils";
import { formatRelativeTime } from "@/lib/relative-time";
import { findCompanyForDeal } from "@/lib/opportunity-intelligence-engine";
import { resolvePipelineTeam } from "@/lib/team-utils";
import {
  formatSuggestedContactLabel,
  normalizeStakeholderRole,
  suggestOpportunityRoleForContact,
} from "@/lib/opportunity-stakeholder-utils";
import { buildOfferingIntelligence } from "@/lib/offering-intelligence";
import {
  StakeholderRoleBadge,
  StakeholderRoleSelect,
} from "@/components/opportunity/stakeholder-role-select";
import { ContactLink } from "@/components/relationship/relationship-links";
import {
  WorkspaceTable,
  WorkspaceTableBody,
  WorkspaceTableBodyCell,
  WorkspaceTableBodyRow,
  WorkspaceTableHead,
  WorkspaceTableHeadCell,
  WorkspaceTableHeadRow,
} from "@/components/ui/workspace-table";
import { IconLabel, SmartCRMIcon } from "@/components/ui/smartcrm-icon";

type ContactOption = {
  contact: Contact;
  companyId: string;
  companyName: string;
};

function influenceLabel(level: RelationshipLevel): string {
  switch (level) {
    case "Strategic":
      return "High";
    case "Operational":
      return "Medium";
    case "Tactical":
      return "Low";
    default:
      return "Low";
  }
}

function engagementLabel(daysSince: number | null): string {
  if (daysSince === null) return "Unknown";
  if (daysSince <= 14) return "Active";
  if (daysSince <= 45) return "Engaged";
  return "Cooling";
}

function daysSince(dateIso: string): number {
  const then = new Date(dateIso.includes("T") ? dateIso : dateIso.replace(" ", "T"));
  const now = new Date();
  return Math.floor((now.getTime() - then.getTime()) / 86_400_000);
}

function buildContactOptions(
  companies: Company[],
  assignedIds: Set<string>,
  company?: Company,
): ContactOption[] {
  const sourceCompanies = company
    ? [company, ...companies.filter((entry) => entry.CompanyID !== company.CompanyID)]
    : companies;
  const options: ContactOption[] = [];

  for (const entry of sourceCompanies) {
    for (const contact of entry.contacts) {
      if (assignedIds.has(contact.ContactID)) continue;
      options.push({
        contact,
        companyId: entry.CompanyID,
        companyName: entry.Title,
      });
    }
  }

  return options.sort((a, b) => {
    const aPreferred = company && a.companyId === company.CompanyID;
    const bPreferred = company && b.companyId === company.CompanyID;
    if (aPreferred !== bPreferred) return aPreferred ? -1 : 1;
    const aTitle = Boolean(a.contact.JobTitle?.trim() || a.contact.Role?.trim());
    const bTitle = Boolean(b.contact.JobTitle?.trim() || b.contact.Role?.trim());
    if (aTitle !== bTitle) return aTitle ? -1 : 1;
    return getContactDisplayName(a.contact).localeCompare(getContactDisplayName(b.contact));
  });
}

export function DealStakeholdersTable({
  team,
  companies,
  dealId,
  activities,
  onAssign,
  onRemove,
  onUpdateRole,
  readOnly = false,
  compact = false,
  defaultOpenAssign = false,
  offeringIds,
}: {
  team: PipelineTeamMember[];
  companies: Company[];
  dealId: string;
  activities: Activity[];
  onAssign: (contactId: string, projectRole: string) => Promise<void>;
  onRemove?: (contactId: string) => Promise<void>;
  onUpdateRole?: (contactId: string, projectRole: string) => Promise<void>;
  readOnly?: boolean;
  compact?: boolean;
  defaultOpenAssign?: boolean;
  offeringIds?: string[];
}) {
  const offeringIntel = useMemo(
    () => buildOfferingIntelligence(offeringIds, team),
    [offeringIds, team],
  );
  const defaultRole = offeringIntel.suggestedStakeholderRoles[0] ?? "Champion";

  const [assignOpen, setAssignOpen] = useState(defaultOpenAssign);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [dealRole, setDealRole] = useState(defaultRole);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");

  const resolvedTeam = useMemo(() => resolvePipelineTeam(team, companies), [team, companies]);
  const dealActivities = useMemo(() => getActivitiesForDeal(activities, dealId), [activities, dealId]);
  const company = useMemo(() => findCompanyForDeal(dealId, companies), [dealId, companies]);

  const availableContacts = useMemo(() => {
    const assigned = new Set(team.map((member) => member.contactId));
    return buildContactOptions(companies, assigned, company);
  }, [companies, company, team]);

  const companySuggested = useMemo(
    () =>
      availableContacts.filter((option) =>
        company ? option.companyId === company.CompanyID : true,
      ),
    [availableContacts, company],
  );

  const extraRoles = useMemo(
    () => [
      ...team.map((member) => member.projectRole).filter(Boolean),
      ...offeringIntel.suggestedStakeholderRoles,
    ],
    [team, offeringIntel.suggestedStakeholderRoles],
  );

  const stakeholderRows = useMemo(() => {
    return resolvedTeam.map((member) => {
      const contactActivities = getActivitiesForContact(activities, member.contactId).filter(
        (activity) =>
          activity.Deal?.Title === dealId ||
          dealActivities.some((dealActivity) => dealActivity.ActivityID === activity.ActivityID),
      );
      const lastActivity = contactActivities[0] ?? getActivitiesForContact(activities, member.contactId)[0];
      const days = lastActivity ? daysSince(lastActivity.ActivityDate) : null;
      const projectRole = normalizeStakeholderRole(member.projectRole);

      return {
        member,
        companyId: company?.CompanyID ?? "",
        role: projectRole || member.contact.JobTitle || member.contact.Role || "—",
        projectRole,
        influence: influenceLabel(member.contact.RelationshipLevel),
        engagement: engagementLabel(days),
        lastContact: lastActivity
          ? formatRelativeTime(lastActivity.ActivityDate)
          : "No contact recorded",
      };
    });
  }, [resolvedTeam, activities, dealId, dealActivities, company?.CompanyID]);

  const resolvedAssignRole = normalizeStakeholderRole(dealRole);
  const resolvedEditRole = normalizeStakeholderRole(editRole);

  const selectContact = (contactId: string) => {
    setSelectedContactId(contactId);
    const option = availableContacts.find((entry) => entry.contact.ContactID === contactId);
    if (option) {
      const fromTitle = suggestOpportunityRoleForContact(option.contact);
      const fromOffering =
        offeringIntel.missingStakeholderRoles[0] ??
        offeringIntel.suggestedStakeholderRoles[0];
      setDealRole(
        fromOffering && /economic buyer|champion|technical evaluator|procurement/i.test(fromTitle)
          ? fromTitle
          : fromOffering ?? fromTitle,
      );
    }
  };

  const handleAssign = async () => {
    if (!selectedContactId || !resolvedAssignRole) return;
    setSaving(true);
    try {
      await onAssign(selectedContactId, resolvedAssignRole);
      setSelectedContactId("");
      setDealRole(defaultRole);
      setAssignOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (contactId: string) => {
    if (!onRemove) return;
    setRemovingId(contactId);
    try {
      await onRemove(contactId);
    } finally {
      setRemovingId(null);
    }
  };

  const startEdit = (contactId: string, currentRole: string) => {
    setEditingId(contactId);
    setEditRole(normalizeStakeholderRole(currentRole));
  };

  const handleSaveRole = async (contactId: string) => {
    if (!onUpdateRole || !resolvedEditRole) return;
    setSaving(true);
    try {
      await onUpdateRole(contactId, resolvedEditRole);
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {stakeholderRows.length === 0 ? (
        <p className="text-sm text-carbon-blue/45">
          No stakeholders yet.
          {offeringIntel.suggestedStakeholderRoles.length > 0
            ? ` For ${offeringIntel.labels[0] ?? "selected offerings"}, start with ${offeringIntel.suggestedStakeholderRoles.slice(0, 2).join(" and ")}.`
            : " Add decision makers and influencers from the connected company."}
        </p>
      ) : (
        <WorkspaceTable>
          <colgroup>
            <col className={compact ? "w-[34%]" : "w-[22%]"} />
            <col className={compact ? "w-[34%]" : "w-[18%]"} />
            {!compact ? (
              <>
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[16%]" />
              </>
            ) : null}
            {!readOnly ? <col className={compact ? "w-[32%]" : "w-[20%]"} /> : null}
          </colgroup>
          <WorkspaceTableHead>
            <WorkspaceTableHeadRow>
              <WorkspaceTableHeadCell>
                <IconLabel icon="contact" iconSize="xs">Contact</IconLabel>
              </WorkspaceTableHeadCell>
              <WorkspaceTableHeadCell>Role</WorkspaceTableHeadCell>
              {!compact ? (
                <>
                  <WorkspaceTableHeadCell>Influence</WorkspaceTableHeadCell>
                  <WorkspaceTableHeadCell>Engagement</WorkspaceTableHeadCell>
                  <WorkspaceTableHeadCell>Last Contact</WorkspaceTableHeadCell>
                </>
              ) : null}
              {!readOnly ? (
                <WorkspaceTableHeadCell>
                  <span className="sr-only">Actions</span>
                </WorkspaceTableHeadCell>
              ) : null}
            </WorkspaceTableHeadRow>
          </WorkspaceTableHead>
          <WorkspaceTableBody>
            {stakeholderRows.map((row) => (
              <WorkspaceTableBodyRow key={row.member.contactId}>
                <WorkspaceTableBodyCell>
                  <ContactLink
                    contactId={row.member.contactId}
                    companyId={row.companyId}
                    className="block truncate font-semibold text-carbon-blue"
                  >
                    {getContactDisplayName(row.member.contact)}
                  </ContactLink>
                </WorkspaceTableBodyCell>
                <WorkspaceTableBodyCell className="text-carbon-blue/70">
                  {editingId === row.member.contactId ? (
                    <StakeholderRoleSelect
                      label=""
                      value={editRole}
                      extraRoles={extraRoles}
                      onChange={setEditRole}
                      disabled={saving}
                    />
                  ) : row.projectRole ? (
                    <StakeholderRoleBadge role={row.projectRole} />
                  ) : (
                    <span className="truncate text-carbon-blue/45">{row.role}</span>
                  )}
                </WorkspaceTableBodyCell>
                {!compact ? (
                  <>
                    <WorkspaceTableBodyCell className="text-carbon-blue/70">{row.influence}</WorkspaceTableBodyCell>
                    <WorkspaceTableBodyCell className="text-carbon-blue/70">{row.engagement}</WorkspaceTableBodyCell>
                    <WorkspaceTableBodyCell className="text-carbon-blue/65">{row.lastContact}</WorkspaceTableBodyCell>
                  </>
                ) : null}
                {!readOnly ? (
                  <WorkspaceTableBodyCell>
                    <div className="flex flex-wrap items-center gap-2">
                      {editingId === row.member.contactId ? (
                        <>
                          <button
                            type="button"
                            disabled={saving || !resolvedEditRole}
                            onClick={() => void handleSaveRole(row.member.contactId)}
                            className="text-[11px] font-semibold text-upcycle-orange disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="text-[11px] font-semibold text-carbon-blue/45 hover:text-carbon-blue"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          {onUpdateRole ? (
                            <button
                              type="button"
                              onClick={() =>
                                startEdit(row.member.contactId, row.projectRole || row.role)
                              }
                              className="text-[11px] font-semibold text-carbon-blue/55 hover:text-upcycle-orange"
                            >
                              Edit role
                            </button>
                          ) : null}
                          {onRemove ? (
                            <button
                              type="button"
                              disabled={removingId === row.member.contactId}
                              onClick={() => void handleRemove(row.member.contactId)}
                              className="text-[11px] font-semibold text-carbon-blue/45 hover:text-red-600 disabled:opacity-50"
                            >
                              {removingId === row.member.contactId ? "…" : "Remove"}
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </WorkspaceTableBodyCell>
                ) : null}
              </WorkspaceTableBodyRow>
            ))}
          </WorkspaceTableBody>
        </WorkspaceTable>
      )}

      {!readOnly ? (
        <div>
          {assignOpen ? (
            <div className="border border-carbon-blue/10 bg-carbon-blue/[0.02] p-4">
              <p className="mb-2 text-[11px] text-carbon-blue/55">
                {company
                  ? `Prioritize contacts from ${company.Title}`
                  : "Select a contact from your portfolio"}
              </p>

              {company && companySuggested.length > 0 ? (
                <div className="mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                    Suggested · {company.Title}
                  </p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {companySuggested.slice(0, 4).map((option) => {
                      const active = selectedContactId === option.contact.ContactID;
                      return (
                        <li key={option.contact.ContactID}>
                          <button
                            type="button"
                            onClick={() => selectContact(option.contact.ContactID)}
                            className={`w-full border px-3 py-2 text-left text-[12px] transition-colors ${
                              active
                                ? "border-upcycle-orange/40 bg-upcycle-orange/10 text-carbon-blue"
                                : "border-carbon-blue/10 bg-white text-carbon-blue/75 hover:border-upcycle-orange/25"
                            }`}
                          >
                            <span className="font-semibold">
                              {getContactDisplayName(option.contact)}
                            </span>
                            {option.contact.JobTitle?.trim() || option.contact.Role?.trim() ? (
                              <span className="mt-0.5 block text-[11px] text-carbon-blue/55">
                                {option.contact.JobTitle?.trim() || option.contact.Role?.trim()}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                  Contact
                </span>
                <select
                  value={selectedContactId}
                  onChange={(event) => selectContact(event.target.value)}
                  className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue"
                >
                  <option value="">Select contact…</option>
                  {availableContacts.map((option) => (
                    <option key={option.contact.ContactID} value={option.contact.ContactID}>
                      {formatSuggestedContactLabel(option.contact)}
                      {!company || option.companyId !== company.CompanyID
                        ? ` · ${option.companyName}`
                        : ""}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-3">
                <StakeholderRoleSelect
                  value={dealRole}
                  extraRoles={extraRoles}
                  onChange={setDealRole}
                  disabled={saving}
                />
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={
                    saving ||
                    !selectedContactId ||
                    !resolvedAssignRole ||
                    availableContacts.length === 0
                  }
                  onClick={() => void handleAssign()}
                  className="border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Adding…" : "Add Stakeholder"}
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
              Add Stakeholder
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
