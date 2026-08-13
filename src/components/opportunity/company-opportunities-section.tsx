"use client";

import { useEffect, useMemo, useState } from "react";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { Contact } from "@/types/contact";
import { getContactDisplayName } from "@/types/contact";
import type { CreateOpportunityInput } from "@/types/deal";
import type { PipelineRow, CompanyRole, PipelineCurrency } from "@/types/pipeline";
import { COMPANY_ROLES, formatDealValue, opportunityPublicCode } from "@/types/pipeline";
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
import { OpportunityValueFields } from "@/components/opportunity/opportunity-value-fields";
import {
  DEFAULT_OPPORTUNITY_CURRENCY,
  parseMoneyInput,
} from "@/lib/geo/currencies";
import { linkCompanyToOpportunity } from "@/lib/sync-company-opportunity-link";
import { useAuth } from "@/context/auth-context";

type CreateFormState = {
  assetName: string;
  companyRole: CompanyRole;
  salesValue: string;
  currency: PipelineCurrency;
  expectedCloseDate: string;
  offeringIds: string[];
};

const EMPTY_FORM: CreateFormState = {
  assetName: "",
  companyRole: "Technology Buyer",
  salesValue: "",
  currency: DEFAULT_OPPORTUNITY_CURRENCY,
  expectedCloseDate: "",
  offeringIds: [],
};

