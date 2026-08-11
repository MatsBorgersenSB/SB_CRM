"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Company, SharePointPerson } from "@/types/company";
import { getContactDisplayName } from "@/types/contact";
import type { Project } from "@/types/project";
import type { ProjectRelatedOrganization, ProjectStakeholderRecord } from "@/types/project-relationships";
import type { StakeholderInfluence } from "@/types/project";
import { contact360Href } from "@/types/relationship-navigation";
import {
  buildStakeholderRoleOptions,
  createStakeholderId,
  INTERNAL_ORGANIZATION_ID,
  resolveStakeholderOrganizationName,
} from "@/lib/project-relationship-utils";
import {
  buildProjectContactOptions,
  findCompanyByProjectRef,
  getProjectAccountCompanyId,
} from "@/lib/project-stakeholder-contacts";
import { findStandardBioUserOption } from "@/lib/standard-bio-users";
import { SmartCRMIcon } from "@/components/ui/smartcrm-icon";
import { ContactCombobox } from "@/components/ui/contact-combobox";
import type { ProjectContactOption } from "@/lib/project-stakeholder-contacts";

const INFLUENCE_OPTIONS: StakeholderInfluence[] = ["High", "Medium", "Low"];
const CUSTOM_ROLE_VALUE = "__custom__";
const DEFAULT_ROLE = "Decision Maker";

