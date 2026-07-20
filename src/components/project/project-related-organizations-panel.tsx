"use client";

import { useMemo, useState } from "react";
import type { Company } from "@/types/company";
import type {
  ProjectOrganizationType,
  ProjectRelatedOrganization,
} from "@/types/project-relationships";
import {
  PROJECT_ORGANIZATION_TYPES,
  PROJECT_ORGANIZATION_TYPE_LABELS,
} from "@/types/project-relationships";
import {
  createOrganizationId,
  getOrganizationTypeLabel,
  resolveOrganizationLabel,
} from "@/lib/project-relationship-utils";
import { CompanyLink } from "@/components/relationship/relationship-links";
import { SmartCRMIcon } from "@/components/ui/smartcrm-icon";

export function ProjectRelatedOrganizationsPanel({
  organizations,
  companies,
  readOnly = false,
  onChange,
}: {
  organizations: ProjectRelatedOrganization[];
  companies: Company[];
  readOnly?: boolean;
  onChange?: (organizations: ProjectRelatedOrganization[]) => Promise<void>;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState("");
  const [organizationType, setOrganizationType] = useState<ProjectOrganizationType>("customer");
  const [label, setLabel] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [saving, setSaving] = useState(false);

  const availableCompanies = useMemo(
    () =>
      companies
        .filter(
          (company) =>
            !organizations.some(
              (org) => org.companyId === company.CompanyID && org.id !== editingId,
            ),
        )
        .sort((a, b) => a.Title.localeCompare(b.Title)),
    [companies, organizations, editingId],
  );

  const resetForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setCompanyId("");
    setOrganizationType("customer");
    setLabel("");
    setIsPrimary(false);
  };

  const persist = async (next: ProjectRelatedOrganization[]) => {
    if (!onChange) return;
    setSaving(true);
    try {
      let normalized = next;
      const primaryCount = normalized.filter((org) => org.isPrimary).length;
      if (primaryCount === 0 && normalized.length > 0) {
        normalized = normalized.map((org, index) => ({
          ...org,
          isPrimary: index === 0,
        }));
      } else if (primaryCount > 1) {
        let seenPrimary = false;
        normalized = normalized.map((org) => {
          if (org.isPrimary && !seenPrimary) {
            seenPrimary = true;
            return org;
          }
          return { ...org, isPrimary: false };
        });
      }
      await onChange(normalized);
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!companyId || !onChange) return;

    if (editingId) {
      const next = organizations.map((org) =>
        org.id === editingId
          ? { ...org, companyId, organizationType, label: label.trim() || undefined, isPrimary }
          : isPrimary
            ? { ...org, isPrimary: false }
            : org,
      );
      await persist(next);
      return;
    }

    const entry: ProjectRelatedOrganization = {
      id: createOrganizationId(),
      companyId,
      organizationType,
      label: label.trim() || undefined,
      isPrimary: isPrimary || organizations.length === 0,
    };
    const next = isPrimary
      ? [...organizations.map((org) => ({ ...org, isPrimary: false })), entry]
      : [...organizations, entry];
    await persist(next);
  };

  const handleEdit = (org: ProjectRelatedOrganization) => {
    setEditingId(org.id);
    setCompanyId(org.companyId);
    setOrganizationType(org.organizationType);
    setLabel(org.label ?? "");
    setIsPrimary(Boolean(org.isPrimary));
    setFormOpen(true);
  };

  const handleRemove = async (orgId: string) => {
    if (!onChange) return;
    await persist(organizations.filter((org) => org.id !== orgId));
  };

  return (
    <div className="flex flex-col gap-4">
      {organizations.length === 0 ? (
        <p className="text-sm text-carbon-blue/45">
          No related organizations yet. Link customer, partner, supplier, and other involved companies.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-carbon-blue/10 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                <th className="px-2 py-2">Organization</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Role</th>
                {!readOnly && onChange ? <th className="px-2 py-2"> </th> : null}
              </tr>
            </thead>
            <tbody>
              {organizations.map((org) => (
                <tr key={org.id} className="border-b border-carbon-blue/5">
                  <td className="px-2 py-2.5">
                    <CompanyLink companyId={org.companyId} className="font-medium text-carbon-blue">
                      {companies.find((c) => c.CompanyID === org.companyId)?.Title ?? org.companyId}
                    </CompanyLink>
                    {org.isPrimary ? (
                      <span className="ml-2 border border-upcycle-orange/25 bg-upcycle-orange/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-upcycle-orange">
                        Primary
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2.5 text-carbon-blue/70">
                    {getOrganizationTypeLabel(org.organizationType)}
                  </td>
                  <td className="px-2 py-2.5 text-carbon-blue/55">
                    {(org.label ?? resolveOrganizationLabel(org, companies).split(" · ").slice(1).join(" · ")) || "—"}
                  </td>
                  {!readOnly && onChange ? (
                    <td className="px-2 py-2.5">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(org)}
                          className="text-[11px] font-semibold text-carbon-blue/45 hover:text-carbon-blue"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRemove(org.id)}
                          className="text-[11px] font-semibold text-carbon-blue/45 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!readOnly && onChange ? (
        <div>
          {formOpen ? (
            <div className="border border-carbon-blue/10 bg-carbon-blue/[0.02] p-4">
              <p className="mb-2 text-[11px] text-carbon-blue/55">
                {editingId ? "Update organization on this project" : "Add organization to this project"}
              </p>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                  Organization
                </span>
                <select
                  value={companyId}
                  onChange={(event) => setCompanyId(event.target.value)}
                  className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px]"
                >
                  <option value="">Select company…</option>
                  {(editingId
                    ? companies.filter((c) => c.CompanyID === companyId || availableCompanies.includes(c))
                    : availableCompanies
                  ).map((company) => (
                    <option key={company.CompanyID} value={company.CompanyID}>
                      {company.Title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                  Organization type
                </span>
                <select
                  value={organizationType}
                  onChange={(event) =>
                    setOrganizationType(event.target.value as ProjectOrganizationType)
                  }
                  className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px]"
                >
                  {PROJECT_ORGANIZATION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {PROJECT_ORGANIZATION_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                  Label (optional)
                </span>
                <input
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="e.g. EPC partner"
                  className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px]"
                />
              </label>
              <label className="mt-3 flex items-center gap-2 text-[12px] text-carbon-blue/70">
                <input
                  type="checkbox"
                  checked={isPrimary}
                  onChange={(event) => setIsPrimary(event.target.checked)}
                />
                Primary customer organization
              </label>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={saving || !companyId}
                  onClick={() => void handleSave()}
                  className="border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Saving…" : editingId ? "Save changes" : "Add organization"}
                </button>
                <button type="button" onClick={resetForm} className="px-3 py-1.5 text-xs font-semibold text-carbon-blue/55">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="inline-flex items-center gap-1.5 border border-carbon-blue/12 px-3 py-1.5 text-[11px] font-semibold text-carbon-blue/65 hover:border-upcycle-orange/30 hover:text-upcycle-orange"
            >
              <SmartCRMIcon name="add" size="xs" />
              Add organization
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