export function CompanyOpportunitiesSection({
  deals,
  allPipelines = [],
  commercialPackages,
  company,
  canCreate = false,
  canManageStakeholders = false,
  onCreateOpportunity,
  onAssignStakeholder,
  onCompanyUpdated,
  createRequestId = 0,
  /** Overview: create CTA/form only — no table, empty copy, or link-existing. */
  createOnly = false,
  /** When false, parent owns the Create Opportunity trigger (e.g. panel header). */
  showCreateTrigger = true,
}: {
  deals: PipelineRow[];
  allPipelines?: PipelineRow[];
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
  onCompanyUpdated?: (company: Company) => void;
  createRequestId?: number;
  createOnly?: boolean;
  showCreateTrigger?: boolean;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkQuery, setLinkQuery] = useState("");
  const [selectedLinkDealId, setSelectedLinkDealId] = useState("");
  const [linking, setLinking] = useState(false);
  const [form, setForm] = useState<CreateFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdDeal, setCreatedDeal] = useState<PipelineRow | null>(null);
  const [stakeholderOpen, setStakeholderOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [stakeholderRole, setStakeholderRole] = useState("Champion");
  const [savingStakeholder, setSavingStakeholder] = useState(false);

  const { user } = useAuth();
  const linkedDealIds = useMemo(() => new Set(deals.map((deal) => deal.id)), [deals]);

  const linkableDeals = useMemo(() => {
    return allPipelines
      .filter((deal) => !linkedDealIds.has(deal.id))
      .sort((a, b) => a.assetName.localeCompare(b.assetName));
  }, [allPipelines, linkedDealIds]);

  const filteredLinkDeals = useMemo(() => {
    const q = linkQuery.trim().toLowerCase();
    if (!q) return linkableDeals.slice(0, 40);
    return linkableDeals
      .filter((deal) => {
        const code = opportunityPublicCode(deal).toLowerCase();
        return (
          deal.assetName.toLowerCase().includes(q) ||
          deal.id.toLowerCase().includes(q) ||
          code.includes(q)
        );
      })
      .slice(0, 40);
  }, [linkableDeals, linkQuery]);

  const selectedLinkDeal = linkableDeals.find((deal) => deal.id === selectedLinkDealId);

  const handleLinkExisting = async () => {
    if (!selectedLinkDeal) {
      setError("Select an opportunity.");
      return;
    }
    setLinking(true);
    setError(null);
    try {
      const updated = await linkCompanyToOpportunity(
        company.CompanyID,
        selectedLinkDeal.id,
        user.role,
      );
      onCompanyUpdated?.(updated);
      setLinkOpen(false);
      setSelectedLinkDealId("");
      setLinkQuery("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not link opportunity");
    } finally {
      setLinking(false);
    }
  };

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
    setSaving(true);
    setError(null);
    try {
      const salesValue = parseMoneyInput(form.salesValue);
      const created = await onCreateOpportunity({
        companyId: company.CompanyID,
        assetName: form.assetName.trim(),
        companyRole: form.companyRole,
        offeringIds: form.offeringIds,
        currency: form.currency || DEFAULT_OPPORTUNITY_CURRENCY,
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
    } finally {
      setSaving(false);
    }
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

  const createTrigger = (emphasis: "primary" | "secondary") =>
    showCreateTrigger && canCreate && !createOpen && !createdDeal ? (
      <button
        type="button"
        onClick={openCreate}
        className={
          emphasis === "primary"
            ? "inline-flex w-fit items-center gap-1.5 border border-upcycle-orange/30 bg-upcycle-orange/10 px-3 py-1.5 text-[11px] font-semibold text-upcycle-orange transition-colors hover:bg-upcycle-orange/15"
            : "inline-flex w-fit items-center gap-1.5 border border-carbon-blue/12 px-3 py-1.5 text-[11px] font-semibold text-carbon-blue/65 transition-colors hover:border-upcycle-orange/30 hover:text-upcycle-orange"
        }
      >
        <SmartCRMIcon name="add" size="xs" />
        Create Opportunity
      </button>
    ) : null;

  const linkTrigger =
    !createOnly && canManageStakeholders && !linkOpen ? (
      <button
        type="button"
        onClick={() => setLinkOpen(true)}
        className="inline-flex w-fit items-center gap-1.5 border border-carbon-blue/12 px-3 py-1.5 text-[11px] font-semibold text-carbon-blue/65 transition-colors hover:border-upcycle-orange/30 hover:text-upcycle-orange"
      >
        Link existing opportunity
      </button>
    ) : null;

  if (createOnly && !showCreateTrigger && !createOpen && !createdDeal) {
    return null;
  }

  return (
    <div
      className={
        createOnly && (createOpen || createdDeal)
          ? "mt-3 flex flex-col gap-4"
          : "flex flex-col gap-4"
      }
    >
      {createOnly ? (
        createTrigger(deals.length === 0 ? "primary" : "secondary")
      ) : deals.length === 0 && !createdDeal ? (
        <div className="flex flex-col gap-3 py-1">
          <p className="text-sm text-carbon-blue/45">No opportunities yet.</p>
          <div className="flex flex-wrap gap-2">
            {createTrigger("primary")}
            {linkTrigger}
          </div>
        </div>
      ) : (
        <>
          <OpportunitiesOverviewTable
            deals={createdDeal && !deals.some((deal) => deal.id === createdDeal.id)
              ? [...deals, createdDeal]
              : deals}
            commercialPackages={commercialPackages}
          />
          <div className="flex flex-wrap gap-2">
            {createTrigger("secondary")}
            {linkTrigger}
          </div>
        </>
      )}

      {!createOnly && linkOpen && canManageStakeholders ? (
        <div className="border border-dashed border-carbon-blue/15 bg-white p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/45">
            Link existing opportunity to {company.Title}
          </p>
          <input
            value={linkQuery}
            onChange={(event) => {
              setLinkQuery(event.target.value);
              setSelectedLinkDealId("");
            }}
            placeholder="Search opportunities…"
            className="mb-2 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue"
          />
          <div className="mb-3 max-h-40 overflow-auto border border-carbon-blue/10">
            {filteredLinkDeals.length === 0 ? (
              <p className="px-3 py-2 text-[12px] text-carbon-blue/45">No matching opportunities.</p>
            ) : (
              filteredLinkDeals.map((deal) => (
                <button
                  key={deal.id}
                  type="button"
                  onClick={() => {
                    setSelectedLinkDealId(deal.id);
                    setLinkQuery(deal.assetName);
                  }}
                  className={`block w-full px-3 py-2 text-left text-[12px] hover:bg-upcycle-orange/10 ${
                    selectedLinkDealId === deal.id
                      ? "bg-upcycle-orange/10 text-upcycle-orange"
                      : "text-carbon-blue"
                  }`}
                >
                  {opportunityPublicCode(deal)} · {deal.assetName}
                </button>
              ))
            )}
          </div>
          {error ? <p className="mb-2 text-[12px] text-thermal-red">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={linking || !selectedLinkDeal}
              onClick={() => void handleLinkExisting()}
              className="border border-upcycle-orange/30 bg-upcycle-orange/10 px-3 py-1.5 text-[11px] font-semibold text-upcycle-orange disabled:opacity-50"
            >
              {linking ? "Linking…" : "Link opportunity"}
            </button>
            <button
              type="button"
              disabled={linking}
              onClick={() => {
                setLinkOpen(false);
                setError(null);
                setSelectedLinkDealId("");
                setLinkQuery("");
              }}
              className="border border-carbon-blue/15 px-3 py-1.5 text-[11px] font-semibold text-carbon-blue/70"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

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
              <OpportunityValueFields
                salesValue={form.salesValue}
                currency={form.currency}
                disabled={saving}
                onSalesValueChange={(salesValue) =>
                  setForm((current) => ({ ...current, salesValue }))
                }
                onCurrencyChange={(currency) =>
                  setForm((current) => ({ ...current, currency }))
                }
              />
            </div>
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
            <button
              type="button"
              disabled={saving || !isValid}
              onClick={() => void handleCreate()}
              className="border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create Opportunity"}
            </button>
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
