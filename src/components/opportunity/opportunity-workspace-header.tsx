"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { SharePointPerson } from "@/types/company";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import {
  formatDealValue,
  parseSalesValueInput,
} from "@/types/pipeline";
import { findCompanyForDeal } from "@/lib/opportunity-intelligence-engine";
import {
  buildAssignableOwnerOptions,
  resolveOpportunityOwner,
} from "@/lib/opportunity-owner";
import { CompanyLink } from "@/components/relationship/relationship-links";
import { opportunityStageLabel } from "@/lib/opportunity-overview";
import { EDITORIAL_LABEL, EDITORIAL_PAGE_TITLE } from "@/lib/editorial-design-system";
import type { CommercialPackage } from "@/types/commercial-package";
import {
  canAssignOpportunityOwner,
  canEditExpectedCloseDate,
  canEditOpportunityValue,
} from "@/lib/permissions";
import type { UserRole } from "@/types/auth";
import { OpportunityOfferingsPanel } from "@/components/opportunity/opportunity-offerings-panel";
import { formatOfferingLabels } from "@/lib/standard-bio-offerings";

const STICKY_NEGATIVE_MARGIN =
  "-mx-4 px-4 sm:-mx-6 sm:px-6 xl:-mx-8 xl:px-8";

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
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  const company = findCompanyForDeal(pipeline.id, companies);
  const stageLabel = opportunityStageLabel(pipeline, commercialPackages);
  const owner = resolveOpportunityOwner(pipeline, company);
  const ownerOptions = buildAssignableOwnerOptions(companies);
  const valueLabel = formatDealValue(pipeline.currency, pipeline.salesValue);
  const timelineLabel = formatTimelineDate(pipeline.expectedCloseDate);
  const ownerLabel = owner?.Title ?? "—";
  const accountLabel = company?.Title ?? "—";

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

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const scrollRoot = sentinel.closest("main");

    const observer = new IntersectionObserver(
      ([entry]) => {
        setCompact(!entry?.isIntersecting);
      },
      { root: scrollRoot, threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinelRef} className="h-px w-full shrink-0" aria-hidden />

      {compact ? (
        <header
          aria-label="Opportunity context"
          className={`sticky top-0 z-20 ${STICKY_NEGATIVE_MARGIN} border-b border-carbon-blue/8 bg-[var(--dashboard-surface)]/95 py-2.5 backdrop-blur-sm`}
        >
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto text-[12px] text-carbon-blue/75 sm:gap-3">
            <CompactField label="Opportunity" value={pipeline.assetName} emphasize />
            <CompactDivider />
            <CompactField label="Account" value={accountLabel} />
            <CompactDivider />
            <CompactField label="Value" value={valueLabel} className="tabular-nums" />
            <CompactDivider />
            <CompactField label="Stage" value={stageLabel} />
            <CompactDivider />
            <CompactField label="Owner" value={ownerLabel} />
            <CompactDivider />
            <CompactField label="Offerings" value={offeringsLabel} />
          </div>
        </header>
      ) : null}

      <div className="flex flex-col gap-8 pb-1">
        <div className="min-w-0">
          <h1 className={EDITORIAL_PAGE_TITLE}>{pipeline.assetName}</h1>
        </div>

        <dl className="flex flex-wrap items-baseline gap-x-5 gap-y-2 text-[13px] text-carbon-blue/70">
          <MetadataItem label="Account">
            {company ? (
              <CompanyLink
                companyId={company.CompanyID}
                className="text-carbon-blue hover:text-upcycle-orange"
              >
                {company.Title}
              </CompanyLink>
            ) : (
              "—"
            )}
          </MetadataItem>
          <span className="hidden text-carbon-blue/15 sm:inline" aria-hidden>
            ·
          </span>
          <MetadataItem label="Owner">
            <OwnerSelect
              owner={owner}
              options={ownerOptions}
              editable={canEditOwner}
              onChange={handleOwnerChange}
            />
          </MetadataItem>
          <span className="hidden text-carbon-blue/15 sm:inline" aria-hidden>
            ·
          </span>
          <MetadataItem label="Stage">
            <span>{stageLabel}</span>
          </MetadataItem>
          <span className="hidden text-carbon-blue/15 sm:inline" aria-hidden>
            ·
          </span>
          <MetadataItem label="Value">
            <EditableValue
              displayValue={valueLabel}
              rawValue={String(pipeline.salesValue)}
              editable={canEditValue}
              onCommit={(raw) => void handleValueChange(parseSalesValueInput(raw))}
              className="tabular-nums"
            />
          </MetadataItem>
          <span className="hidden text-carbon-blue/15 sm:inline" aria-hidden>
            ·
          </span>
          <MetadataItem label="Close">
            <EditableCloseDate
              value={pipeline.expectedCloseDate}
              displayValue={timelineLabel}
              editable={canEditTimeline}
              onChange={handleCloseDateChange}
            />
          </MetadataItem>
        </dl>

        <OpportunityOfferingsPanel
          pipeline={pipeline}
          onSave={onPipelinePatch ? handleOfferingsChange : undefined}
          readOnly={!onPipelinePatch}
        />
      </div>
    </>
  );
}

