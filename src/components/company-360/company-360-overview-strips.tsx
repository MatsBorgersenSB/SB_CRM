"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { CreateContactInput, UpdateContactInput } from "@/types/contact";
import type { CreateOpportunityInput } from "@/types/deal";
import type { PipelineRow } from "@/types/pipeline";
import { formatDealValue } from "@/types/pipeline";
import type { Project } from "@/types/project";
import { PROJECT_STAGE_LABELS } from "@/types/project";
import type { UserRole } from "@/types/auth";
import { getActivitiesForDeal } from "@/lib/activity-utils";
import { computeOpportunityMomentum } from "@/lib/opportunity-intelligence-engine";
import { opportunityStageLabel } from "@/lib/opportunity-overview";
import { resolveOpportunityOwner } from "@/lib/opportunity-owner";
import { formatOfferingLabels } from "@/lib/standard-bio-offerings";
import {
  ATTIO_PILL,
  ATTIO_STATUS_DOT,
} from "@/lib/attio-workspace-surfaces";
import { OpportunityMomentumBadge } from "@/components/opportunity/opportunity-intelligence-display";
import { OpportunityProbabilityPill } from "@/components/opportunity/opportunity-probability-pill";
import { CompanyOpportunitiesSection } from "@/components/opportunity/company-opportunities-section";
import { CompanyContactsTable } from "@/components/company-360/company-contacts-table";
import {
  DealLink,
  ProjectLink,
} from "@/components/relationship/relationship-links";
import {
  WorkspacePanel,
  HealthStatusIcon,
  SmartCRMIcon,
} from "@/components/ui/smartcrm-icon";

function formatCloseDate(value: string | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function OpportunityKeyAttribute({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className={`${ATTIO_PILL} cursor-default`}>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </dt>
      <dd className="min-w-0 font-medium text-slate-800 dark:text-slate-100">
        {children}
      </dd>
    </div>
  );
}

const DEAL_TEASER_LIMIT = 5;
const PROJECT_TEASER_LIMIT = 5;

function ViewAllButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 text-[11px] font-semibold text-upcycle-orange transition-colors hover:text-carbon-blue"
    >
      {label}
    </button>
  );
}

function StripEmpty({ children }: { children: string }) {
  return <p className="text-[13px] text-carbon-blue/45">{children}</p>;
}

function PeopleOverviewStrip({
  company,
  companies,
  role,
  activities,
  allProjects,
  onCreateContact,
  onContactUpdate,
  onContactDelete,
  onContactReassign,
  onContactArchive,
  createRequestId,
}: {
  company: Company;
  companies: Company[];
  role: UserRole;
  activities: Activity[];
  allProjects: Project[];
  onCreateContact?: (input: CreateContactInput) => Promise<void>;
  onContactUpdate?: (contactId: string, patch: UpdateContactInput) => Promise<void>;
  onContactDelete?: (contactId: string) => Promise<void>;
  onContactReassign?: (contactId: string, targetCompanyId: string) => Promise<void>;
  onContactArchive?: (contactId: string, archived: boolean) => Promise<void>;
  createRequestId?: number;
}) {
  return (
    <WorkspacePanel
      title="People"
      id="contacts"
      count={company.contacts.length}
    >
      <CompanyContactsTable
        contacts={company.contacts}
        companyId={company.CompanyID}
        companies={companies}
        role={role}
        activities={activities}
        projects={allProjects}
        onCreateContact={onCreateContact}
        onContactUpdate={onContactUpdate}
        onContactDelete={onContactDelete}
        onContactReassign={onContactReassign}
        onContactArchive={onContactArchive}
        createRequestId={createRequestId}
      />
    </WorkspacePanel>
  );
}

