"use client";

import { useEffect, useMemo, useState } from "react";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { Contact } from "@/types/contact";
import { getContactDisplayName } from "@/types/contact";
import type { CreateOpportunityInput } from "@/types/deal";
import type { PipelineRow, CompanyRole } from "@/types/pipeline";
import { COMPANY_ROLES, formatDealValue } from "@/types/pipeline";
import { OpportunitiesOverviewTable } from "@/components/opportunity/opportunities-overview-table";
import { DealLink } from "@/components/relationship/relationship-links";
import { SmartCRMIcon } from "@/components/ui/smartcrm-icon";
import {
  formatSuggestedContactLabel,
  normalizeStakeholderRole,
  suggestOpportunityRoleForContact,
} from "@/lib/opportunity-stakeholder-utils";
import { OpportunityOfferingsPicker } from "@/components/opportunity/opportunity-offerings-picker";
import { formatOfferingLabels } from "@/lib/standard-bio-offerings";
import {
  buildOfferingIntelligence,
} from "@/lib/offering-intelligence";
import { StakeholderRoleSelect } from "@/components/opportunity/stakeholder-role-select";
import { AsyncSubmitButton } from "@/components/ui/async-submit-button";
import { useFormSubmitLock } from "@/hooks/use-form-submit-lock";

type CreateFormState = {
  assetName: string;
  companyRole: CompanyRole;
  salesValue: string;
  expectedCloseDate: string;
  offeringIds: string[];
};

const EMPTY_FORM: CreateFormState = {
  assetName: "",
  companyRole: "Technology Buyer",
  salesValue: "",
  expectedCloseDate: "",
  offeringIds: [],
};

