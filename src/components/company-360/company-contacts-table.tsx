"use client";

import { useMemo, useState } from "react";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { Contact, CreateContactInput, UpdateContactInput, BuyingRole } from "@/types/contact";
import type { PipelineRow } from "@/types/pipeline";
import { opportunityPublicCode } from "@/types/pipeline";
import type { Project, StakeholderInfluence } from "@/types/project";
import type { ProjectOrganizationType } from "@/types/project-relationships";
import { getContactDisplayName, isBuyingRoleUnknown } from "@/types/contact";
import { getContactProjectRolesOnCompany } from "@/lib/project-team-utils";
import { getActivitiesForContact } from "@/lib/activity-utils";
import { laterIso } from "@/lib/contact-360-verdict";
import { decodePhoneForDisplay } from "@/lib/company-identity";
import { formatRelativeTime } from "@/lib/relative-time";
import {
  canDeleteContact,
  canManageOpportunityStakeholders,
  canManageProjectStakeholders,
} from "@/lib/permissions";
import {
  buildOpportunityStakeholderRoleOptions,
  suggestOpportunityRoleForContact,
} from "@/lib/opportunity-stakeholder-utils";
import {
  buildStakeholderRoleOptions,
  createStakeholderId,
  ensureCompanyLinkedToProject,
  getProjectStakeholders,
} from "@/lib/project-relationship-utils";
import { getCompanyRelationshipPosture } from "@/lib/company-classification";
import { syncProjectRecord } from "@/lib/sync-project";
import { linkCompanyToOpportunity } from "@/lib/sync-company-opportunity-link";
import { findCountryEntry } from "@/lib/geo/country-continent";
import { stripBareDialCode } from "@/lib/m365/phone-normalization";
import type { UserRole } from "@/types/auth";
import {
  ContactLink,
  DealLink,
  EmailActionMenu,
  PhoneActionMenu,
  ProjectLink,
} from "@/components/relationship/relationship-links";
import {
  BuyingRoleSelect,
  ContactFormFields,
  emptyContactForm,
  isContactFormValid,
} from "@/components/contacts/contact-form-fields";
import { ActionMenu, ActionMenuItem } from "@/components/relationship/action-menu";
import { DestructiveConfirmPanel } from "@/components/ui/destructive-confirm-panel";
import {
  companyNeedsSelectDisambiguation,
  formatCompanySelectLabel,
} from "@/lib/m365/company-resolution";

/** Strip leaked HTML / markup from contact fields before display. */
function sanitizeContactDisplayField(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  if (/<\/?[a-z][\s\S]*>/i.test(trimmed) || trimmed.includes("</")) return "";
  return trimmed.replace(/<[^>]*>/g, "").trim();
}
import { IconLabel, SmartCRMIcon } from "@/components/ui/smartcrm-icon";
import { useWhenChanged } from "@/hooks/use-when-changed";

type ContactRowAction =
  | { contactId: string; type: "reassign" }
  | { contactId: string; type: "delete" }
  | { contactId: string; type: "archive" }
  | { contactId: string; type: "associate" };

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
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-carbon-blue/65 hover:text-carbon-blue">
            ···
          </span>
        }
      >
        <ActionMenuItem
          onClick={() => onActionChange({ contactId: contact.ContactID, type: "associate" })}
        >
          Associate with opportunity / project
        </ActionMenuItem>
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
          <p className="text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/65">
            Reassign contact
          </p>
          <select
            value={targetCompanyId}
            onChange={(event) => setTargetCompanyId(event.target.value)}
            className="mt-2 w-full border border-carbon-blue/15 bg-white px-2 py-1.5 text-[13px] text-carbon-blue"
          >
            {reassignOptions.map((company) => (
              <option key={company.CompanyID} value={company.CompanyID}>
                {formatCompanySelectLabel(
                  company,
                  companyNeedsSelectDisambiguation(company, reassignOptions),
                )}
              </option>
            ))}
          </select>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy || !targetCompanyId}
              onClick={() => void handleReassign()}
              className="border border-upcycle-orange bg-upcycle-orange px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white disabled:opacity-50"
            >
              {busy ? "Moving…" : "Move"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onActionChange(null)}
              className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/55"
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

