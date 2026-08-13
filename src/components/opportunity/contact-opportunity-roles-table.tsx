"use client";

import { useMemo, useState } from "react";
import type { Contact } from "@/types/contact";
import { getContactDisplayName } from "@/types/contact";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { opportunityPublicCode } from "@/types/pipeline";
import type { UserRole } from "@/types/auth";
import {
  buildOpportunityStakeholderRoleOptions,
  suggestOpportunityRoleForContact,
} from "@/lib/opportunity-stakeholder-utils";
import { syncPipelineRecord } from "@/lib/sync-pipeline";
import { canManageOpportunityStakeholders } from "@/lib/permissions";
import { DealLink } from "@/components/relationship/relationship-links";
import { IconLabel } from "@/components/ui/smartcrm-icon";
import { deal360Href } from "@/types/relationship-navigation";

type ContactOpportunityRole = {
  dealId: string;
  dealName: string;
  dealCode: string;
  role: string;
  status: string;
};

type ContactOpportunityRolesTableProps = {
  contact: Contact;
  company: Company;
  pipelines: PipelineRow[];
  role: UserRole;
  onPipelineUpdated?: (pipeline: PipelineRow) => void;
};

function buildContactOpportunityRoles(
  contactId: string,
  pipelines: PipelineRow[],
): ContactOpportunityRole[] {
  const rows: ContactOpportunityRole[] = [];
  for (const deal of pipelines) {
    const membership = deal.team?.find((member) => member.contactId === contactId);
    if (!membership) continue;
    rows.push({
      dealId: deal.id,
      dealName: deal.assetName,
      dealCode: opportunityPublicCode(deal),
      role: membership.projectRole,
      status: deal.status,
    });
  }
  return rows.sort((a, b) => a.dealName.localeCompare(b.dealName));
}

/**
 * Contact 360 — list opportunity roster roles and add this contact to a deal
 * without leaving the page (FS-001: Contact Registry ID only).
 */
