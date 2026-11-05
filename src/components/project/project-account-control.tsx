"use client";

import { useMemo, useState } from "react";
import type { Company } from "@/types/company";
import type { ProjectRelatedOrganization } from "@/types/project-relationships";
import {
  buildAccountCompanyOptions,
  changeProjectAccount,
  removeProjectAccount,
  replaceProjectAccount,
} from "@/lib/project-account-utils";
import { CompanyLink } from "@/components/relationship/relationship-links";
import { CompanyCombobox } from "@/components/project/project-related-organizations-panel";

export function ProjectAccountControl({
  accountCompanyId,
  accountLabel,
  companies,
  organizations,
  editable,
  onOrganizationsChange,
  onAddOrganization,
}: {
  accountCompanyId?: string;
  accountLabel: string;
  companies: Company[];
  organizations: ProjectRelatedOrganization[];
  editable: boolean;
  onOrganizationsChange?: (organizations: ProjectRelatedOrganization[]) => Promise<void>;
  onAddOrganization?: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"view" | "change" | "replace">("view");

  const companyOptions = useMemo(
    () => buildAccountCompanyOptions(companies, accountCompanyId),
    [companies, accountCompanyId],
  );

  const persist = async (next: ProjectRelatedOrganization[]) => {
    if (!onOrganizationsChange) return;
    setSaving(true);
    try {
      await onOrganizationsChange(next);
      setMode("view");
    } finally {
      setSaving(false);
    }
  };

  const handleAccountSelect = async (companyId: string) => {
    if (!companyId || !onOrganizationsChange) return;
    const next =
      mode === "replace"
        ? replaceProjectAccount(organizations, companyId)
        : changeProjectAccount(organizations, companyId);
    await persist(next);
  };

  const handleRemove = async () => {
    if (!onOrganizationsChange) return;
    await persist(removeProjectAccount(organizations));
  };

  if (!editable || !onOrganizationsChange) {
    if (accountCompanyId) {
      return (
        <CompanyLink
          companyId={accountCompanyId}
          className="text-carbon-blue hover:text-upcycle-orange"
        >
          {accountLabel}
        </CompanyLink>
      );
    }
    return <span>—</span>;
  }

  if (mode === "change" || mode === "replace") {
    return (
      <div className="flex min-w-[16rem] max-w-sm flex-col gap-1.5">
        <CompanyCombobox
          companies={companyOptions}
          selectedCompanyId={accountCompanyId ?? ""}
          disabled={saving}
          label=""
          placeholder={mode === "replace" ? "Select replacement account…" : "Select account…"}
          onSelect={(company) => {
            if (company) {
              void handleAccountSelect(company.CompanyID);
            }
          }}
        />
        <div className="flex flex-wrap gap-2 text-[12px]">
          <button
            type="button"
            onClick={() => setMode("view")}
            className="font-semibold text-carbon-blue/65 hover:text-carbon-blue"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {accountCompanyId ? (
        <CompanyLink
          companyId={accountCompanyId}
          className="text-carbon-blue hover:text-upcycle-orange"
        >
          {accountLabel}
        </CompanyLink>
      ) : (
        <span className="text-carbon-blue/65">No account linked</span>
      )}
      <div className="flex flex-wrap gap-x-2 gap-y-1 text-[12px] font-semibold">
        <button
          type="button"
          disabled={saving}
          onClick={() => setMode("change")}
          className="text-carbon-blue/65 hover:text-carbon-blue disabled:opacity-50"
        >
          {accountCompanyId ? "Change" : "Add account"}
        </button>
        {accountCompanyId ? (
          <>
            <span className="text-carbon-blue/15" aria-hidden>
              ·
            </span>
            <button
              type="button"
              disabled={saving}
              onClick={() => setMode("replace")}
              className="text-carbon-blue/65 hover:text-carbon-blue disabled:opacity-50"
            >
              Replace
            </button>
            <span className="text-carbon-blue/15" aria-hidden>
              ·
            </span>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleRemove()}
              className="text-carbon-blue/65 hover:text-red-600 disabled:opacity-50"
            >
              Remove
            </button>
          </>
        ) : null}
        {onAddOrganization ? (
          <>
            <span className="text-carbon-blue/15" aria-hidden>
              ·
            </span>
            <button
              type="button"
              onClick={onAddOrganization}
              className="text-carbon-blue/65 hover:text-upcycle-orange"
            >
              Add organization
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
