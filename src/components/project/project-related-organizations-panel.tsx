"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronsUpDown, X } from "lucide-react";
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
  filterAvailableProjectCompanies,
  getOrganizationTypeLabel,
  resolveOrganizationLabel,
  suggestProjectOrganizationType,
} from "@/lib/project-relationship-utils";
import { CompanyLink } from "@/components/relationship/relationship-links";
import { SmartCRMIcon } from "@/components/ui/smartcrm-icon";

export function CompanyCombobox({
  companies,
  selectedCompanyId,
  onSelect,
  onCreateCompany,
  disabled = false,
  label = "Organization",
  placeholder = "Select or search company…",
  emptyMessage = "No matching companies in registry.",
}: {
  companies: Company[];
  selectedCompanyId: string;
  onSelect: (company: Company | null) => void;
  onCreateCompany?: (title: string) => Promise<Company | null>;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  emptyMessage?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [hasTypedSinceOpen, setHasTypedSinceOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const selected = useMemo(
    () => companies.find((company) => company.CompanyID === selectedCompanyId) ?? null,
    [companies, selectedCompanyId],
  );

  const displayValue = hasTypedSinceOpen ? query : (selected?.Title ?? "");

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setHasTypedSinceOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setHasTypedSinceOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const effectiveQuery = hasTypedSinceOpen ? query : "";
  const filtered = useMemo(
    () =>
      filterAvailableProjectCompanies(companies, [], {
        query: effectiveQuery,
      }),
    [companies, effectiveQuery],
  );

  const trimmedQuery = displayValue.trim();
  const exactMatch = useMemo(
    () =>
      trimmedQuery.length > 0 &&
      companies.some(
        (company) => company.Title.trim().toLowerCase() === trimmedQuery.toLowerCase(),
      ),
    [companies, trimmedQuery],
  );

  const handleCreate = async () => {
    if (!onCreateCompany || !trimmedQuery || creating) return;
    setCreating(true);
    try {
      const created = await onCreateCompany(trimmedQuery);
      if (created) {
        onSelect(created);
        setQuery(created.Title);
        setIsOpen(false);
        setHasTypedSinceOpen(false);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={rootRef} className="relative block">
      {label ? (
        <span className="text-[11px] font-bold uppercase tracking-wider text-carbon-blue/65">
          {label}
        </span>
      ) : null}
      <div className="relative mt-1">
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          disabled={disabled || creating}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-label={label || placeholder}
          aria-expanded={isOpen}
          aria-controls={listId}
          onFocus={() => {
            setIsOpen(true);
            setHasTypedSinceOpen(false);
          }}
          onClick={() => {
            setIsOpen(true);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setHasTypedSinceOpen(true);
            setIsOpen(true);
            if (selectedCompanyId) {
              onSelect(null);
            }
          }}
          className="w-full border border-carbon-blue/15 bg-white py-2 pl-3 pr-14 text-[13px] text-carbon-blue outline-none focus:border-upcycle-orange"
        />
        <div className=" absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
          {displayValue && !disabled ? (
            <button
              type="button"
              tabIndex={-1}
              aria-label="Clear selected company"
              onClick={(event) => {
                event.stopPropagation();
                setQuery("");
                setHasTypedSinceOpen(true);
                onSelect(null);
                setIsOpen(true);
                inputRef.current?.focus();
              }}
              className="p-1 text-carbon-blue/45 hover:text-carbon-blue"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled || creating}
            aria-label="Toggle company list"
            onClick={() => {
              setIsOpen((prev) => {
                const next = !prev;
                if (next) setHasTypedSinceOpen(false);
                return next;
              });
            }}
            className="p-1 text-carbon-blue/50 hover:text-carbon-blue"
          >
            <ChevronsUpDown className="size-3.5" />
          </button>
        </div>
      </div>

      {isOpen ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-40 mt-1 max-h-64 overflow-y-auto border border-carbon-blue/15 bg-white shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-[12px] text-carbon-blue/55">{emptyMessage}</li>
          ) : (
            filtered.map((company) => {
              const isSelected = company.CompanyID === selectedCompanyId;
              const typeSummary = (company.CompanyTypes ?? [])
                .filter((t) => t !== "Unclassified")
                .join(", ");
              const locationSummary = [company.City, company.Country?.Title]
                .filter(Boolean)
                .join(", ");
              const subtitle = [
                typeSummary || company.Industry,
                locationSummary,
                company.Domain,
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <li key={company.CompanyID}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`flex w-full flex-col items-start px-3 py-2 text-left transition-colors hover:bg-upcycle-orange/10 ${
                      isSelected ? "bg-upcycle-orange/8" : ""
                    }`}
                    onClick={() => {
                      onSelect(company);
                      setQuery(company.Title);
                      setIsOpen(false);
                      setHasTypedSinceOpen(false);
                    }}
                  >
                    <span className="text-[13px] font-medium text-carbon-blue">
                      {company.Title}
                    </span>
                    {subtitle ? (
                      <span className="text-[11px] text-carbon-blue/60">{subtitle}</span>
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
          {onCreateCompany && trimmedQuery.length >= 2 && !exactMatch ? (
            <li className="border-t border-carbon-blue/10">
              <button
                type="button"
                disabled={creating}
                onClick={() => void handleCreate()}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-[12px] font-semibold text-upcycle-orange hover:bg-upcycle-orange/10 disabled:opacity-50"
              >
                <SmartCRMIcon name="add" size="xs" />
                {creating
                  ? `Creating "${trimmedQuery}"…`
                  : `Create "${trimmedQuery}" in Companies and select`}
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

function OrganizationTypeDropdown({
  value,
  onChange,
  disabled = false,
}: {
  value: ProjectOrganizationType;
  onChange: (type: ProjectOrganizationType) => void;
  disabled?: boolean;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative mt-3 block">
      <span className="text-[11px] font-bold uppercase tracking-wider text-carbon-blue/65">
        Organization type
      </span>
      <button
        type="button"
        disabled={disabled}
        role="combobox"
        aria-label="Organization type"
        aria-expanded={isOpen}
        aria-controls={listId}
        onClick={() => setIsOpen((prev) => !prev)}
        className="mt-1 flex w-full items-center justify-between border border-carbon-blue/15 bg-white px-3 py-2 text-left text-[13px] text-carbon-blue outline-none focus:border-upcycle-orange"
      >
        <span>{PROJECT_ORGANIZATION_TYPE_LABELS[value]}</span>
        <ChevronsUpDown className="size-3.5 text-carbon-blue/50" />
      </button>
      {isOpen ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-40 mt-1 max-h-60 overflow-y-auto border border-carbon-blue/15 bg-white shadow-lg"
        >
          {PROJECT_ORGANIZATION_TYPES.map((type) => {
            const isSelected = type === value;
            return (
              <li key={type}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(type);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-[13px] text-carbon-blue transition-colors hover:bg-upcycle-orange/10 ${
                    isSelected ? "bg-upcycle-orange/8 font-semibold" : ""
                  }`}
                >
                  <span>{PROJECT_ORGANIZATION_TYPE_LABELS[type]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export function ProjectRelatedOrganizationsPanel({
  organizations,
  companies,
  readOnly = false,
  onChange,
  onCreateCompany,
}: {
  organizations: ProjectRelatedOrganization[];
  companies: Company[];
  readOnly?: boolean;
  onChange?: (organizations: ProjectRelatedOrganization[]) => Promise<void>;
  onCreateCompany?: (
    title: string,
    organizationType: ProjectOrganizationType,
  ) => Promise<Company | null>;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState("");
  const [organizationType, setOrganizationType] = useState<ProjectOrganizationType>("customer");
  const [typeTouched, setTypeTouched] = useState(false);
  const [label, setLabel] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const availableCompanies = useMemo(
    () =>
      filterAvailableProjectCompanies(companies, organizations, {
        editingId,
        includeCompanyId: editingId ? companyId : undefined,
      }),
    [companies, organizations, editingId, companyId],
  );

  const resetForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setCompanyId("");
    setOrganizationType("customer");
    setTypeTouched(false);
    setLabel("");
    setIsPrimary(false);
    setFormError(null);
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
    setTypeTouched(true);
    setLabel(org.label ?? "");
    setIsPrimary(Boolean(org.isPrimary));
    setFormError(null);
    setFormOpen(true);
  };

  const handleRemove = async (orgId: string) => {
    if (!onChange) return;
    await persist(organizations.filter((org) => org.id !== orgId));
  };

  return (
    <div className="flex flex-col gap-4">
      {organizations.length === 0 ? (
        <p className="text-sm text-carbon-blue/65">
          No related organizations yet. Link customer, partner, supplier, and other involved companies.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-carbon-blue/10 text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/60">
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
                      <span className="ml-2 border border-upcycle-orange/25 bg-upcycle-orange/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-upcycle-orange">
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
                          className="text-[12px] font-semibold text-carbon-blue/65 hover:text-carbon-blue"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRemove(org.id)}
                          className="text-[12px] font-semibold text-carbon-blue/65 hover:text-red-600"
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
              <p className="mb-2 text-[12px] text-carbon-blue/55">
                {editingId ? "Update organization on this project" : "Add organization to this project"}
              </p>
              <div className="max-w-xl">
                <CompanyCombobox
                  companies={availableCompanies}
                  selectedCompanyId={companyId}
                  disabled={saving}
                  label="Organization"
                  placeholder="Select or search company…"
                  onSelect={(company) => {
                    setFormError(null);
                    if (!company) {
                      setCompanyId("");
                      return;
                    }
                    setCompanyId(company.CompanyID);
                    if (!editingId && !typeTouched) {
                      setOrganizationType(suggestProjectOrganizationType(company));
                    }
                  }}
                  onCreateCompany={
                    onCreateCompany
                      ? async (title) => {
                          setFormError(null);
                          try {
                            return await onCreateCompany(title, organizationType);
                          } catch (error) {
                            setFormError(
                              error instanceof Error
                                ? error.message
                                : "Could not create company.",
                            );
                            return null;
                          }
                        }
                      : undefined
                  }
                />

                <OrganizationTypeDropdown
                  value={organizationType}
                  disabled={saving}
                  onChange={(nextType) => {
                    setOrganizationType(nextType);
                    setTypeTouched(true);
                  }}
                />

                <label className="mt-3 block">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-carbon-blue/65">
                    Label (optional)
                  </span>
                  <input
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    placeholder="e.g. EPC partner"
                    className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[13px] text-carbon-blue"
                  />
                </label>
                <label className="mt-3 flex items-center gap-2 text-[13px] text-carbon-blue/70">
                  <input
                    type="checkbox"
                    checked={isPrimary}
                    onChange={(event) => setIsPrimary(event.target.checked)}
                  />
                  Primary account organization
                </label>
                {formError ? (
                  <p className="mt-2 text-[12px] text-thermal-red" role="alert">
                    {formError}
                  </p>
                ) : null}
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
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="inline-flex items-center gap-1.5 border border-carbon-blue/12 px-3 py-1.5 text-[12px] font-semibold text-carbon-blue/65 hover:border-upcycle-orange/30 hover:text-upcycle-orange"
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
