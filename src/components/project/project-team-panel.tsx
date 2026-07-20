"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Company, SharePointPerson } from "@/types/company";
import type { Contact } from "@/types/contact";
import { getContactDisplayName } from "@/types/contact";
import type {
  ProjectTeamCategory,
  ProjectTeamMember,
  StakeholderInfluence,
} from "@/types/project";
import {
  PROJECT_TEAM_CATEGORY_LABELS,
  PROJECT_TEAM_CATEGORY_ORDER,
} from "@/types/project";
import { contact360Href } from "@/types/relationship-navigation";
import { findStandardBioUserOption } from "@/lib/standard-bio-users";
import {
  createTeamMemberId,
  filterTeamByCategory,
  isCustomerTeamCategory,
  isInternalTeamCategory,
} from "@/lib/project-team-utils";
import { SmartCRMIcon } from "@/components/ui/smartcrm-icon";

const INFLUENCE_OPTIONS: StakeholderInfluence[] = ["High", "Medium", "Low"];

const CATEGORY_DESCRIPTIONS: Record<ProjectTeamCategory, string> = {
  project_manager: "Standard Bio lead accountable for delivery.",
  project_member: "Internal team delivering the project.",
  customer_project_manager: "Customer-side lead coordinating the engagement.",
  customer_member: "Customer staff involved in day-to-day delivery.",
  associated_contact: "Other contacts who influence project outcomes.",
};

type ContactOption = {
  contact: Contact;
  companyId: string;
  companyName: string;
};

