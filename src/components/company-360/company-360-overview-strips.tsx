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
import { DealLink } from "@/components/relationship/relationship-links";
import { WorkspacePanel, SmartCRMIcon } from "@/components/ui/smartcrm-icon";

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
  lastMailByContactId,
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
  lastMailByContactId?: Record<string, string>;
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
        lastMailByContactId={lastMailByContactId}
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
}) {
  const [createRequestId, setCreateRequestId] = useState(0);

  const rows = useMemo(() => {
    const sorted = [...deals].sort((a, b) => {
      if (b.salesValue !== a.salesValue) return b.salesValue - a.salesValue;
      return a.assetName.localeCompare(b.assetName);
    });
    return sorted.map((deal, index) => {
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
      id="opportunities"
      count={deals.length}
      headerTrailing={
        canCreate ? (
          <button
            type="button"
            onClick={() => setCreateRequestId((value) => value + 1)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-upcycle-orange transition-colors hover:text-carbon-blue"
          >
            <SmartCRMIcon name="add" size="xs" />
            Create Opportunity
          </button>
        ) : undefined
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

      {canCreate || canManageStakeholders ? (
        <CompanyOpportunitiesSection
          deals={deals}
          allPipelines={pipelines}
          commercialPackages={commercialPackages}
          company={company}
          canCreate={canCreate}
          canManageStakeholders={canManageStakeholders}
          onCreateOpportunity={onCreateOpportunity}
          onAssignStakeholder={onAssignStakeholder}
          onCompanyUpdated={onCompanyUpdated}
          createRequestId={createRequestId}
          hideTable
          showCreateTrigger={false}
        />
      ) : null}
    </WorkspacePanel>
  );
}

/**
 * Overview strips — People and one opportunity list (engine win chance).
 * Projects live beside this as the full company project table.
 */
export function Company360OverviewStrips({
  company,
  companies,
  role,
  activities,
  deals,
  pipelines,
  commercialPackages,
  allProjects,
  onCreateContact,
  onContactUpdate,
  onContactDelete,
  onContactReassign,
  onContactArchive,
  createRequestId,
  lastMailByContactId,
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
  pipelines?: PipelineRow[];
  commercialPackages: CommercialPackage[];
  allProjects: Project[];
  onCreateContact?: (input: CreateContactInput) => Promise<void>;
  onContactUpdate?: (contactId: string, patch: UpdateContactInput) => Promise<void>;
  onContactDelete?: (contactId: string) => Promise<void>;
  onContactReassign?: (contactId: string, targetCompanyId: string) => Promise<void>;
  onContactArchive?: (contactId: string, archived: boolean) => Promise<void>;
  createRequestId?: number;
  lastMailByContactId?: Record<string, string>;
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
        lastMailByContactId={lastMailByContactId}
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
      />
    </>
  );
}
