"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { DestructiveConfirmPanel } from "@/components/ui/destructive-confirm-panel";
import { CompanyInlineEditPanel } from "@/components/company-360/company-inline-edit-panel";
import {
  buildCompanyHeroIdentity,
  buildCompanyHeroQuickEdit,
  companyWebsiteHref,
  type CompanyHeroIdentityView,
  type CompanyHeroQuickEdit,
} from "@/lib/company-identity";
import { COMPANY_DELETE_BLOCKED_MESSAGE } from "@/lib/company-deletion";
import type { Company } from "@/types/company";

export type { CompanyHeroQuickEdit } from "@/lib/company-identity";

type Company360HeroIdentityProps = {
  company: Company;
  companies: Company[];
  onSave: (patch: CompanyHeroQuickEdit) => Promise<void>;
  canDelete?: boolean;
  companyDeletable?: boolean;
  onDelete?: () => Promise<void>;
  /** When false, parent renders primary fields (header layout). */
  showInlineFields?: boolean;
  onEditingChange?: (editing: boolean) => void;
  editingRequested?: boolean;
  /** When true, only render the edit form (no hero headline). */
  formOnly?: boolean;
};

function getIdentityFieldItems(identity: CompanyHeroIdentityView) {
  return [
    { label: "Industry", value: identity.industry, href: null as string | null },
    { label: "Parent Company", value: identity.parentCompany, href: null as string | null },
    identity.mainPhone
      ? { label: "Phone", value: identity.mainPhone, href: `tel:${identity.mainPhone.replace(/\s/g, "")}` }
      : null,
    identity.website
      ? {
          label: "Website",
          value: identity.website,
          href: companyWebsiteHref(identity.website),
        }
      : null,
  ].filter(
    (item): item is NonNullable<typeof item> =>
      item !== null && item.value.trim() !== "" && item.value !== "—",
  );
}

export function CompanyHeroPrimaryFields({
  identity,
  className = "mt-3",
}: {
  identity: CompanyHeroIdentityView;
  className?: string;
}) {
  const items = getIdentityFieldItems(identity);
  if (items.length === 0) return null;

  return (
    <dl className={`space-y-2 ${className}`}>
      {items.map((item) => (
        <div key={item.label} className="text-[11px]">
          <dt className="font-semibold text-carbon-blue/50">{item.label}</dt>
          <dd className="mt-0.5 text-carbon-blue/75">
            {item.href ? (
              <a
                href={item.href}
                target={item.label === "Website" ? "_blank" : undefined}
                rel={item.label === "Website" ? "noopener noreferrer" : undefined}
                className="transition-colors hover:text-upcycle-orange"
              >
                {item.value}
              </a>
            ) : (
              <span>{item.value}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function CompanyHeroAddress({ identity }: { identity: CompanyHeroIdentityView }) {
  if (!identity.address?.trim()) return null;

  return (
    <div className="text-[11px] sm:text-right">
      <p className="font-semibold text-carbon-blue/50">Address</p>
      <p className="mt-1 whitespace-pre-line leading-relaxed text-carbon-blue/75">
        {identity.address}
      </p>
    </div>
  );
}

function IdentityFields({ identity }: { identity: CompanyHeroIdentityView }) {
  return <CompanyHeroPrimaryFields identity={identity} />;
}

export function Company360HeroIdentity({
  company,
  companies,
  onSave,
  canDelete = false,
  companyDeletable = false,
  onDelete,
  showInlineFields = true,
  onEditingChange,
  editingRequested = false,
  formOnly = false,
}: Company360HeroIdentityProps) {
  const identity = buildCompanyHeroIdentity(company);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingRequested || formOnly) setEditing(true);
  }, [editingRequested, formOnly]);

  useEffect(() => {
    onEditingChange?.(editing);
  }, [editing, onEditingChange]);

  const handleCancel = () => {
    setError(null);
    setDeleteConfirmOpen(false);
    setEditing(false);
  };

  const handleSave = async (edit: CompanyHeroQuickEdit) => {
    await onSave(edit);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    setDeleting(true);
    setError(null);

    try {
      await onDelete();
      setDeleteConfirmOpen(false);
      setEditing(false);
    } catch {
      setError("Unable to delete company.");
    } finally {
      setDeleting(false);
    }
  };

  if (editing) {
    return (
      <div className={formOnly ? "" : "mt-3"}>
        <CompanyInlineEditPanel
          company={company}
          companies={companies}
          onSave={handleSave}
          onCancel={handleCancel}
          autoFocus={!formOnly}
        />

        {canDelete && onDelete ? (
          <div className="mt-4">
            {companyDeletable ? (
              deleteConfirmOpen ? (
                <DestructiveConfirmPanel
                  title="Delete Company?"
                  message="This action cannot be undone."
                  confirmLabel="Delete"
                  onConfirm={() => void handleDelete()}
                  onCancel={() => setDeleteConfirmOpen(false)}
                  loading={deleting}
                />
              ) : (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="border border-thermal-red/30 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-thermal-red transition-colors hover:bg-thermal-red/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Delete Company
                </button>
              )
            ) : (
              <p className="text-[11px] font-medium text-carbon-blue/55">
                {COMPANY_DELETE_BLOCKED_MESSAGE}
              </p>
            )}
          </div>
        ) : null}

        {error ? <p className="mt-2 text-[11px] text-red-700">{error}</p> : null}
      </div>
    );
  }

  if (formOnly) return null;

  return (
    <div>
      <div className="flex flex-wrap items-start gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-carbon-blue sm:text-3xl">
          {identity.companyName}
        </h1>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1 border border-carbon-blue/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/55 transition-colors hover:border-upcycle-orange hover:text-upcycle-orange"
        >
          <Pencil className="size-3" strokeWidth={2} />
          Edit
        </button>
      </div>
      {showInlineFields ? <IdentityFields identity={identity} /> : null}
    </div>
  );
}