function buildContactOptions(
  companies: Company[],
  assignedContactIds: Set<string>,
  linkedCompany?: Company,
  category?: ProjectTeamCategory,
): ContactOption[] {
  const customerOnly = category ? isCustomerTeamCategory(category) : false;
  const sourceCompanies =
    customerOnly && linkedCompany ? [linkedCompany] : customerOnly ? companies : companies;

  const options: ContactOption[] = [];
  for (const company of sourceCompanies) {
    for (const contact of company.contacts) {
      if (assignedContactIds.has(contact.ContactID)) continue;
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

function allowsMultiple(category: ProjectTeamCategory): boolean {
  return category !== "project_manager" && category !== "customer_project_manager";
}

function assignedInternalUserIdsForCategory(
  team: ProjectTeamMember[],
  category: ProjectTeamCategory,
): Set<number> {
  if (category === "project_manager") {
    return new Set();
  }
  return new Set(
    team
      .filter((member) => member.category === category && member.userId !== undefined)
      .map((member) => member.userId!),
  );
}

export function ProjectTeamPanel({
  team,
  companies,
  linkedCompanyId,
  standardBioUsers,
  readOnly = false,
  compact = false,
  onTeamChange,
}: {
  team: ProjectTeamMember[];
  companies: Company[];
  linkedCompanyId?: string;
  standardBioUsers: SharePointPerson[];
  readOnly?: boolean;
  compact?: boolean;
  onTeamChange?: (team: ProjectTeamMember[]) => Promise<void>;
}) {
  const [activeCategory, setActiveCategory] = useState<ProjectTeamCategory | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [projectRole, setProjectRole] = useState("");
  const [influence, setInfluence] = useState<StakeholderInfluence>("Medium");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const linkedCompany = companies.find((company) => company.CompanyID === linkedCompanyId);

  const assignedContactIds = useMemo(
    () =>
      new Set(team.map((member) => member.contactId).filter(Boolean) as string[]),
    [team],
  );

  const assignedUserIds = useMemo(
    () => assignedInternalUserIdsForCategory(team, activeCategory ?? "project_member"),
    [team, activeCategory],
  );

  const availableUsers = useMemo(() => {
    if (!activeCategory || !isInternalTeamCategory(activeCategory)) {
      return standardBioUsers;
    }
    return standardBioUsers.filter((user) => !assignedUserIds.has(user.Id));
  }, [standardBioUsers, activeCategory, assignedUserIds]);

  const availableContacts = useMemo(() => {
    if (!activeCategory || !isCustomerTeamCategory(activeCategory)) return [];
    return buildContactOptions(companies, assignedContactIds, linkedCompany, activeCategory);
  }, [companies, assignedContactIds, linkedCompany, activeCategory]);

  const persistTeam = async (nextTeam: ProjectTeamMember[]) => {
    if (!onTeamChange) return;
    setSaving(true);
    try {
      await onTeamChange(nextTeam);
      setActiveCategory(null);
      setSelectedUserId("");
      setSelectedContactId("");
      setProjectRole("");
      setInfluence("Medium");
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!activeCategory || !projectRole.trim() || !onTeamChange) return;

    if (isInternalTeamCategory(activeCategory)) {
      const user = findStandardBioUserOption(standardBioUsers, Number(selectedUserId));
      if (!user) return;

      let nextTeam = [...team];
      if (activeCategory === "project_manager") {
        nextTeam = nextTeam.filter((member) => member.category !== "project_manager");
      }
      if (activeCategory === "customer_project_manager") {
        nextTeam = nextTeam.filter((member) => member.category !== "customer_project_manager");
      }

      nextTeam.push({
        id: createTeamMemberId(),
        category: activeCategory,
        name: user.Title,
        userId: user.Id,
        projectRole: projectRole.trim(),
      });
      await persistTeam(nextTeam);
      return;
    }

    const option = availableContacts.find((entry) => entry.contact.ContactID === selectedContactId);
    if (!option && activeCategory !== "associated_contact") return;

    let nextTeam = [...team];
    if (activeCategory === "customer_project_manager") {
      nextTeam = nextTeam.filter((member) => member.category !== "customer_project_manager");
    }

    const member: ProjectTeamMember = {
      id: createTeamMemberId(),
      category: activeCategory,
      name: option ? getContactDisplayName(option.contact) : projectRole.trim(),
      contactId: option?.contact.ContactID,
      companyId: option?.companyId ?? linkedCompanyId,
      companyName: option?.companyName ?? linkedCompany?.Title,
      projectRole: projectRole.trim(),
      influence,
    };

    if (activeCategory === "associated_contact" && !option) {
      member.name = projectRole.trim().includes(" ")
        ? projectRole.trim()
        : selectedContactId || projectRole.trim();
    }

    nextTeam.push(member);
    await persistTeam(nextTeam);
  };

  const handleRemove = async (memberId: string) => {
    if (!onTeamChange) return;
    setRemovingId(memberId);
    try {
      await onTeamChange(team.filter((member) => member.id !== memberId));
    } finally {
      setRemovingId(null);
    }
  };

  const categoriesToShow = compact
    ? PROJECT_TEAM_CATEGORY_ORDER.filter((category) => filterTeamByCategory(team, category).length > 0)
    : PROJECT_TEAM_CATEGORY_ORDER;

  return (
    <div className="flex flex-col gap-6">
      {categoriesToShow.map((category) => {
        const members = filterTeamByCategory(team, category);
        const label = PROJECT_TEAM_CATEGORY_LABELS[category];

        return (
          <section key={category} className={compact ? "" : "border-b border-carbon-blue/8 pb-6 last:border-b-0 last:pb-0"}>
            <div className="mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/55">
                {label}
              </p>
              {!compact ? (
                <p className="mt-0.5 text-[12px] text-carbon-blue/45">{CATEGORY_DESCRIPTIONS[category]}</p>
              ) : null}
            </div>

            {members.length === 0 ? (
              <p className="text-sm text-carbon-blue/40">No one assigned yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-carbon-blue/10 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                      <th className="px-2 py-2 font-semibold">Person</th>
                      <th className="px-2 py-2 font-semibold">Project role</th>
                      {isCustomerTeamCategory(category) ? (
                        <th className="px-2 py-2 font-semibold">Influence</th>
                      ) : null}
                      {!readOnly && onTeamChange ? <th className="px-2 py-2 font-semibold"> </th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.id} className="border-b border-carbon-blue/5">
                        <td className="px-2 py-2.5">
                          <div>
                            {member.contactId ? (
                              <Link
                                href={contact360Href(member.contactId, member.companyId ?? linkedCompanyId)}
                                className="font-medium text-carbon-blue hover:text-upcycle-orange"
                              >
                                {member.name}
                              </Link>
                            ) : (
                              <span className="font-medium text-carbon-blue">{member.name}</span>
                            )}
                            {member.companyName ? (
                              <p className="text-[12px] text-carbon-blue/45">{member.companyName}</p>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-2 py-2.5 text-carbon-blue/70">{member.projectRole}</td>
                        {isCustomerTeamCategory(category) ? (
                          <td className="px-2 py-2.5">
                            {member.influence ? (
                              <InfluenceBadge influence={member.influence} />
                            ) : (
                              "—"
                            )}
                          </td>
                        ) : null}
                        {!readOnly && onTeamChange ? (
                          <td className="px-2 py-2.5">
                            <button
                              type="button"
                              disabled={removingId === member.id}
                              onClick={() => void handleRemove(member.id)}
                              className="text-[11px] font-semibold text-carbon-blue/45 hover:text-red-600 disabled:opacity-50"
                            >
                              {removingId === member.id ? "…" : "Remove"}
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!readOnly && onTeamChange ? (
              <div className="mt-3">
                {activeCategory === category ? (
                  <AddMemberForm
                    category={category}
                    linkedCompany={linkedCompany}
                    standardBioUsers={availableUsers}
                    availableContacts={availableContacts}
                    selectedUserId={selectedUserId}
                    selectedContactId={selectedContactId}
                    projectRole={projectRole}
                    influence={influence}
                    saving={saving}
                    onUserChange={setSelectedUserId}
                    onContactChange={setSelectedContactId}
                    onRoleChange={setProjectRole}
                    onInfluenceChange={setInfluence}
                    onCancel={() => setActiveCategory(null)}
                    onSubmit={() => void handleAdd()}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className="inline-flex items-center gap-1.5 border border-carbon-blue/12 px-3 py-1.5 text-[11px] font-semibold text-carbon-blue/65 transition-colors hover:border-upcycle-orange/30 hover:text-upcycle-orange"
                  >
                    <SmartCRMIcon name="add" size="xs" />
                    {allowsMultiple(category) ? `Add to ${label.toLowerCase()}` : `Assign ${label.toLowerCase()}`}
                  </button>
                )}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function AddMemberForm({
  category,
  linkedCompany,
  standardBioUsers,
  availableContacts,
  selectedUserId,
  selectedContactId,
  projectRole,
  influence,
  saving,
  onUserChange,
  onContactChange,
  onRoleChange,
  onInfluenceChange,
  onCancel,
  onSubmit,
}: {
  category: ProjectTeamCategory;
  linkedCompany?: Company;
  standardBioUsers: SharePointPerson[];
  availableContacts: ContactOption[];
  selectedUserId: string;
  selectedContactId: string;
  projectRole: string;
  influence: StakeholderInfluence;
  saving: boolean;
  onUserChange: (value: string) => void;
  onContactChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onInfluenceChange: (value: StakeholderInfluence) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const internal = isInternalTeamCategory(category);
  const canSubmit = internal
    ? Boolean(selectedUserId && projectRole.trim() && standardBioUsers.length > 0)
    : category === "associated_contact"
      ? Boolean(projectRole.trim())
      : Boolean(selectedContactId && projectRole.trim());

  return (
    <div className="border border-carbon-blue/10 bg-carbon-blue/[0.02] p-4">
      {internal ? (
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
            User
          </span>
          <select
            value={selectedUserId}
            onChange={(event) => onUserChange(event.target.value)}
            className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue"
          >
            <option value="">Select user…</option>
            {standardBioUsers.map((user) => (
              <option key={user.Id} value={user.Id}>
                {user.Title}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
            {linkedCompany ? `Contact from ${linkedCompany.Title}` : "Contact"}
          </span>
          <select
            value={selectedContactId}
            onChange={(event) => onContactChange(event.target.value)}
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
      )}

      <label className="mt-3 block">
        <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
          Project role
        </span>
        <input
          type="text"
          value={projectRole}
          onChange={(event) => onRoleChange(event.target.value)}
          placeholder="e.g. Delivery Lead"
          className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue"
        />
      </label>

      {!internal ? (
        <label className="mt-3 block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
            Influence
          </span>
          <select
            value={influence}
            onChange={(event) => onInfluenceChange(event.target.value as StakeholderInfluence)}
            className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue"
          >
            {INFLUENCE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={saving || !canSubmit}
          onClick={onSubmit}
          className="border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Adding…" : "Add"}
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs font-semibold text-carbon-blue/55 hover:text-carbon-blue">
          Cancel
        </button>
      </div>
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