function parseOptionalValue(raw: string): number | undefined {
  const trimmed = raw.trim().replace(/[^\d.]/g, "");
  if (!trimmed) return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

export function CompanyOpportunitiesSection({
  deals,
  commercialPackages,
  company,
  canCreate = false,
  canManageStakeholders = false,
  onCreateOpportunity,
  onAssignStakeholder,
  createRequestId = 0,
}: {
  deals: PipelineRow[];
  commercialPackages: CommercialPackage[];
  company: Company;
  canCreate?: boolean;
  canManageStakeholders?: boolean;
  onCreateOpportunity?: (input: CreateOpportunityInput) => Promise<PipelineRow>;
  onAssignStakeholder?: (
    dealId: string,
    contactId: string,
    projectRole: string,
  ) => Promise<PipelineRow>;
  createRequestId?: number;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateFormState>(EMPTY_FORM);
  const { isSubmitting: saving, runLocked } = useFormSubmitLock();
  const [error, setError] = useState<string | null>(null);
  const [createdDeal, setCreatedDeal] = useState<PipelineRow | null>(null);
  const [stakeholderOpen, setStakeholderOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [stakeholderRole, setStakeholderRole] = useState("Champion");
  const [savingStakeholder, setSavingStakeholder] = useState(false);

  useEffect(() => {
    if (createRequestId > 0 && canCreate) {
      setCreateOpen(true);
      setCreatedDeal(null);
      setStakeholderOpen(false);
      setError(null);
    }
  }, [createRequestId, canCreate]);

  const extraRoles = useMemo(() => {
    const fromOfferings = createdDeal
      ? buildOfferingIntelligence(createdDeal.offeringIds).suggestedStakeholderRoles
      : [];
    return [
      ...fromOfferings,
      ...((createdDeal?.team ?? []).map((member) => member.projectRole).filter(Boolean)),
    ];
  }, [createdDeal]);

  const suggestedContacts = useMemo(() => {
    const assigned = new Set((createdDeal?.team ?? []).map((member) => member.contactId));
    return company.contacts
      .filter((contact) => !assigned.has(contact.ContactID))
      .slice()
      .sort((a, b) => {
        const aTitle = Boolean(a.JobTitle?.trim() || a.Role?.trim());
        const bTitle = Boolean(b.JobTitle?.trim() || b.Role?.trim());
        if (aTitle !== bTitle) return aTitle ? -1 : 1;
        return getContactDisplayName(a).localeCompare(getContactDisplayName(b));
      });
  }, [company.contacts, createdDeal?.team]);

  const selectedContact = suggestedContacts.find(
    (contact) => contact.ContactID === selectedContactId,
  );

  const isValid =
    form.assetName.trim().length > 0 &&
    COMPANY_ROLES.includes(form.companyRole) &&
    form.offeringIds.length > 0;

  const openCreate = () => {
    setCreatedDeal(null);
    setStakeholderOpen(false);
    setForm(EMPTY_FORM);
    setError(null);
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!onCreateOpportunity || !isValid) return;
    await runLocked(async () => {
      setError(null);
      try {
        const salesValue = parseOptionalValue(form.salesValue);
        const created = await onCreateOpportunity({
          companyId: company.CompanyID,
          assetName: form.assetName.trim(),
          companyRole: form.companyRole,
          offeringIds: form.offeringIds,
          ...(salesValue !== undefined ? { salesValue } : {}),
          ...(form.expectedCloseDate.trim()
            ? { expectedCloseDate: form.expectedCloseDate.trim() }
            : {}),
        });
        setCreatedDeal(created);
        setCreateOpen(false);
        setForm(EMPTY_FORM);
        setStakeholderOpen(canManageStakeholders);
        const intelligence = buildOfferingIntelligence(created.offeringIds);
        const preferredRole = intelligence.suggestedStakeholderRoles[0] ?? "Champion";
        setSelectedContactId("");
        setStakeholderRole(preferredRole);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create opportunity");
      }
    });
  };

  const selectSuggestedContact = (contact: Contact) => {
    setSelectedContactId(contact.ContactID);
    setStakeholderRole(suggestOpportunityRoleForContact(contact));
  };

  const resolvedRole = normalizeStakeholderRole(stakeholderRole);

  const handleAddStakeholder = async () => {
    if (!createdDeal || !onAssignStakeholder || !selectedContactId || !resolvedRole) {
      return;
    }
    setSavingStakeholder(true);
    setError(null);
    try {
      const updated = await onAssignStakeholder(
        createdDeal.id,
        selectedContactId,
        resolvedRole,
      );
      setCreatedDeal(updated);
      setSelectedContactId("");
      setStakeholderRole("Champion");
      setStakeholderOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add stakeholder");
    } finally {
      setSavingStakeholder(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {deals.length === 0 && !createdDeal ? (
        <div className="flex flex-col gap-3 py-1">
          <p className="text-sm text-carbon-blue/45">No opportunities yet.</p>
          {canCreate && !createOpen ? (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex w-fit items-center gap-1.5 border border-upcycle-orange/30 bg-upcycle-orange/10 px-3 py-1.5 text-[11px] font-semibold text-upcycle-orange transition-colors hover:bg-upcycle-orange/15"
            >
              <SmartCRMIcon name="add" size="xs" />
              Create Opportunity
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <OpportunitiesOverviewTable
            deals={createdDeal && !deals.some((deal) => deal.id === createdDeal.id)
              ? [...deals, createdDeal]
              : deals}
            commercialPackages={commercialPackages}
          />
          {canCreate && !createOpen && !createdDeal ? (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex w-fit items-center gap-1.5 border border-carbon-blue/12 px-3 py-1.5 text-[11px] font-semibold text-carbon-blue/65 transition-colors hover:border-upcycle-orange/30 hover:text-upcycle-orange"
            >
              <SmartCRMIcon name="add" size="xs" />
              Create Opportunity
            </button>
          ) : null}
        </>
      )}

      {createOpen && canCreate ? (
        <div className="border border-carbon-blue/10 bg-carbon-blue/[0.02] p-4">
          <p className="mb-3 text-[12px] font-medium text-carbon-blue">
            New opportunity for {company.Title}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                Opportunity Name
              </span>
              <input
                type="text"
                value={form.assetName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, assetName: event.target.value }))
                }
                placeholder="e.g. Ottem pyrolysis unit"
                className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue"
                autoFocus
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                Opportunity Type
              </span>
              <select
                value={form.companyRole}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    companyRole: event.target.value as CompanyRole,
                  }))
                }
                className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue"
              >
                {COMPANY_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                Estimated Value <span className="font-medium normal-case">(optional)</span>
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={form.salesValue}
                onChange={(event) =>
                  setForm((current) => ({ ...current, salesValue: event.target.value }))
                }
                placeholder="e.g. 2500000"
                className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                Expected Decision Date{" "}
                <span className="font-medium normal-case">(optional)</span>
              </span>
              <input
                type="date"
                value={form.expectedCloseDate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    expectedCloseDate: event.target.value,
                  }))
                }
                className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue"
              />
            </label>
            <div className="sm:col-span-2">
              <OpportunityOfferingsPicker
                selectedIds={form.offeringIds}
                onChange={(offeringIds) =>
                  setForm((current) => ({ ...current, offeringIds }))
                }
                disabled={saving}
                required
                label="Selected offerings"
                helper="What we are selling — SmartAssist uses this to qualify and recommend next steps."
                defaultOpen={form.offeringIds.length === 0}
              />
            </div>
          </div>
          {error ? <p className="mt-3 text-[12px] text-thermal-red">{error}</p> : null}
          <div className="mt-3 flex gap-2">
            <AsyncSubmitButton
              isSubmitting={saving}
              disabled={!isValid}
              onClick={() => void handleCreate()}
              idleLabel="Create Opportunity"
              submittingLabel="Creating…"
              className="border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-xs font-semibold text-white"
            />
            <button
              type="button"
              onClick={() => {
                setCreateOpen(false);
                setError(null);
              }}
              className="px-3 py-1.5 text-xs font-semibold text-carbon-blue/55 hover:text-carbon-blue"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {createdDeal ? (
        <div className="border border-upcycle-orange/20 bg-upcycle-orange/[0.04] p-4">
          <p className="text-[12px] font-medium text-carbon-blue">
            Opportunity created:{" "}
            <DealLink dealId={createdDeal.id} className="text-upcycle-orange hover:underline">
              {createdDeal.assetName}
            </DealLink>
          </p>
          <p className="mt-1 text-[11px] text-carbon-blue/55">
            {formatDealValue(createdDeal.currency, createdDeal.salesValue)}
            {createdDeal.expectedCloseDate
              ? ` · Decision target ${createdDeal.expectedCloseDate}`
              : ""}
            {` · ${formatOfferingLabels(createdDeal.offeringIds)}`}
          </p>

          {canManageStakeholders ? (
            stakeholderOpen ? (
              <div className="mt-4 border border-carbon-blue/10 bg-white p-3">
                <p className="text-[11px] font-semibold text-carbon-blue">
                  Add stakeholder from {company.Title}
                </p>
                {suggestedContacts.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                      Suggested contacts
                    </p>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {suggestedContacts.slice(0, 5).map((contact) => {
                        const active = selectedContactId === contact.ContactID;
                        return (
                          <li key={contact.ContactID}>
                            <button
                              type="button"
                              onClick={() => selectSuggestedContact(contact)}
                              className={`w-full border px-3 py-2 text-left text-[12px] transition-colors ${
                                active
                                  ? "border-upcycle-orange/40 bg-upcycle-orange/10 text-carbon-blue"
                                  : "border-carbon-blue/10 text-carbon-blue/75 hover:border-upcycle-orange/25"
                              }`}
                            >
                              <span className="font-semibold">
                                {getContactDisplayName(contact)}
                              </span>
                              {contact.JobTitle?.trim() || contact.Role?.trim() ? (
                                <span className="mt-0.5 block text-[11px] text-carbon-blue/55">
                                  {contact.JobTitle?.trim() || contact.Role?.trim()}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-2 text-[12px] text-carbon-blue/45">
                    No contacts on this company yet. Add contacts first, then assign stakeholders.
                  </p>
                )}

                {suggestedContacts.length > 5 ? (
                  <label className="mt-3 block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                      Or choose another contact
                    </span>
                    <select
                      value={selectedContactId}
                      onChange={(event) => {
                        const contact = suggestedContacts.find(
                          (entry) => entry.ContactID === event.target.value,
                        );
                        if (contact) selectSuggestedContact(contact);
                        else setSelectedContactId(event.target.value);
                      }}
                      className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue"
                    >
                      <option value="">Select contact…</option>
                      {suggestedContacts.map((contact) => (
                        <option key={contact.ContactID} value={contact.ContactID}>
                          {formatSuggestedContactLabel(contact)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <div className="mt-3">
                  <StakeholderRoleSelect
                    value={stakeholderRole}
                    extraRoles={extraRoles}
                    onChange={setStakeholderRole}
                    disabled={savingStakeholder}
                  />
                </div>

                {selectedContact ? (
                  <p className="mt-2 text-[11px] text-carbon-blue/55">
                    Suggested role from title: {suggestOpportunityRoleForContact(selectedContact)}
                  </p>
                ) : null}

                {error ? <p className="mt-2 text-[12px] text-thermal-red">{error}</p> : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={
                      savingStakeholder ||
                      !selectedContactId ||
                      !resolvedRole ||
                      suggestedContacts.length === 0
                    }
                    onClick={() => void handleAddStakeholder()}
                    className="border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {savingStakeholder ? "Adding…" : "Add Stakeholder"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStakeholderOpen(false);
                      setCreatedDeal(null);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-carbon-blue/55 hover:text-carbon-blue"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setStakeholderOpen(true)}
                  className="inline-flex items-center gap-1.5 border border-carbon-blue/12 px-3 py-1.5 text-[11px] font-semibold text-carbon-blue/65 transition-colors hover:border-upcycle-orange/30 hover:text-upcycle-orange"
                >
                  <SmartCRMIcon name="add" size="xs" />
                  Add Stakeholder
                </button>
                <button
                  type="button"
                  onClick={() => setCreatedDeal(null)}
                  className="px-3 py-1.5 text-[11px] font-semibold text-carbon-blue/45 hover:text-carbon-blue"
                >
                  Dismiss
                </button>
              </div>
            )
          ) : (
            <button
              type="button"
              onClick={() => setCreatedDeal(null)}
              className="mt-3 px-3 py-1.5 text-[11px] font-semibold text-carbon-blue/45 hover:text-carbon-blue"
            >
              Dismiss
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
