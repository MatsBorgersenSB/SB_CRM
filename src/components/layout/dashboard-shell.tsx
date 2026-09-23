"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RoleSwitcher } from "@/components/auth/role-switcher";
import { MyAttentionPanel } from "@/components/attention/my-attention-panel";
import { PortfolioRecommendationsPanel } from "@/components/attention/portfolio-recommendations-panel";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { WorkspaceHeader } from "@/components/ui/workspace-header";
import { WorkspaceMain, WorkspaceStack } from "@/components/ui/workspace-main";
import { IntelligenceLead } from "@/components/ui/intelligence-lead";
import { WorkspacePanel } from "@/components/ui/smartcrm-icon";
import { useAuth } from "@/context/auth-context";
import { buildRelationshipCommandCenter, getWelcomeGreeting } from "@/lib/relationship-intelligence";
import { buildAttentionQueue, topAttentionHeadline } from "@/lib/smart-attention-engine";
import { groupAttentionBySeverity } from "@/types/attention-item";
import { buildDailyBriefing } from "@/lib/smartcrm-copilot-engine";
import {
  filterCompaniesForUser,
  filterPipelinesForUser,
} from "@/lib/permissions";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { CommercialPackage } from "@/types/commercial-package";
import type { PipelineRow } from "@/types/pipeline";
import type { CompanyCorrespondenceEvidence } from "@/lib/company-correspondence";
import type { SmartDocLibraryRecord } from "@/types/smartdoc-library";
import type { TenderListItem } from "@/lib/tenders/types";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { SmartAssistCopilotHost } from "@/components/smartassist/smart-assist-copilot-host";

type DashboardShellProps = {
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  commercialPackages: CommercialPackage[];
  correspondenceByCompanyId?: Record<string, CompanyCorrespondenceEvidence>;
  smartDocs?: SmartDocLibraryRecord[];
  tenders?: TenderListItem[];
};

export function DashboardShell(props: DashboardShellProps) {
  return (
    <Suspense fallback={null}>
      <DashboardShellContent {...props} />
    </Suspense>
  );
}

function DashboardShellContent({
  companies,
  pipelines,
  activities,
  commercialPackages,
  correspondenceByCompanyId,
  smartDocs,
  tenders,
}: DashboardShellProps) {
  const searchParams = useSearchParams();
  const ownerFilter = searchParams.get("owner") ?? undefined;
  const { user } = useAuth();

  const scopedCompanies = useMemo(
    () => filterCompaniesForUser(companies, user),
    [companies, user],
  );

  const scopedPipelines = useMemo(
    () => filterPipelinesForUser(pipelines, user, companies),
    [pipelines, user, companies],
  );

  const correspondenceMap = useMemo(
    () =>
      correspondenceByCompanyId
        ? new Map(Object.entries(correspondenceByCompanyId))
        : undefined,
    [correspondenceByCompanyId],
  );

  const scopedActivities = useMemo(() => {
    if (user.role !== "client_lead" || !user.companyId) return activities;

    const company = companies.find((c) => c.CompanyID === user.companyId);
    if (!company) return activities;

    const contactIds = new Set((company.contacts ?? []).map((c) => c.ContactID));
    const contactNames = new Set(
      (company.contacts ?? []).map((c) => `${c.FirstName} ${c.LastName}`.trim()),
    );

    return activities.filter((a) => {
      if (a.Company?.Title === company.Title) return true;
      if (a.Contact?.Title && contactIds.has(a.Contact.Title)) return true;
      if (a.Contact?.Title && contactNames.has(a.Contact.Title)) return true;
      if (a.Deal?.Title && company.pipelineIds.includes(a.Deal.Title)) return true;
      return false;
    });
  }, [activities, companies, user]);

  const data = useMemo(() => {
    try {
      return buildRelationshipCommandCenter(
        scopedCompanies,
        scopedPipelines,
        scopedActivities,
        { correspondence: correspondenceMap },
      );
    } catch (error) {
      console.error("[today] command center failed", error);
      return {
        kpis: {
          pipelineValue: "—",
          openFollowUps: 0,
          overdueFollowUps: 0,
          activeDeals: 0,
          totalCompanies: scopedCompanies.length,
          totalContacts: 0,
        },
        focusItems: [],
        recentActivities: [] as Activity[],
        relationshipsNeedingAttention: [],
        companySummaries: [],
        nextBestActions: [],
      };
    }
  }, [scopedActivities, scopedCompanies, scopedPipelines, correspondenceMap]);

  const dailyBriefing = useMemo(() => {
    try {
      return buildDailyBriefing(scopedCompanies, scopedPipelines, scopedActivities);
    } catch (error) {
      console.error("[today] briefing failed", error);
      return {
        headline: "What needs attention, and what should happen next.",
      };
    }
  }, [scopedActivities, scopedCompanies, scopedPipelines]);

  const attentionQueue = useMemo(() => {
    try {
      return buildAttentionQueue({
        companies: scopedCompanies,
        pipelines: scopedPipelines,
        activities: scopedActivities,
        commercialPackages,
        correspondenceByCompanyId: correspondenceMap,
        smartDocs,
        tenders,
      });
    } catch (error) {
      console.error("[today] attention queue failed", error);
      return groupAttentionBySeverity([]);
    }
  }, [
    scopedActivities,
    scopedCompanies,
    scopedPipelines,
    commercialPackages,
    correspondenceMap,
    smartDocs,
    tenders,
  ]);


  const recentActivity = data.recentActivities.slice(0, 4);

  return (
    <WorkspaceChrome>
        <WorkspaceHeader
          scope="Today"
          title={ownerFilter ? `${ownerFilter} — Attention Queue` : "My Attention"}
          context={
            ownerFilter
              ? "Filtered queue for this owner"
              : "What needs attention, why, and what to do next"
          }
          actions={
            <div className="flex items-center gap-3">
              <Link
                href="/prospecting"
                className="text-xs font-medium tracking-tight text-muted-foreground transition-colors hover:text-foreground"
              >
                Open tenders
              </Link>
              <RoleSwitcher companies={scopedCompanies} />
            </div>
          }
        />

        <WorkspaceMain>
          <WorkspaceStack>
            <IntelligenceLead
              eyebrow={getWelcomeGreeting(user.displayName)}
              title={topAttentionHeadline(attentionQueue)}
              summary={dailyBriefing.headline}
            />

            <SmartAssistCopilotHost />

            <WorkspacePanel title="Attention">
              <MyAttentionPanel queue={attentionQueue} ownerFilter={ownerFilter} />
            </WorkspacePanel>

            {recentActivity.length > 0 ? (
              <CollapsibleSection title="Recent activity" tier="expert">
                <ul className="space-y-2">
                  {recentActivity.map((activity) => (
                    <li key={activity.ActivityID}>
                      <Link
                        href={`/activities/${activity.ActivityID}`}
                        className="text-sm text-carbon-blue/70 hover:text-upcycle-orange"
                      >
                        <span className="font-medium">{activity.Subject}</span>
                        {activity.Company?.Title ? (
                          <span className="text-carbon-blue/35"> · {activity.Company.Title}</span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            ) : null}

            {data.nextBestActions.length > 0 ? (
              <CollapsibleSection title="Portfolio recommendations" tier="nice-to-have">
                <PortfolioRecommendationsPanel recommendations={data.nextBestActions} />
              </CollapsibleSection>
            ) : null}
          </WorkspaceStack>
        </WorkspaceMain>
    </WorkspaceChrome>
  );
}
