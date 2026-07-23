"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { SharePointPerson } from "@/types/company";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { formatDealValue, parseSalesValueInput } from "@/types/pipeline";
import { findCompanyForDeal } from "@/lib/opportunity-intelligence-engine";
import {
  buildAssignableOwnerOptions,
  resolveOpportunityOwner,
} from "@/lib/opportunity-owner";
import { CompanyLink } from "@/components/relationship/relationship-links";
import { opportunityStageLabel } from "@/lib/opportunity-overview";
import type { CommercialPackage } from "@/types/commercial-package";
import {
  canAssignOpportunityOwner,
  canEditExpectedCloseDate,
  canEditOpportunityValue,
} from "@/lib/permissions";
import type { UserRole } from "@/types/auth";
import { OpportunityOfferingsPanel } from "@/components/opportunity/opportunity-offerings-panel";
import { formatOfferingLabels } from "@/lib/standard-bio-offerings";
import {
  ATTIO_PILL,
  ATTIO_PILL_STATIC,
  ATTIO_STATUS_DOT,
  ATTIO_SURFACE,
  ATTIO_SURFACE_HEADER,
} from "@/lib/attio-workspace-surfaces";

function formatTimelineDate(value: string | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function toDateInputValue(value: string | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export function OpportunityWorkspaceHeader({
  pipeline,
  companies,
  commercialPackages,
  role,
  onPipelinePatch,
}: {
  pipeline: PipelineRow;
  companies: Company[];
  commercialPackages: CommercialPackage[];
  role: UserRole;
  onPipelinePatch?: (patch: Partial<PipelineRow>) => Promise<void>;
}) {
  const company = findCompanyForDeal(pipeline.id, companies);
  const stageLabel = opportunityStageLabel(pipeline, commercialPackages);
  const owner = resolveOpportunityOwner(pipeline, company);
  const ownerOptions = buildAssignableOwnerOptions(companies);
  const valueLabel = formatDealValue(pipeline.currency, pipeline.salesValue);
  const timelineLabel = formatTimelineDate(pipeline.expectedCloseDate);
  const ownerLabel = owner?.Title ?? "—";

  const canEditOwner = canAssignOpportunityOwner(role) && Boolean(onPipelinePatch);
  const canEditTimeline = canEditExpectedCloseDate(role) && Boolean(onPipelinePatch);
  const canEditValue = canEditOpportunityValue(role) && Boolean(onPipelinePatch);

  const handleOwnerChange = async (nextOwner: SharePointPerson) => {
    await onPipelinePatch?.({ opportunityOwner: nextOwner });
  };

  const handleCloseDateChange = async (nextDate: string | undefined) => {
    await onPipelinePatch?.({ expectedCloseDate: nextDate });
  };

  const handleValueChange = async (nextValue: number) => {
    await onPipelinePatch?.({ salesValue: nextValue });
  };

  const handleOfferingsChange = async (offeringIds: string[]) => {
    await onPipelinePatch?.({ offeringIds });
  };

  const offeringsLabel = formatOfferingLabels(pipeline.offeringIds);

  return (
    <header aria-label="Opportunity context" className={`${ATTIO_SURFACE} overflow-hidden`}>
      <div className={ATTIO_SURFACE_HEADER}>
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 flex-wrap items-center gap-1.5 text-[12px] text-slate-500 dark:text-slate-400"
        >
          <Link
            href="/opportunities"
            className="font-medium transition-colors hover:text-slate-800 dark:hover:text-slate-200"
          >
            Opportunities
          </Link>
          <span aria-hidden className="text-slate-300 dark:text-slate-600">
            /
          </span>
          <span className="truncate font-semibold text-slate-800 dark:text-slate-100">
            {pipeline.assetName}
          </span>
        </nav>
      </div>

      <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-[22px] font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-[24px]">
              {pipeline.assetName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={ATTIO_PILL_STATIC}>
                <span className={ATTIO_STATUS_DOT} aria-hidden />
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {stageLabel}
                </span>
              </span>
              {company ? (
                <CompanyLink
                  companyId={company.CompanyID}
                  className={`${ATTIO_PILL_STATIC} hover:border-slate-300 hover:bg-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-800`}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                    Account
                  </span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {company.Title}
                  </span>
                </CompanyLink>
              ) : (
                <span className={ATTIO_PILL_STATIC}>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                    Account
                  </span>
                  <span>—</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <dl className="flex flex-wrap gap-1.5">
          <AttributePill label="Stage">
            <span className="inline-flex items-center gap-1.5">
              <span className={ATTIO_STATUS_DOT} aria-hidden />
              {stageLabel}
            </span>
          </AttributePill>

          <AttributePill label="Value">
            <EditableValue
              displayValue={valueLabel}
              rawValue={String(pipeline.salesValue)}
              editable={canEditValue}
              onCommit={(raw) => void handleValueChange(parseSalesValueInput(raw))}
              className="font-mono tabular-nums"
            />
          </AttributePill>

          <AttributePill label="Owner">
            <OwnerSelect
              owner={owner}
              options={ownerOptions}
              editable={canEditOwner}
              onChange={handleOwnerChange}
              fallbackLabel={ownerLabel}
            />
          </AttributePill>

          <AttributePill label="Close date">
            <EditableCloseDate
              value={pipeline.expectedCloseDate}
              displayValue={timelineLabel}
              editable={canEditTimeline}
              onChange={handleCloseDateChange}
            />
          </AttributePill>

          <AttributePill label="Offerings">
            <span className="truncate">{offeringsLabel}</span>
          </AttributePill>
        </dl>

        <div className="border-t border-slate-200/80 pt-3 dark:border-slate-800">
          <OpportunityOfferingsPanel
            pipeline={pipeline}
            onSave={onPipelinePatch ? handleOfferingsChange : undefined}
            readOnly={!onPipelinePatch}
          />
        </div>
      </div>
    </header>
  );
}

function AttributePill({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className={`${ATTIO_PILL} group/pill cursor-default`}>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </dt>
      <dd className="min-w-0 font-medium text-slate-800 dark:text-slate-100">{children}</dd>
    </div>
  );
}

function OwnerSelect({
  owner,
  options,
  editable,
  onChange,
  fallbackLabel,
}: {
  owner: SharePointPerson | null;
  options: SharePointPerson[];
  editable: boolean;
  onChange: (owner: SharePointPerson) => void | Promise<void>;
  fallbackLabel: string;
}) {
  if (!editable) {
    return <span>{fallbackLabel}</span>;
  }

  const choices =
    owner && !options.some((option) => option.Id === owner.Id)
      ? [owner, ...options]
      : options;

  return (
    <select
      value={owner?.Id ?? ""}
      onChange={(event) => {
        const selected = choices.find((option) => option.Id === Number(event.target.value));
        if (selected) void onChange(selected);
      }}
      className="max-w-[10rem] cursor-pointer border-0 bg-transparent py-0 pl-0 pr-4 text-[12px] font-medium text-slate-800 outline-none dark:text-slate-100"
      aria-label="Opportunity owner"
    >
      {!owner ? <option value="">Select owner</option> : null}
      {choices.map((option) => (
        <option key={option.Id} value={option.Id}>
          {option.Title}
        </option>
      ))}
    </select>
  );
}

function EditableCloseDate({
  value,
  displayValue,
  editable,
  onChange,
}: {
  value: string | undefined;
  displayValue: string;
  editable: boolean;
  onChange: (value: string | undefined) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.showPicker?.();
    }
  }, [editing]);

  if (!editable) {
    return <span className="tabular-nums">{displayValue}</span>;
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="date"
        defaultValue={toDateInputValue(value)}
        className="w-full min-w-0 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[12px] text-slate-800 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        onBlur={() => setEditing(false)}
        onChange={(event) => {
          const next = event.target.value || undefined;
          void onChange(next);
          setEditing(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="tabular-nums hover:text-slate-950 dark:hover:text-white"
      title="Click to change expected close date"
    >
      {displayValue}
    </button>
  );
}

function EditableValue({
  displayValue,
  rawValue,
  editable,
  onCommit,
  className = "",
}: {
  displayValue: string;
  rawValue: string;
  editable: boolean;
  onCommit: (raw: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  if (!editable) {
    return <span className={className}>{displayValue}</span>;
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        defaultValue={rawValue}
        className={`w-full min-w-[6rem] rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[12px] text-slate-800 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 ${className}`}
        onBlur={(event) => {
          onCommit(event.target.value);
          setEditing(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onCommit(event.currentTarget.value);
            setEditing(false);
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`text-left hover:text-slate-950 dark:hover:text-white ${className}`}
      title="Click to edit deal value"
    >
      {displayValue}
    </button>
  );
}
