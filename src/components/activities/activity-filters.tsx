"use client";

import { Search } from "lucide-react";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { ActivityFilters } from "@/types/activity";
import { ACTIVITY_TYPES, ACTION_STATUSES } from "@/types/activity";

type ActivityFiltersBarProps = {
  filters: ActivityFilters;
  onChange: (filters: ActivityFilters) => void;
  companies: Company[];
  pipelines: PipelineRow[];
  owners: string[];
};

export function ActivityFiltersBar({
  filters,
  onChange,
  companies,
  pipelines,
  owners,
}: ActivityFiltersBarProps) {
  const set = (patch: Partial<ActivityFilters>) =>
    onChange({ ...filters, ...patch });

  return (
    <div className="flex flex-col gap-2 border border-carbon-blue/10 bg-white p-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-carbon-blue/35"
          strokeWidth={1.75}
        />
        <input
          type="search"
          placeholder="Search activities…"
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          className="w-full border border-carbon-blue/12 bg-carbon-blue/[0.02] py-1.5 pl-8 pr-3 text-xs text-carbon-blue outline-none transition-colors focus:border-upcycle-orange/40 focus:ring-1 focus:ring-upcycle-orange/20"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 xl:grid-cols-7">
        <FilterSelect
          label="Company"
          value={filters.companyId}
          onChange={(v) => set({ companyId: v })}
          options={companies.map((c) => ({
            value: c.CompanyID,
            label: c.Title,
          }))}
        />
        <FilterSelect
          label="Contact"
          value={filters.contactId}
          onChange={(v) => set({ contactId: v })}
          options={companies.flatMap((c) =>
            c.contacts.map((contact) => ({
              value: contact.ContactID,
              label: `${contact.FirstName} ${contact.LastName}`,
            })),
          )}
        />
        <FilterSelect
          label="Deal"
          value={filters.dealId}
          onChange={(v) => set({ dealId: v })}
          options={pipelines.map((p) => ({
            value: p.id,
            label: `${p.id} — ${p.assetName}`,
          }))}
        />
        <FilterSelect
          label="Type"
          value={filters.activityType}
          onChange={(v) => set({ activityType: v as ActivityFilters["activityType"] })}
          options={ACTIVITY_TYPES.map((t) => ({ value: t, label: t }))}
        />
        <FilterSelect
          label="Owner"
          value={filters.ownerId}
          onChange={(v) => set({ ownerId: v })}
          options={owners.map((o) => ({ value: o, label: o }))}
        />
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(v) => set({ status: v as ActivityFilters["status"] })}
          options={ACTION_STATUSES.map((s) => ({ value: s, label: s }))}
        />
        <label className="block">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            From
          </span>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => set({ dateFrom: e.target.value })}
            className="mt-0.5 w-full border border-carbon-blue/12 bg-white px-2 py-1 text-xs text-carbon-blue outline-none focus:border-upcycle-orange/40"
          />
        </label>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block min-w-0">
      <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full truncate border border-carbon-blue/12 bg-white px-2 py-1 text-xs text-carbon-blue outline-none focus:border-upcycle-orange/40"
      >
        <option value="">All</option>
        {options.map((opt) => (
          <option key={`${label}-${opt.value}`} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