function OpportunitiesOverviewStrip({
  company,
  companies,
  deals,
  pipelines,
  activities,
  commercialPackages,
  canCreate = false,
  canManageStakeholders = false,
  onCreateOpportunity,
  onAssignStakeholder,
  onCompanyUpdated,
  onViewAll,
}: {
  company: Company;
  companies: Company[];
  deals: PipelineRow[];
  /** Full pipeline set for win-probability context (same as deal workspace). */
  pipelines: PipelineRow[];
  activities: Activity[];
  commercialPackages: CommercialPackage[];
  canCreate?: boolean;
  canManageStakeholders?: boolean;
  onCreateOpportunity?: (input: CreateOpportunityInput) => Promise<PipelineRow>;
  onAssignStakeholder?: (
    dealId: string,
    contactId: string,
    projectRole: string,
  ) => Promise<PipelineRow>;
  onCompanyUpdated?: (company: Company) => void;
  onViewAll: () => void;
}) {
  const [createRequestId, setCreateRequestId] = useState(0);

  const rows = useMemo(() => {
    const sorted = [...deals].sort((a, b) => {
      if (b.salesValue !== a.salesValue) return b.salesValue - a.salesValue;
      return a.assetName.localeCompare(b.assetName);
    });
    return sorted.slice(0, DEAL_TEASER_LIMIT).map((deal, index) => {
      const dealActivities = getActivitiesForDeal(activities, deal.id);
      return {
        deal,
        primary: index === 0,
        stage: opportunityStageLabel(deal, commercialPackages),
        momentum: computeOpportunityMomentum(dealActivities),
        value: formatDealValue(deal.currency, deal.salesValue),
        ownerLabel: resolveOpportunityOwner(deal, company)?.Title ?? "—",
        closeDate: formatCloseDate(deal.expectedCloseDate),
        offerings: formatOfferingLabels(deal.offeringIds),
      };
    });
  }, [deals, activities, commercialPackages, company]);

  const probabilityPipelines = pipelines.length > 0 ? pipelines : deals;

  return (
    <WorkspacePanel
      title="Opportunities"
      id="overview-opportunities"
      count={deals.length}
      headerTrailing={
        <div className="flex shrink-0 items-center gap-3">
          {canCreate ? (
            <button
              type="button"
              onClick={() => setCreateRequestId((value) => value + 1)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-upcycle-orange transition-colors hover:text-carbon-blue"
            >
              <SmartCRMIcon name="add" size="xs" />
              Create Opportunity
            </button>
          ) : null}
          <ViewAllButton label="View all →" onClick={onViewAll} />
        </div>
      }
    >
      {rows.length === 0 ? (
        <StripEmpty>No opportunities linked to this company.</StripEmpty>
      ) : (
        <ul className="divide-y divide-carbon-blue/6">
          {rows.map(
            ({
              deal,
              primary,
              stage,
              momentum,
              value,
              ownerLabel,
              closeDate,
              offerings,
            }) => (
              <li
                key={deal.id}
                className={`py-3 first:pt-0 last:pb-0 ${
                  primary ? "-mx-2 bg-carbon-blue/[0.02] px-2 sm:-mx-3 sm:px-3" : ""
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <DealLink
                    dealId={deal.id}
                    showIcon={false}
                    className={`min-w-0 truncate hover:text-upcycle-orange ${
                      primary
                        ? "text-[14px] font-bold text-carbon-blue"
                        : "text-[13px] font-semibold text-carbon-blue"
                    }`}
                  >
                    {deal.assetName}
                  </DealLink>
                  <OpportunityMomentumBadge momentum={momentum} className="shrink-0" />
                </div>

                <dl className="mt-1.5 flex flex-wrap gap-1">
                  <OpportunityKeyAttribute label="Stage">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={ATTIO_STATUS_DOT} aria-hidden />
                      {stage}
                    </span>
                  </OpportunityKeyAttribute>

                  <OpportunityKeyAttribute label="Value">
                    <span className="font-mono tabular-nums">{value}</span>
                  </OpportunityKeyAttribute>

                  <OpportunityKeyAttribute label="Owner">
                    {ownerLabel}
                  </OpportunityKeyAttribute>

                  <OpportunityProbabilityPill
                    pipeline={deal}
                    companies={companies}
                    activities={activities}
                    pipelines={probabilityPipelines}
                    popoverSide="top"
                  />

                  <OpportunityKeyAttribute label="Close date">
                    <span className="tabular-nums">{closeDate}</span>
                  </OpportunityKeyAttribute>

                  <OpportunityKeyAttribute label="Offerings">
                    <span className="truncate">{offerings}</span>
                  </OpportunityKeyAttribute>
                </dl>
              </li>
            ),
          )}
        </ul>
      )}

      {canCreate && onCreateOpportunity ? (
        <CompanyOpportunitiesSection
          deals={deals}
          commercialPackages={commercialPackages}
          company={company}
          canCreate={canCreate}
          canManageStakeholders={canManageStakeholders}
          onCreateOpportunity={onCreateOpportunity}
          onAssignStakeholder={onAssignStakeholder}
          onCompanyUpdated={onCompanyUpdated}
          createRequestId={createRequestId}
          createOnly
          showCreateTrigger={false}
        />
      ) : null}
    </WorkspacePanel>
  );
}

function ProjectsOverviewStrip({
  projects,
  onViewAll,
}: {
  projects: Project[];
  onViewAll: () => void;
}) {
  const rows = useMemo(
    () =>
      [...projects]
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, PROJECT_TEASER_LIMIT),
    [projects],
  );

  return (
    <WorkspacePanel
      title="Projects"
      id="overview-projects"
      count={projects.length > 0 ? projects.length : undefined}
      headerTrailing={<ViewAllButton label="View all →" onClick={onViewAll} />}
    >
      {rows.length === 0 ? (
        <StripEmpty>No linked projects.</StripEmpty>
      ) : (
        <ul className="divide-y divide-carbon-blue/6">
          {rows.map((project) => {
            const stageLabel = project.stage
              ? PROJECT_STAGE_LABELS[project.stage]
              : project.status;
            return (
              <li
                key={project.id}
                className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <ProjectLink
                    projectId={project.id}
                    showIcon={false}
                    className="truncate text-[13px] font-semibold text-carbon-blue hover:text-upcycle-orange"
                  >
                    {project.name}
                  </ProjectLink>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-carbon-blue/55">
                    <span className="inline-flex items-center gap-1">
                      <HealthStatusIcon status={project.health} size="xs" />
                      {project.status}
                    </span>
                    <span aria-hidden>·</span>
                    <span>{stageLabel}</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </WorkspacePanel>
  );
}

/**
 * Overview strips — People (full contacts) · Opportunities · Projects teasers.
 * Contact management lives on Overview; Work tab holds full opportunity/project tables.
 */
export function Company360OverviewStrips({
  company,
  companies,
  role,
  activities,
  deals,
  pipelines,
  commercialPackages,
  projects,
  allProjects,
  onOpenWork,
  onCreateContact,
  onContactUpdate,
  onContactDelete,
  onContactReassign,
  onContactArchive,
  createRequestId,
  canCreateOpportunity: canCreateOpp = false,
  canManageOpportunityStakeholders: canManageStakeholders = false,
  onCreateOpportunity,
  onAssignOpportunityStakeholder,
  onCompanyUpdated,
}: {
  company: Company;
  companies: Company[];
  role: UserRole;
  activities: Activity[];
  deals: PipelineRow[];
  /** Full pipeline list for probability context; defaults to linked deals. */
  pipelines?: PipelineRow[];
  commercialPackages: CommercialPackage[];
  /** Linked projects for the Projects teaser. */
  projects: Project[];
  /** Full project list for contact project-role labels. */
  allProjects: Project[];
  onOpenWork: () => void;
  onCreateContact?: (input: CreateContactInput) => Promise<void>;
  onContactUpdate?: (contactId: string, patch: UpdateContactInput) => Promise<void>;
  onContactDelete?: (contactId: string) => Promise<void>;
  onContactReassign?: (contactId: string, targetCompanyId: string) => Promise<void>;
  onContactArchive?: (contactId: string, archived: boolean) => Promise<void>;
  createRequestId?: number;
  canCreateOpportunity?: boolean;
  canManageOpportunityStakeholders?: boolean;
  onCreateOpportunity?: (input: CreateOpportunityInput) => Promise<PipelineRow>;
  onAssignOpportunityStakeholder?: (
    dealId: string,
    contactId: string,
    projectRole: string,
  ) => Promise<PipelineRow>;
  onCompanyUpdated?: (company: Company) => void;
}) {
  return (
    <>
      <PeopleOverviewStrip
        company={company}
        companies={companies}
        role={role}
        activities={activities}
        allProjects={allProjects}
        onCreateContact={onCreateContact}
        onContactUpdate={onContactUpdate}
        onContactDelete={onContactDelete}
        onContactReassign={onContactReassign}
        onContactArchive={onContactArchive}
        createRequestId={createRequestId}
      />
      <OpportunitiesOverviewStrip
        company={company}
        companies={companies}
        deals={deals}
        pipelines={pipelines ?? deals}
        activities={activities}
        commercialPackages={commercialPackages}
        canCreate={canCreateOpp}
        canManageStakeholders={canManageStakeholders}
        onCreateOpportunity={onCreateOpportunity}
        onAssignStakeholder={onAssignOpportunityStakeholder}
        onCompanyUpdated={onCompanyUpdated}
        onViewAll={onOpenWork}
      />
      <ProjectsOverviewStrip projects={projects} onViewAll={onOpenWork} />
    </>
  );
}