export function ContactOpportunityRolesTable({
  contact,
  company,
  pipelines,
  role,
  onPipelineUpdated,
}: ContactOpportunityRolesTableProps) {
  const canManage = canManageOpportunityStakeholders(role);
  const [assignOpen, setAssignOpen] = useState(false);
  const [dealQuery, setDealQuery] = useState("");
  const [selectedDealId, setSelectedDealId] = useState("");
  const [stakeholderRole, setStakeholderRole] = useState(
    suggestOpportunityRoleForContact(contact),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const roles = useMemo(
    () => buildContactOpportunityRoles(contact.ContactID, pipelines),
    [contact.ContactID, pipelines],
  );

  const assignedDealIds = useMemo(
    () => new Set(roles.map((entry) => entry.dealId)),
    [roles],
  );

  const companyDealIds = useMemo(
    () => new Set(company.pipelineIds ?? []),
    [company.pipelineIds],
  );

  const availableDeals = useMemo(() => {
    const open = pipelines.filter((deal) => !assignedDealIds.has(deal.id));
    const companyFirst = open.filter((deal) => companyDealIds.has(deal.id));
    const rest = open.filter((deal) => !companyDealIds.has(deal.id));
    return [...companyFirst, ...rest].sort((a, b) =>
      a.assetName.localeCompare(b.assetName),
    );
  }, [pipelines, assignedDealIds, companyDealIds]);

  const filteredDeals = useMemo(() => {
    const q = dealQuery.trim().toLowerCase();
    if (!q) return availableDeals.slice(0, 40);
    return availableDeals
      .filter((deal) => {
        const code = opportunityPublicCode(deal).toLowerCase();
        return (
          deal.assetName.toLowerCase().includes(q) ||
          deal.id.toLowerCase().includes(q) ||
          code.includes(q)
        );
      })
      .slice(0, 40);
  }, [availableDeals, dealQuery]);

  const selectedDeal = availableDeals.find((deal) => deal.id === selectedDealId);

  const roleOptions = useMemo(
    () => buildOpportunityStakeholderRoleOptions([stakeholderRole]),
    [stakeholderRole],
  );

  const handleAdd = async () => {
    setError(null);
    if (!selectedDeal) {
      setError("Select an opportunity.");
      return;
    }
    if (!stakeholderRole.trim()) {
      setError("Select a role.");
      return;
    }
    if (selectedDeal.team?.some((member) => member.contactId === contact.ContactID)) {
      setError("This contact is already on that opportunity.");
      return;
    }

    const team = [
      ...(selectedDeal.team ?? []),
      { contactId: contact.ContactID, projectRole: stakeholderRole.trim() },
    ];

    setBusy(true);
    try {
      const updated = await syncPipelineRecord(selectedDeal.id, { team }, role);
      onPipelineUpdated?.(updated);
      setAssignOpen(false);
      setSelectedDealId("");
      setDealQuery("");
      setStakeholderRole(suggestOpportunityRoleForContact(contact));
      setPickerOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add to opportunity.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {roles.length === 0 ? (
        <p className="text-sm text-carbon-blue/45">
          Not on an opportunity roster yet. Add {getContactDisplayName(contact)} to a deal
          from here.
        </p>
      ) : (
        <table className="w-full table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-[40%]" />
            <col className="w-[28%]" />
            <col className="w-[32%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-carbon-blue/8 bg-carbon-blue/[0.03]">
              <th className="px-3 py-2 text-left">
                <IconLabel
                  icon="opportunity"
                  iconSize="xs"
                  className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45"
                >
                  Opportunity
                </IconLabel>
              </th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
                Role
              </th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {roles.map((entry) => (
              <tr
                key={`${entry.dealId}-${entry.role}`}
                className="border-b border-carbon-blue/6 last:border-b-0 hover:bg-carbon-blue/[0.02]"
              >
                <td className="px-3 py-2.5">
                  <DealLink dealId={entry.dealId} className="group block truncate">
                    <span className="text-[13px] font-semibold text-carbon-blue group-hover:text-upcycle-orange">
                      {entry.dealName}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[10px] text-carbon-blue/40">
                      {entry.dealCode}
                    </span>
                  </DealLink>
                </td>
                <td className="truncate px-3 py-2.5 text-[12px] text-carbon-blue/70">
                  {entry.role}
                </td>
                <td className="truncate px-3 py-2.5 text-[12px] text-carbon-blue/55">
                  {entry.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canManage ? (
        assignOpen ? (
          <div className="border border-carbon-blue/10 bg-carbon-blue/[0.02] p-3">
            <p className="text-[11px] font-semibold text-carbon-blue">
              Add to existing opportunity
            </p>
            <p className="mt-0.5 text-[10px] text-carbon-blue/50">
              Search a deal — no need to open it first.
            </p>

            <label className="relative mt-3 block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                Opportunity
              </span>
              <input
                type="search"
                value={selectedDeal && !pickerOpen ? selectedDeal.assetName : dealQuery}
                disabled={busy}
                placeholder="Search opportunities…"
                autoComplete="off"
                onFocus={() => {
                  setPickerOpen(true);
                  if (selectedDeal) setDealQuery(selectedDeal.assetName);
                }}
                onChange={(event) => {
                  setDealQuery(event.target.value);
                  setSelectedDealId("");
                  setPickerOpen(true);
                }}
                className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue outline-none focus:border-upcycle-orange"
              />
              {pickerOpen ? (
                <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto border border-carbon-blue/15 bg-white shadow-md">
                  {filteredDeals.length === 0 ? (
                    <li className="px-3 py-2 text-[11px] text-carbon-blue/50">
                      {availableDeals.length === 0
                        ? "Already on all opportunities, or none exist."
                        : "No opportunities match your search."}
                    </li>
                  ) : (
                    filteredDeals.map((deal) => (
                      <li key={deal.id}>
                        <button
                          type="button"
                          className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-upcycle-orange/10"
                          onClick={() => {
                            setSelectedDealId(deal.id);
                            setDealQuery(deal.assetName);
                            setPickerOpen(false);
                          }}
                        >
                          <span className="text-[12px] font-medium text-carbon-blue">
                            {deal.assetName}
                          </span>
                          <span className="text-[10px] text-carbon-blue/45">
                            {opportunityPublicCode(deal)} · {deal.status}
                            {companyDealIds.has(deal.id) ? " · This company" : ""}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
            </label>

            <label className="mt-3 block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                Role on opportunity
              </span>
              <select
                value={stakeholderRole}
                disabled={busy}
                onChange={(event) => setStakeholderRole(event.target.value)}
                className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px]"
              >
                {roleOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            {error ? (
              <p className="mt-2 text-[11px] text-thermal-red">{error}</p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !selectedDealId}
                onClick={() => void handleAdd()}
                className="border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Adding…" : "Add to opportunity"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setAssignOpen(false);
                  setError(null);
                  setPickerOpen(false);
                }}
                className="border border-carbon-blue/15 bg-white px-3 py-1.5 text-[11px] font-semibold text-carbon-blue/60"
              >
                Cancel
              </button>
              {selectedDeal ? (
                <a
                  href={deal360Href(selectedDeal.id)}
                  className="px-2 py-1.5 text-[11px] font-semibold text-carbon-blue/45 hover:text-upcycle-orange"
                >
                  Open opportunity
                </a>
              ) : null}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAssignOpen(true)}
            className="border border-carbon-blue/15 bg-white px-3 py-1.5 text-[11px] font-semibold text-carbon-blue hover:border-upcycle-orange hover:text-upcycle-orange"
          >
            + Add to opportunity
          </button>
        )
      ) : null}
    </div>
  );
}