function BuyingRoleCell({
  contact,
  onContactUpdate,
}: {
  contact: Contact;
  onContactUpdate?: (contactId: string, patch: UpdateContactInput) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const buyingRole = contact.buyingRole;

  const persist = async (next: BuyingRole | undefined) => {
    if (!onContactUpdate) return;
    setBusy(true);
    try {
      await onContactUpdate(contact.ContactID, {
        buyingRole: (next ?? "") as BuyingRole,
      });
    } finally {
      setBusy(false);
    }
  };

  if (!onContactUpdate) {
    return (
      <span
        className={
          isBuyingRoleUnknown(buyingRole)
            ? "text-[13px] font-medium text-upcycle-orange"
            : "text-[13px] text-carbon-blue/70"
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
      onChange={(next) => void persist(next)}
      className={`w-full min-w-0 border bg-white px-1.5 py-1 text-[13px] outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40 ${
        buyingRole && !isBuyingRoleUnknown(buyingRole)
          ? "border-carbon-blue/15 text-carbon-blue"
          : "border-upcycle-orange/35 text-upcycle-orange"
      }`}
    />
  );
}

function resolveOrganizationTypeForCompany(company?: Company): ProjectOrganizationType {
  if (!company) return "other";
  const posture = getCompanyRelationshipPosture(company);
  if (posture === "sell_to") return "customer";
  if (posture === "buy_from") return "supplier";
  if (posture === "collaborate") return "partner";
  if (posture === "fund") return "investor";
  if (posture === "internal") return "internal";
  return "other";
}

function ContactWorkAssociationInline({
  contact,
  companyId,
  companies,
  role,
  projects,
  pipelines,
  onAssignOpportunityStakeholder,
  onProjectUpdated,
  onCompanyUpdated,
  onClose,
}: {
  contact: Contact;
  companyId: string;
  companies: Company[];
  role: UserRole;
  projects: Project[];
  pipelines: PipelineRow[];
  onAssignOpportunityStakeholder?: (
    dealId: string,
    contactId: string,
    projectRole: string,
  ) => Promise<PipelineRow>;
  onProjectUpdated?: (project: Project) => void;
  onCompanyUpdated?: (company: Company) => void;
  onClose: () => void;
}) {
  const company = companies.find((c) => c.CompanyID === companyId);
  const canOpp = canManageOpportunityStakeholders(role) && Boolean(onAssignOpportunityStakeholder);
  const canProj = canManageProjectStakeholders(role);

  const [mode, setMode] = useState<"project" | "opportunity">(
    canProj ? "project" : "opportunity",
  );
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectRole, setProjectRole] = useState("Decision Maker");
  const [influence, setInfluence] = useState<StakeholderInfluence>("Medium");
  const [selectedDealId, setSelectedDealId] = useState("");
  const [dealRole, setDealRole] = useState(() =>
    suggestOpportunityRoleForContact(contact),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableProjects = useMemo(
    () =>
      projects
        .filter((project) => project.status !== "Completed")
        .filter(
          (project) =>
            !getProjectStakeholders(project).some(
              (member) => member.contactId === contact.ContactID,
            ),
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [projects, contact.ContactID],
  );

  const availableDeals = useMemo(() => {
    const companyDeals = new Set(company?.pipelineIds ?? []);
    const eligible = pipelines.filter(
      (deal) =>
        !deal.team?.some((member) => member.contactId === contact.ContactID),
    );
    return [...eligible].sort((a, b) => {
      const aIn = companyDeals.has(a.id) ? 0 : 1;
      const bIn = companyDeals.has(b.id) ? 0 : 1;
      if (aIn !== bIn) return aIn - bIn;
      return a.assetName.localeCompare(b.assetName);
    });
  }, [pipelines, company?.pipelineIds, contact.ContactID]);

  const projectRoleOptions = useMemo(
    () => buildStakeholderRoleOptions([projectRole]),
    [projectRole],
  );
  const dealRoleOptions = useMemo(
    () => buildOpportunityStakeholderRoleOptions([dealRole]),
    [dealRole],
  );

  const handleSaveProject = async () => {
    setError(null);
    const target = availableProjects.find((p) => p.id === selectedProjectId);
    if (!target) {
      setError("Select a project.");
      return;
    }
    setBusy(true);
    try {
      const ensured = company
        ? ensureCompanyLinkedToProject(target, company.CompanyID, {
            organizationType: resolveOrganizationTypeForCompany(company),
            label: company.Title,
          })
        : { project: target, organizationId: companyId };
      const nextStakeholders = [
        ...getProjectStakeholders(ensured.project),
        {
          id: createStakeholderId(),
          role: projectRole.trim() || "Stakeholder",
          name: getContactDisplayName(contact),
          contactId: contact.ContactID,
          organizationId: ensured.organizationId,
          influence,
        },
      ];
      const removedStakeholders = (target.removedStakeholders ?? []).filter(
        (entry) => entry.contactId !== contact.ContactID,
      );
      const updated = await syncProjectRecord(
        target.id,
        {
          projectStakeholders: nextStakeholders,
          relatedOrganizations: ensured.project.relatedOrganizations,
          linkedCompanyId: ensured.project.linkedCompanyId,
          removedStakeholders,
        },
        role,
      );
      onProjectUpdated?.(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add to project.");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveOpportunity = async () => {
    setError(null);
    if (!onAssignOpportunityStakeholder) return;
    const target = availableDeals.find((d) => d.id === selectedDealId);
    if (!target) {
      setError("Select an opportunity.");
      return;
    }
    setBusy(true);
    try {
      await onAssignOpportunityStakeholder(
        target.id,
        contact.ContactID,
        dealRole.trim() || "Champion",
      );
      if (company && !company.pipelineIds.includes(target.id)) {
        try {
          const updatedCompany = await linkCompanyToOpportunity(
            company.CompanyID,
            target.id,
            role,
          );
          onCompanyUpdated?.(updatedCompany);
        } catch {
          // Stakeholder link succeeded; company link is best-effort.
        }
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not add to opportunity.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-1.5 border border-upcycle-orange/25 bg-white p-2.5 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex gap-1">
          {canProj ? (
            <button
              type="button"
              onClick={() => {
                setMode("project");
                setError(null);
              }}
              className={`px-2 py-0.5 text-[11px] font-semibold ${
                mode === "project"
                  ? "bg-upcycle-orange text-white"
                  : "bg-carbon-blue/[0.04] text-carbon-blue/70 hover:text-carbon-blue"
              }`}
            >
              Project
            </button>
          ) : null}
          {canOpp ? (
            <button
              type="button"
              onClick={() => {
                setMode("opportunity");
                setError(null);
              }}
              className={`px-2 py-0.5 text-[11px] font-semibold ${
                mode === "opportunity"
                  ? "bg-upcycle-orange text-white"
                  : "bg-carbon-blue/[0.04] text-carbon-blue/70 hover:text-carbon-blue"
              }`}
            >
              Opportunity
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] font-semibold text-carbon-blue/50 hover:text-carbon-blue"
        >
          Close
        </button>
      </div>

      {mode === "project" ? (
        <div className="space-y-2">
          <select
            aria-label="Select project"
            value={selectedProjectId}
            disabled={busy}
            onChange={(event) => setSelectedProjectId(event.target.value)}
            className="w-full border border-carbon-blue/15 bg-white px-2 py-1 text-[12px] text-carbon-blue"
          >
            <option value="">Select project…</option>
            {availableProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} ({project.id})
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-1.5">
            <select
              aria-label="Project role"
              value={projectRole}
              disabled={busy}
              onChange={(event) => setProjectRole(event.target.value)}
              className="w-full border border-carbon-blue/15 bg-white px-2 py-1 text-[12px] text-carbon-blue"
            >
              {projectRoleOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <select
              aria-label="Influence"
              value={influence}
              disabled={busy}
              onChange={(event) =>
                setInfluence(event.target.value as StakeholderInfluence)
              }
              className="w-full border border-carbon-blue/15 bg-white px-2 py-1 text-[12px] text-carbon-blue"
            >
              <option value="High">High influence</option>
              <option value="Medium">Medium influence</option>
              <option value="Low">Low influence</option>
            </select>
          </div>
          {error ? <p className="text-[11px] text-thermal-red">{error}</p> : null}
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={busy || !selectedProjectId}
              onClick={() => void handleSaveProject()}
              className="border border-upcycle-orange bg-upcycle-orange px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Adding…" : "Add to project"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="border border-carbon-blue/15 px-2 py-1 text-[11px] font-semibold text-carbon-blue/65"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <select
            aria-label="Select opportunity"
            value={selectedDealId}
            disabled={busy}
            onChange={(event) => setSelectedDealId(event.target.value)}
            className="w-full border border-carbon-blue/15 bg-white px-2 py-1 text-[12px] text-carbon-blue"
          >
            <option value="">Select opportunity…</option>
            {availableDeals.map((deal) => (
              <option key={deal.id} value={deal.id}>
                {opportunityPublicCode(deal)} · {deal.assetName}
              </option>
            ))}
          </select>
          <select
            aria-label="Opportunity role"
            value={dealRole}
            disabled={busy}
            onChange={(event) => setDealRole(event.target.value)}
            className="w-full border border-carbon-blue/15 bg-white px-2 py-1 text-[12px] text-carbon-blue"
          >
            {dealRoleOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {error ? <p className="text-[11px] text-thermal-red">{error}</p> : null}
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={busy || !selectedDealId}
              onClick={() => void handleSaveOpportunity()}
              className="border border-upcycle-orange bg-upcycle-orange px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Adding…" : "Add to opportunity"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="border border-carbon-blue/15 px-2 py-1 text-[11px] font-semibold text-carbon-blue/65"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
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
  pipelines = [],
  activeAction,
  onActionChange,
  onContactUpdate,
  onContactDelete,
  onContactReassign,
  onContactArchive,
  onAssignOpportunityStakeholder,
  onProjectUpdated,
  onCompanyUpdated,
  lastMailAt,
}: {
  contact: Contact;
  companyId: string;
  companies: Company[];
  role: UserRole;
  activities: Activity[];
  projects?: Project[];
  pipelines?: PipelineRow[];
  activeAction: ContactRowAction | null;
  onActionChange: (action: ContactRowAction | null) => void;
  onContactUpdate?: (contactId: string, patch: UpdateContactInput) => Promise<void>;
  onContactDelete?: (contactId: string) => Promise<void>;
  onContactReassign?: (contactId: string, targetCompanyId: string) => Promise<void>;
  onContactArchive?: (contactId: string, archived: boolean) => Promise<void>;
  onAssignOpportunityStakeholder?: (
    dealId: string,
    contactId: string,
    projectRole: string,
  ) => Promise<PipelineRow>;
  onProjectUpdated?: (project: Project) => void;
  onCompanyUpdated?: (company: Company) => void;
  lastMailAt?: string | null;
}) {
  const roleLabel =
    sanitizeContactDisplayField(contact.JobTitle) ||
    sanitizeContactDisplayField(contact.Role) ||
    "—";
  const phone = decodePhoneForDisplay(contact.Mobile || contact.Phone);
  const contactActivities = getActivitiesForContact(activities, contact.ContactID, contact);
  const lastInteractionAt = laterIso(
    contactActivities[0]?.ActivityDate,
    lastMailAt,
  );
  const lastTouchIsOutlook =
    Boolean(lastMailAt) && lastInteractionAt === lastMailAt;
  const canManage = canDeleteContact(role);
  const canAssociate =
    canManageProjectStakeholders(role) ||
    (canManageOpportunityStakeholders(role) && Boolean(onAssignOpportunityStakeholder));
  const isAssociateOpen =
    activeAction?.contactId === contact.ContactID && activeAction.type === "associate";
  const projectRoles = getContactProjectRolesOnCompany(
    contact.ContactID,
    companyId,
    projects,
  );
  const dealRoles = useMemo(
    () =>
      pipelines.flatMap((deal) => {
        const member = deal.team?.find((m) => m.contactId === contact.ContactID);
        if (!member) return [];
        return [{ dealId: deal.id, dealName: deal.assetName, role: member.projectRole }];
      }),
    [pipelines, contact.ContactID],
  );

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
              className="shrink-0 border border-thermal-red/25 bg-thermal-red/[0.06] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-thermal-red"
              title="Flagged as suspicious — review name, email, or company match"
            >
              Suspicious
            </span>
          ) : null}
        </div>
      </td>
      <td className="truncate px-3 py-2.5 text-[13px] text-carbon-blue/60">{roleLabel}</td>
      <td className="px-3 py-2.5">
        <BuyingRoleCell contact={contact} onContactUpdate={onContactUpdate} />
      </td>
      <td className="px-3 py-2.5 text-[13px] text-carbon-blue/65">
        <div className="flex flex-col gap-1">
          {projectRoles.map((pr) => (
            <div
              key={`${pr.projectId}-${pr.projectRole}`}
              className="flex flex-wrap items-center gap-1 text-[12px]"
            >
              <span className="text-carbon-blue/60">{pr.projectRole} ·</span>
              <ProjectLink
                projectId={pr.projectId}
                showIcon={false}
                className="font-semibold text-carbon-blue hover:text-upcycle-orange"
              >
                {pr.projectName}
              </ProjectLink>
            </div>
          ))}
          {dealRoles.map((dr) => (
            <div
              key={`${dr.dealId}-${dr.role}`}
              className="flex flex-wrap items-center gap-1 text-[12px]"
            >
              <span className="text-carbon-blue/60">{dr.role} ·</span>
              <DealLink
                dealId={dr.dealId}
                showIcon={false}
                className="font-semibold text-carbon-blue hover:text-upcycle-orange"
              >
                {dr.dealName}
              </DealLink>
            </div>
          ))}
          {canAssociate && !isAssociateOpen ? (
            <button
              type="button"
              onClick={() =>
                onActionChange({ contactId: contact.ContactID, type: "associate" })
              }
              className="w-fit text-left text-[11px] font-semibold text-upcycle-orange hover:underline"
            >
              {projectRoles.length === 0 && dealRoles.length === 0
                ? "+ Link opportunity / project"
                : "+ Add role"}
            </button>
          ) : projectRoles.length === 0 && dealRoles.length === 0 ? (
            <span className="text-carbon-blue/50">—</span>
          ) : null}
          {isAssociateOpen ? (
            <ContactWorkAssociationInline
              contact={contact}
              companyId={companyId}
              companies={companies}
              role={role}
              projects={projects}
              pipelines={pipelines}
              onAssignOpportunityStakeholder={onAssignOpportunityStakeholder}
              onProjectUpdated={onProjectUpdated}
              onCompanyUpdated={onCompanyUpdated}
              onClose={() => onActionChange(null)}
            />
          ) : null}
        </div>
      </td>
      <td className="px-3 py-2.5 text-[13px]">
        {contact.Email ? (
          <EmailActionMenu email={contact.Email} />
        ) : (
          <span className="text-carbon-blue/50">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-[13px]">
        {phone ? (
          <PhoneActionMenu phone={phone} />
        ) : (
          <span className="text-carbon-blue/50">—</span>
        )}
      </td>
      <td className="truncate px-3 py-2.5 text-[13px] text-carbon-blue/50">
        {lastInteractionAt
          ? (
            <>
              {formatRelativeTime(lastInteractionAt)}
              {lastTouchIsOutlook ? (
                <span className="text-carbon-blue/60"> · Outlook</span>
              ) : null}
            </>
          )
          : "No interaction"}
        {contact.EmploymentStatus && contact.EmploymentStatus !== "Active" ? (
          <span className="ml-2 border border-carbon-blue/15 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/65">
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
  pipelines = [],
  onCreateContact,
  onContactUpdate,
  onContactDelete,
  onContactReassign,
  onContactArchive,
  onAssignOpportunityStakeholder,
  onProjectUpdated,
  onCompanyUpdated,
  createRequestId = 0,
  lastMailByContactId = {},
}: {
  contacts: Contact[];
  companyId: string;
  companies: Company[];
  role: UserRole;
  activities: Activity[];
  projects?: Project[];
  pipelines?: PipelineRow[];
  onCreateContact?: (input: CreateContactInput) => Promise<void>;
  onContactUpdate?: (contactId: string, patch: UpdateContactInput) => Promise<void>;
  onContactDelete?: (contactId: string) => Promise<void>;
  onContactReassign?: (contactId: string, targetCompanyId: string) => Promise<void>;
  onContactArchive?: (contactId: string, archived: boolean) => Promise<void>;
  onAssignOpportunityStakeholder?: (
    dealId: string,
    contactId: string,
    projectRole: string,
  ) => Promise<PipelineRow>;
  onProjectUpdated?: (project: Project) => void;
  onCompanyUpdated?: (company: Company) => void;
  createRequestId?: number;
  lastMailByContactId?: Record<string, string>;
}) {
  const currentCompany = useMemo(
    () => companies.find((c) => c.CompanyID === companyId),
    [companies, companyId],
  );
  const buildDefaultContactForm = useMemo(() => {
    return (): CreateContactInput => {
      const base = emptyContactForm();
      const countryRaw = currentCompany?.Country?.Title?.trim() || "";
      const geo = findCountryEntry(currentCompany?.countryCode || countryRaw);
      return {
        ...base,
        country: geo?.name || countryRaw || base.country,
        countryCode: geo?.code || currentCompany?.countryCode || base.countryCode,
        continent: geo?.continent || currentCompany?.continent || base.continent,
        city: currentCompany?.City || base.city,
        Company: { CompanyID: companyId },
      };
    };
  }, [currentCompany, companyId]);

  const [createOpen, setCreateOpen] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [activeAction, setActiveAction] = useState<ContactRowAction | null>(null);
  const [contactForm, setContactForm] = useState<CreateContactInput>(() =>
    buildDefaultContactForm(),
  );
  const canManage = canDeleteContact(role);
  const sortedContacts = useMemo(
    () =>
      [...contacts].sort((a, b) => {
        const aKnown = isBuyingRoleUnknown(a.buyingRole) ? 0 : 1;
        const bKnown = isBuyingRoleUnknown(b.buyingRole) ? 0 : 1;
        if (aKnown !== bKnown) return aKnown - bKnown;
        return getContactDisplayName(a).localeCompare(getContactDisplayName(b));
      }),
    [contacts],
  );
  const unknownBuyingRoleCount = contacts.filter((contact) =>
    isBuyingRoleUnknown(contact.buyingRole),
  ).length;

  useWhenChanged([createRequestId], () => {
    if (createRequestId > 0) {
      setCreateOpen(true);
    }
  });

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
        Phone: stripBareDialCode(contactForm.Phone),
        Mobile: stripBareDialCode(contactForm.Mobile),
        Company: { CompanyID: companyId },
      });
      setContactForm(buildDefaultContactForm());
      setCreateOpen(false);
    } finally {
      setSavingContact(false);
    }
  };

  if (contacts.length === 0 && !onCreateContact) {
    return <p className="text-sm text-carbon-blue/65">No contacts yet.</p>;
  }

  return (
    <div className="flex min-h-0 flex-col">
      {unknownBuyingRoleCount > 0 ? (
        <p className="mb-2 text-[13px] text-upcycle-orange">
          {unknownBuyingRoleCount === 1
            ? "1 person's buying role is unknown."
            : `${unknownBuyingRoleCount} people's buying roles are unknown.`}{" "}
          Unknown stays unknown until you classify it. Use No Buying Role when they are not in the buying center.
        </p>
      ) : null}
      {sortedContacts.length > 0 ? (
        <div className="w-full overflow-x-auto"><table className="w-full min-w-[760px] table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-[16%]" />
            <col className="w-[11%]" />
            <col className="w-[14%]" />
            <col className="w-[13%]" />
            <col className="w-[16%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            {canManage ? <col className="w-[6%]" /> : null}
          </colgroup>
          <thead>
            <tr className="border-b border-carbon-blue/8 bg-carbon-blue/[0.03]">
              <th className="px-3 py-2 text-left">
                <IconLabel icon="contact" iconSize="xs" className="text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/65">
                  Name
                </IconLabel>
              </th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/65">
                Role
              </th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/65">
                Buying role
              </th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/65">
                Project roles
              </th>
              <th className="px-3 py-2 text-left">
                <IconLabel icon="email" iconSize="xs" className="text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/65">
                  Email
                </IconLabel>
              </th>
              <th className="px-3 py-2 text-left">
                <IconLabel icon="phone" iconSize="xs" className="text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/65">
                  Phone
                </IconLabel>
              </th>
              <th className="px-3 py-2 text-left">
                <IconLabel icon="meeting" iconSize="xs" className="text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/65">
                  Last Interaction
                </IconLabel>
              </th>
              {canManage ? (
                <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/65">
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {sortedContacts.map((contact) => (
              <ContactTableRow
                key={contact.ContactID}
                contact={contact}
                companyId={companyId}
                companies={companies}
                role={role}
                activities={activities}
                projects={projects}
                pipelines={pipelines}
                activeAction={activeAction}
                onActionChange={setActiveAction}
                onContactUpdate={onContactUpdate}
                onContactDelete={onContactDelete}
                onContactReassign={onContactReassign}
                onContactArchive={onContactArchive}
                onAssignOpportunityStakeholder={onAssignOpportunityStakeholder}
                onProjectUpdated={onProjectUpdated}
                onCompanyUpdated={onCompanyUpdated}
                lastMailAt={lastMailByContactId[contact.ContactID] ?? null}
              />
            ))}
          </tbody>
        </table></div>
      ) : (
        <p className="text-sm text-carbon-blue/65">No contacts yet.</p>
      )}

      {onCreateContact ? (
        <div className="mt-4 shrink-0">
          {createOpen ? (
            <div className="border border-carbon-blue/10 bg-carbon-blue/[0.02] p-4">
              <ContactFormFields
                form={contactForm}
                onChange={setContactForm}
                companies={companies}
                companyId={companyId}
              />
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
              className="inline-flex items-center gap-1.5 border border-carbon-blue/12 px-3 py-1.5 text-[12px] font-semibold text-carbon-blue/65 transition-colors hover:border-upcycle-orange/30 hover:text-upcycle-orange"
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
