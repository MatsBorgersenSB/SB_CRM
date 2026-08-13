"use client";

import { useMemo } from "react";
import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { CreateContactInput, UpdateContactInput } from "@/types/contact";
import type { PipelineRow } from "@/types/pipeline";
import { formatDealValue } from "@/types/pipeline";
import type { Project } from "@/types/project";
import { PROJECT_STAGE_LABELS } from "@/types/project";
import type { UserRole } from "@/types/auth";
import { getActivitiesForDeal } from "@/lib/activity-utils";
import { computeOpportunityMomentum } from "@/lib/opportunity-intelligence-engine";
import { opportunityStageLabel } from "@/lib/opportunity-overview";
import { OpportunityMomentumBadge } from "@/components/opportunity/opportunity-intelligence-display";
import { CompanyContactsTable } from "@/components/company-360/company-contacts-table";
import {
  DealLink,
  ProjectLink,
} from "@/components/relationship/relationship-links";
import { WorkspacePanel, HealthStatusIcon } from "@/components/ui/smartcrm-icon";

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
  deals,
  activities,
  commercialPackages,
  onViewAll,
}: {
  deals: PipelineRow[];
  activities: Activity[];
  commercialPackages: CommercialPackage[];
  onViewAll: () => void;
}) {
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
      };
    });
  }, [deals, activities, commercialPackages]);

  return (
    <WorkspacePanel
      title="Opportunities"
      id="overview-opportunities"
      count={deals.length}
      headerTrailing={<ViewAllButton label="View all →" onClick={onViewAll} />}
    >
      {rows.length === 0 ? (
        <StripEmpty>No opportunities linked to this company.</StripEmpty>
      ) : (
        <ul className="divide-y divide-carbon-blue/6">
          {rows.map(({ deal, primary, stage, momentum, value }) => (
            <li
              key={deal.id}
              className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 first:pt-0 last:pb-0 ${
                primary ? "-mx-2 bg-carbon-blue/[0.02] px-2 sm:-mx-3 sm:px-3" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <DealLink
                  dealId={deal.id}
                  showIcon={false}
                  className={`truncate hover:text-upcycle-orange ${
                    primary
                      ? "text-[14px] font-bold text-carbon-blue"
                      : "text-[13px] font-semibold text-carbon-blue"
                  }`}
                >
                  {deal.assetName}
                </DealLink>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-carbon-blue/55">
                  <span className="font-medium text-carbon-blue/70">{value}</span>
                  <span aria-hidden>·</span>
                  <span>{stage}</span>
                </p>
              </div>
              <OpportunityMomentumBadge momentum={momentum} className="shrink-0" />
            </li>
          ))}
        </ul>
      )}
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
}: {
  company: Company;
  companies: Company[];
  role: UserRole;
  activities: Activity[];
  deals: PipelineRow[];
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
        deals={deals}
        activities={activities}
        commercialPackages={commercialPackages}
        onViewAll={onOpenWork}
      />
      <ProjectsOverviewStrip projects={projects} onViewAll={onOpenWork} />
    </>
  );
}