/** Strip accidental markup fragments from contact title fields. */
function sanitizeDisplayText(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/<\/?[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function suggestRoleForContact(jobTitle?: string, role?: string): string {
  const corpus = `${jobTitle ?? ""} ${role ?? ""}`.toLowerCase();
  if (/ceo|chief|president|executive sponsor/.test(corpus)) return "Executive Sponsor";
  if (/procurement|buyer/.test(corpus)) return "Procurement";
  if (/operations|plant|technical/.test(corpus)) return "Technical Lead";
  if (/legal|counsel/.test(corpus)) return "Legal";
  return "Decision Maker";
}

export function ProjectStakeholdersRosterPanel({
  project,
  stakeholders,
  organizations,
  companies,
  standardBioUsers,
  readOnly = false,
  compact = false,
  onChange,
}: {
  project: Project;
  stakeholders: ProjectStakeholderRecord[];
  organizations: ProjectRelatedOrganization[];
  companies: Company[];
  standardBioUsers: SharePointPerson[];
  readOnly?: boolean;
  compact?: boolean;
  onChange?: (stakeholders: ProjectStakeholderRecord[]) => Promise<void>;
}) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [memberKind, setMemberKind] = useState<"user" | "contact">("contact");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [organizationId, setOrganizationId] = useState(
    organizations.find((org) => org.isPrimary)?.id ?? organizations[0]?.id ?? INTERNAL_ORGANIZATION_ID,
  );
  const [role, setRole] = useState(DEFAULT_ROLE);
  const [customRole, setCustomRole] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [influence, setInfluence] = useState<StakeholderInfluence>("Medium");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editCustomRole, setEditCustomRole] = useState("");
  const [editOrganizationId, setEditOrganizationId] = useState("");
  const [editResponsibilities, setEditResponsibilities] = useState("");
  const [editInfluence, setEditInfluence] = useState<StakeholderInfluence>("Medium");

  const roleOptions = useMemo(
    () => buildStakeholderRoleOptions(stakeholders.map((entry) => entry.role)),
    [stakeholders],
  );

  const assignedContactIds = useMemo(
    () => new Set(stakeholders.map((entry) => entry.contactId).filter(Boolean) as string[]),
    [stakeholders],
  );

  const contactOptions = useMemo(
    () =>
      buildProjectContactOptions(
        project,
        companies,
        organizations,
        assignedContactIds,
        project.removedStakeholders,
      ),
    [project, companies, organizations, assignedContactIds],
  );

  const accountCompanyName = useMemo(() => {
    const accountId = getProjectAccountCompanyId(project);
    return findCompanyByProjectRef(companies, accountId)?.Title;
  }, [project, companies]);

  const allContactOptions = useMemo(
    () => [...contactOptions.accountContacts, ...contactOptions.otherContacts],
    [contactOptions],
  );

  const organizationOptions = useMemo(() => {
    const base = [
      { id: INTERNAL_ORGANIZATION_ID, label: "Standard Bio (Internal)" },
      ...organizations.map((org) => ({
        id: org.id,
        label:
          findCompanyByProjectRef(companies, org.companyId)?.Title ??
          org.companyId,
      })),
    ];
    const selected = allContactOptions.find(
      (entry) => entry.contact.ContactID === selectedContactId,
    );
    if (!selected) return base;

    const alreadyLinked =
      base.some((option) => option.id === selected.companyId) ||
      organizations.some((org) => {
        const matched = findCompanyByProjectRef(companies, org.companyId);
        return (
          matched?.CompanyID === selected.companyId ||
          org.companyId === selected.companyId
        );
      });

    if (!alreadyLinked) {
      base.push({
        id: selected.companyId,
        label: `${selected.companyName} (contact company)`,
      });
    }
    return base;
  }, [organizations, companies, allContactOptions, selectedContactId]);

  const resolveOrgForContact = (
    option: ProjectContactOption,
    preferred?: string,
  ) => {
    const matchedOrg = organizations.find((org) => {
      const matched = findCompanyByProjectRef(companies, org.companyId);
      return (
        matched?.CompanyID === option.companyId || org.companyId === option.companyId
      );
    });
    if (matchedOrg) return matchedOrg.id;
    if (preferred && preferred !== INTERNAL_ORGANIZATION_ID) return preferred;
    // Persist company id directly — roster resolves Title via CompanyID fallback.
    return option.companyId;
  };

  const persist = async (next: ProjectStakeholderRecord[]) => {
    if (!onChange) {
      setFormError("You do not have permission to update stakeholders.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await onChange(next);
      setAssignOpen(false);
      setEditingId(null);
      setSelectedUserId("");
      setSelectedContactId("");
      setRole(DEFAULT_ROLE);
      setCustomRole("");
      setResponsibilities("");
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Could not save stakeholder.",
      );
    } finally {
      setSaving(false);
    }
  };

  const resolvedRole = (preset: string, custom: string) =>
    preset === CUSTOM_ROLE_VALUE ? custom.trim() : preset;

  const handleAdd = async () => {
    const finalRole = resolvedRole(role, customRole);
    setFormError(null);
    if (!finalRole) {
      setFormError("Enter a role for this stakeholder.");
      return;
    }
    if (!onChange) {
      setFormError("You do not have permission to update stakeholders.");
      return;
    }

    if (memberKind === "user") {
      const user = findStandardBioUserOption(standardBioUsers, Number(selectedUserId));
      if (!user) {
        setFormError("Select an internal user.");
        return;
      }
      await persist([
        ...stakeholders,
        {
          id: createStakeholderId(),
          role: finalRole,
          name: user.Title,
          userId: user.Id,
          organizationId: INTERNAL_ORGANIZATION_ID,
          responsibilities: responsibilities.trim() || undefined,
        },
      ]);
      return;
    }

    if (!selectedContactId) {
      setFormError("Select a contact.");
      return;
    }

    const option = allContactOptions.find(
      (entry) => entry.contact.ContactID === selectedContactId,
    );
    if (!option) {
      setFormError("Selected contact is no longer available. Refresh and try again.");
      return;
    }

    const orgForContact = resolveOrgForContact(option, organizationId);

    await persist([
      ...stakeholders,
      {
        id: createStakeholderId(),
        role: finalRole,
        name: getContactDisplayName(option.contact),
        contactId: option.contact.ContactID,
        organizationId: orgForContact,
        responsibilities: responsibilities.trim() || undefined,
        influence,
      },
    ]);
  };

  const handleRemove = async (id: string) => {
    await persist(stakeholders.filter((entry) => entry.id !== id));
  };

  const startEdit = (entry: ProjectStakeholderRecord) => {
    setEditingId(entry.id);
    setEditRole(roleOptions.includes(entry.role) ? entry.role : CUSTOM_ROLE_VALUE);
    setEditCustomRole(roleOptions.includes(entry.role) ? "" : entry.role);
    setEditOrganizationId(entry.organizationId);
    setEditResponsibilities(entry.responsibilities ?? "");
    setEditInfluence(entry.influence ?? "Medium");
  };

  const handleSaveEdit = async (id: string) => {
    const finalRole = resolvedRole(editRole, editCustomRole);
    if (!finalRole) return;
    await persist(
      stakeholders.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              role: finalRole,
              organizationId: editOrganizationId,
              responsibilities: editResponsibilities.trim() || undefined,
              influence: editInfluence,
            }
          : entry,
      ),
    );
  };

  const quickAddContact = async (contactId: string) => {
    const option = allContactOptions.find((entry) => entry.contact.ContactID === contactId);
    if (!option || !onChange) return;

    const orgForContact = resolveOrgForContact(option, organizationId);
    const suggestedRole = suggestRoleForContact(option.contact.JobTitle, option.contact.Role);

    await persist([
      ...stakeholders,
      {
        id: createStakeholderId(),
        role: suggestedRole,
        name: getContactDisplayName(option.contact),
        contactId: option.contact.ContactID,
        organizationId: orgForContact,
        influence: "High",
      },
    ]);
  };

  const addForm = assignOpen ? (
    <div className="border border-carbon-blue/10 bg-carbon-blue/[0.02] p-4">
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setMemberKind("contact")}
          className={`px-2 py-1 text-[11px] font-semibold ${memberKind === "contact" ? "text-upcycle-orange" : "text-carbon-blue/45"}`}
        >
          Contact
        </button>
        <button
          type="button"
          onClick={() => setMemberKind("user")}
          className={`px-2 py-1 text-[11px] font-semibold ${memberKind === "user" ? "text-upcycle-orange" : "text-carbon-blue/45"}`}
        >
          Internal user
        </button>
      </div>

      {memberKind === "user" ? (
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">User</span>
          <select
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
            className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px]"
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
        <div className="block">
          <ContactCombobox
            options={allContactOptions}
            selectedContactId={selectedContactId}
            onSelect={(option) => {
              if (!option) {
                setSelectedContactId("");
                return;
              }
              setSelectedContactId(option.contact.ContactID);
              setOrganizationId(resolveOrgForContact(option));
              if (!customRole) {
                setRole(suggestRoleForContact(option.contact.JobTitle, option.contact.Role));
              }
            }}
            disabled={saving}
            groupAccountLabel={
              accountCompanyName ? `From ${accountCompanyName}` : "From connected account"
            }
            groupOtherLabel="Search all contacts"
            emptyMessage={
              allContactOptions.length === 0
                ? "No contacts available. Create contacts on a company first."
                : "No contacts match your search."
            }
          />
        </div>
      )}

      <div className="mt-3">
        <RolePicker
          role={role}
          customRole={customRole}
          roleOptions={roleOptions}
          onRoleChange={setRole}
          onCustomRoleChange={setCustomRole}
        />
      </div>

      {memberKind === "contact" ? (
        <>
          <label className="mt-3 block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
              Organization
            </span>
            <select
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
              className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px]"
            >
              {organizationOptions
                .filter((option) => option.id !== INTERNAL_ORGANIZATION_ID)
                .map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
            </select>
          </label>
          <label className="mt-3 block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
              Influence
            </span>
            <select
              value={influence}
              onChange={(event) => setInfluence(event.target.value as StakeholderInfluence)}
              className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px]"
            >
              {INFLUENCE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}

      <label className="mt-3 block">
        <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
          Responsibilities (optional)
        </span>
        <input
          value={responsibilities}
          onChange={(event) => setResponsibilities(event.target.value)}
          className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px]"
          placeholder="What this person owns on the project"
        />
      </label>

      {formError ? (
        <p className="mt-3 text-[12px] text-thermal-red/90" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleAdd()}
          className="border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Adding…" : "Add stakeholder"}
        </button>
        <button
          type="button"
          onClick={() => {
            setAssignOpen(false);
            setFormError(null);
          }}
          className="px-3 py-1.5 text-xs font-semibold text-carbon-blue/55"
        >
          Cancel
        </button>
      </div>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setAssignOpen(true)}
      className="inline-flex items-center gap-1.5 border border-carbon-blue/12 px-3 py-1.5 text-[11px] font-semibold text-carbon-blue/65 hover:border-upcycle-orange/30 hover:text-upcycle-orange"
    >
      <SmartCRMIcon name="add" size="xs" />
      + Add Stakeholder
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      {stakeholders.length === 0 ? (
        <p className="text-sm text-carbon-blue/45">
          No stakeholders assigned. Add contacts from the connected account or internal delivery team.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-carbon-blue/10 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                <th className="px-2 py-2">Stakeholder</th>
                <th className="px-2 py-2">Organization</th>
                <th className="px-2 py-2">Role</th>
                {!compact ? <th className="px-2 py-2">Responsibilities</th> : null}
                {!readOnly && onChange ? <th className="px-2 py-2"> </th> : null}
              </tr>
            </thead>
            <tbody>
              {stakeholders.map((entry) => {
                const org = resolveStakeholderOrganizationName(entry, organizations, companies);
                const isEditing = editingId === entry.id;

                return (
                  <tr key={entry.id} className="border-b border-carbon-blue/5 align-top">
                    <td className="px-2 py-2.5">
                      {entry.contactId ? (
                        <Link
                          href={contact360Href(entry.contactId)}
                          className="font-medium text-carbon-blue hover:text-upcycle-orange"
                        >
                          {entry.name}
                        </Link>
                      ) : (
                        <span className="font-medium text-carbon-blue">{entry.name}</span>
                      )}
                      {entry.influence ? (
                        <p className="text-[11px] text-carbon-blue/45">{entry.influence} influence</p>
                      ) : null}
                    </td>
                    <td className="px-2 py-2.5 text-carbon-blue/70">
                      {isEditing ? (
                        <select
                          value={editOrganizationId}
                          onChange={(event) => setEditOrganizationId(event.target.value)}
                          className="w-full border border-carbon-blue/15 bg-white px-2 py-1 text-[12px]"
                        >
                          {organizationOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        org.name
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-carbon-blue/70">
                      {isEditing ? (
                        <div className="flex flex-col gap-2">
                          <RolePicker
                            role={editRole}
                            customRole={editCustomRole}
                            roleOptions={roleOptions}
                            onRoleChange={setEditRole}
                            onCustomRoleChange={setEditCustomRole}
                          />
                          <label className="block">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                              Influence
                            </span>
                            <select
                              value={editInfluence}
                              onChange={(event) =>
                                setEditInfluence(event.target.value as StakeholderInfluence)
                              }
                              className="mt-1 w-full border border-carbon-blue/15 bg-white px-2 py-1 text-[12px]"
                            >
                              {INFLUENCE_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      ) : (
                        entry.role
                      )}
                    </td>
                    {!compact ? (
                      <td className="px-2 py-2.5 text-carbon-blue/55">
                        {isEditing ? (
                          <input
                            value={editResponsibilities}
                            onChange={(event) => setEditResponsibilities(event.target.value)}
                            className="w-full border border-carbon-blue/15 bg-white px-2 py-1 text-[12px]"
                            placeholder="Responsibilities"
                          />
                        ) : (
                          entry.responsibilities ?? "—"
                        )}
                      </td>
                    ) : null}
                    {!readOnly && onChange ? (
                      <td className="px-2 py-2.5">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void handleSaveEdit(entry.id)}
                              className="text-[11px] font-semibold text-upcycle-orange"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="text-[11px] font-semibold text-carbon-blue/45"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(entry)}
                              className="text-[11px] font-semibold text-carbon-blue/45 hover:text-carbon-blue"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleRemove(entry.id)}
                              className="text-[11px] font-semibold text-carbon-blue/45 hover:text-red-600"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!readOnly && onChange && contactOptions.accountContacts.length > 0 ? (
        <section className="border border-carbon-blue/10 bg-carbon-blue/[0.02] px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/45">
            Suggested contacts
            {accountCompanyName ? ` · ${accountCompanyName}` : ""}
          </p>
          <p className="mt-1 text-[12px] text-carbon-blue/55">
            SmartAssist recommends contacts from the connected account. You decide who to add.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {contactOptions.accountContacts.slice(0, 6).map((option) => (
              <li key={option.contact.ContactID} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-medium text-carbon-blue">
                    {getContactDisplayName(option.contact)}
                  </p>
                  <p className="text-[11px] text-carbon-blue/45">
                    {sanitizeDisplayText(option.contact.JobTitle) ||
                      sanitizeDisplayText(option.contact.Role) ||
                      option.companyName}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void quickAddContact(option.contact.ContactID)}
                  className="shrink-0 text-[11px] font-semibold text-upcycle-orange hover:text-carbon-blue disabled:opacity-50"
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!readOnly && onChange ? addForm : null}
    </div>
  );
}

function RolePicker({
  role,
  customRole,
  roleOptions,
  onRoleChange,
  onCustomRoleChange,
}: {
  role: string;
  customRole: string;
  roleOptions: string[];
  onRoleChange: (value: string) => void;
  onCustomRoleChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block">
        <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">Role</span>
        <select
          value={role}
          onChange={(event) => onRoleChange(event.target.value)}
          className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px]"
        >
          {roleOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          <option value={CUSTOM_ROLE_VALUE}>+ Create new role…</option>
        </select>
      </label>
      {role === CUSTOM_ROLE_VALUE ? (
        <input
          value={customRole}
          onChange={(event) => onCustomRoleChange(event.target.value)}
          placeholder="Enter custom role"
          className="mt-2 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px]"
        />
      ) : null}
    </div>
  );
}