function CompactField({
  label,
  value,
  emphasize = false,
  className = "",
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  className?: string;
}) {
  return (
    <div className="min-w-0 shrink-0">
      <span className="sr-only">{label}: </span>
      <span
        className={`block max-w-[9rem] truncate sm:max-w-[11rem] ${
          emphasize ? "font-semibold text-carbon-blue" : "text-carbon-blue/75"
        } ${className}`}
        title={`${label}: ${value}`}
      >
        {emphasize ? (
          value
        ) : (
          <>
            <span className="text-[11px] font-medium text-carbon-blue/40">
              {label}
            </span>
            <span className="mt-0.5 block truncate">{value}</span>
          </>
        )}
      </span>
    </div>
  );
}

function CompactDivider() {
  return <span aria-hidden className="h-3 w-px shrink-0 bg-carbon-blue/15" />;
}

function MetadataItem({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <dt className={EDITORIAL_LABEL}>{label}</dt>
      <dd className="text-carbon-blue/80">{children}</dd>
    </div>
  );
}

function OwnerSelect({
  owner,
  options,
  editable,
  onChange,
}: {
  owner: SharePointPerson | null;
  options: SharePointPerson[];
  editable: boolean;
  onChange: (owner: SharePointPerson) => void | Promise<void>;
}) {
  if (!editable) {
    return <span className="font-medium text-carbon-blue/75">{owner?.Title ?? "—"}</span>;
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
      className="max-w-full cursor-pointer border-0 bg-transparent py-0 pl-0 pr-5 text-[13px] text-carbon-blue/80 outline-none hover:text-upcycle-orange focus:text-upcycle-orange"
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
    return <span className="font-medium text-carbon-blue/75">{displayValue}</span>;
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="date"
        defaultValue={toDateInputValue(value)}
        className="w-full min-w-0 border border-upcycle-orange/40 bg-white px-1.5 py-0.5 text-[12px] text-carbon-blue outline-none"
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
      className="font-medium text-carbon-blue/75 underline decoration-carbon-blue/15 decoration-dotted underline-offset-2 hover:text-upcycle-orange hover:decoration-upcycle-orange/40"
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
        className={`w-full min-w-0 border border-upcycle-orange/40 bg-white px-1.5 py-0.5 text-[13px] text-carbon-blue outline-none ${className}`}
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
      className={`text-left underline decoration-carbon-blue/20 decoration-dotted underline-offset-2 hover:text-upcycle-orange hover:decoration-upcycle-orange/50 ${className}`}
      title="Click to edit deal value"
    >
      {displayValue}
    </button>
  );
}
