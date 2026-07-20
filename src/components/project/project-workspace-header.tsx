"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Company, SharePointPerson } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { Project } from "@/types/project";
import { PROJECT_KIND_LABELS, PROJECT_STAGE_LABELS } from "@/types/project";
import type { ProjectRelatedOrganization } from "@/types/project-relationships";
import { deal360Href } from "@/types/relationship-navigation";
import { EDITORIAL_LABEL, EDITORIAL_PAGE_TITLE } from "@/lib/editorial-design-system";
import { HealthStatusIcon } from "@/components/ui/smartcrm-icon";
import {
  buildProjectOwnerOptions,
  resolveProjectOwner,
} from "@/lib/project-owner";
import { canAssignProjectOwner, canManageProjectStakeholders } from "@/lib/permissions";
import type { UserRole } from "@/types/auth";
import { ProjectAccountControl } from "@/components/project/project-account-control";
import { ProjectRelationshipValidationBanner } from "@/components/project/project-relationship-validation-banner";
import type { ProjectRelationshipValidation } from "@/types/project-relationships";

const STICKY_NEGATIVE_MARGIN =
  "-mx-4 px-4 sm:-mx-6 sm:px-6 xl:-mx-8 xl:px-8";

export function ProjectWorkspaceHeader({
  project,
  companies,
  pipelines,
  role,
  standardBioUsers,
  organizations,
  relationshipValidation,
  onOwnerChange,
  onOrganizationsChange,
  onAddOrganization,
}: {
  project: Project;
  companies: Company[];
  pipelines: PipelineRow[];
  role: UserRole;
  standardBioUsers: SharePointPerson[];
  organizations: ProjectRelatedOrganization[];
  relationshipValidation?: ProjectRelationshipValidation;
  onOwnerChange?: (owner: SharePointPerson) => Promise<void>;
  onOrganizationsChange?: (organizations: ProjectRelatedOrganization[]) => Promise<void>;
  onAddOrganization?: () => void;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  const linkedCompany = companies.find((company) => company.CompanyID === project.linkedCompanyId);
  const linkedDeal = pipelines.find((deal) => deal.id === project.linkedDealId);
  const accountLabel = linkedCompany?.Title ?? "—";
  const kindLabel = PROJECT_KIND_LABELS[project.kind];
  const owner = resolveProjectOwner(project);
  const ownerOptions = useMemo(() => {
    const byId = new Map<number, SharePointPerson>();
    for (const user of standardBioUsers) {
      byId.set(user.Id, user);
    }
    for (const option of buildProjectOwnerOptions(companies, owner)) {
      if (!byId.has(option.Id)) {
        byId.set(option.Id, option);
      }
    }
    if (owner?.Title && !byId.has(owner.Id)) {
      byId.set(owner.Id, owner);
    }
    return Array.from(byId.values()).sort((a, b) => a.Title.localeCompare(b.Title));
  }, [standardBioUsers, companies, owner]);
  const ownerLabel = owner?.Title ?? "—";
  const canEditOwner = canAssignProjectOwner(role) && Boolean(onOwnerChange);
  const canEditAccount = canManageProjectStakeholders(role) && Boolean(onOrganizationsChange);

  const handleOwnerChange = async (nextOwner: SharePointPerson) => {
    await onOwnerChange?.(nextOwner);
  };

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const scrollRoot = sentinel.closest("main");
    const observer = new IntersectionObserver(
      ([entry]) => setCompact(!entry?.isIntersecting),
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
          aria-label="Project context"
          className={`sticky top-0 z-20 ${STICKY_NEGATIVE_MARGIN} border-b border-carbon-blue/8 bg-[var(--dashboard-surface)]/95 py-2.5 backdrop-blur-sm`}
        >
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto text-[12px] text-carbon-blue/75 sm:gap-3">
            <CompactField label="Project" value={project.name} emphasize />
            <CompactDivider />
            <CompactField label="Account" value={accountLabel} />
            <CompactDivider />
            <CompactField label="Stage" value={project.stage ? PROJECT_STAGE_LABELS[project.stage] : "Planning"} />
            <CompactDivider />
            <CompactField label="Status" value={project.status} />
            <CompactDivider />
            <CompactField label="Owner" value={ownerLabel} />
          </div>
        </header>
      ) : null}

      <div className="flex flex-col gap-8 pb-1">
        <div className="min-w-0">
          <p className={`${EDITORIAL_LABEL} mb-2`}>{kindLabel}</p>
          <h1 className={EDITORIAL_PAGE_TITLE}>{project.name}</h1>
        </div>

        <dl className="flex flex-wrap items-baseline gap-x-5 gap-y-2 text-[13px] text-carbon-blue/70">
          <MetadataItem label="Account">
            <ProjectAccountControl
              accountCompanyId={project.linkedCompanyId}
              accountLabel={accountLabel}
              companies={companies}
              organizations={organizations}
              editable={canEditAccount}
              onOrganizationsChange={onOrganizationsChange}
              onAddOrganization={onAddOrganization}
            />
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
            <span>{project.stage ? PROJECT_STAGE_LABELS[project.stage] : "Planning"}</span>
          </MetadataItem>
          <span className="hidden text-carbon-blue/15 sm:inline" aria-hidden>
            ·
          </span>
          <MetadataItem label="Status">
            <span>{project.status}</span>
          </MetadataItem>
          <span className="hidden text-carbon-blue/15 sm:inline" aria-hidden>
            ·
          </span>
          <MetadataItem label="Priority">
            <span>{project.priority}</span>
          </MetadataItem>
          <span className="hidden text-carbon-blue/15 sm:inline" aria-hidden>
            ·
          </span>
          <MetadataItem label="Health">
            <span className="inline-flex items-center gap-1.5">
              <HealthStatusIcon status={project.health} size="xs" />
              {project.health}
            </span>
          </MetadataItem>
          <span className="hidden text-carbon-blue/15 sm:inline" aria-hidden>
            ·
          </span>
          <MetadataItem label="Strategic importance">
            <span>{project.strategicImportance}</span>
          </MetadataItem>
          {linkedDeal ? (
            <>
              <span className="hidden text-carbon-blue/15 sm:inline" aria-hidden>
                ·
              </span>
              <MetadataItem label="Opportunity">
                <Link
                  href={deal360Href(linkedDeal.id)}
                  className="text-carbon-blue hover:text-upcycle-orange"
                >
                  {linkedDeal.assetName}
                </Link>
              </MetadataItem>
            </>
          ) : null}
        </dl>

        {relationshipValidation?.detected ? (
          <ProjectRelationshipValidationBanner validation={relationshipValidation} compact />
        ) : null}
      </div>
    </>
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
      className="max-w-full cursor-pointer border-0 bg-transparent py-0 pl-0 pr-5 text-[13px] font-medium text-carbon-blue outline-none hover:text-upcycle-orange focus:text-upcycle-orange"
      aria-label="Project owner"
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
            <span className="text-[11px] font-medium text-carbon-blue/40">{label}</span>
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
      <dd className="min-w-0 font-medium text-carbon-blue">{children}</dd>
    </div>
  );
}
