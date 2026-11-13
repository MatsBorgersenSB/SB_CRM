"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Activity } from "@/types/activity";
import type { AttentionItem } from "@/types/attention-item";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { PipelineRow, PipelineTeamMember } from "@/types/pipeline";
import type { UserRole } from "@/types/auth";
import {
  DEFAULT_MISSION_CONTROL_VIEW,
  isOpportunityMissionControlView,
  mapLegacyDealLocation,
  type OpportunityMissionControlView,
} from "@/types/opportunity-mission-control";
import {
  DEFAULT_OPPORTUNITY_ACTION_TAB,
  isOpportunityActionTab,
  legacyWorkspaceTabToActionTab,
  type OpportunityActionTab,
} from "@/types/opportunity-actions";
import { WorkspaceDocumentsPanel } from "@/components/documents/workspace-documents-panel";
import { SmartActivityWorkspace } from "@/components/activities/smart-activity-workspace";
import { workspaceDocumentsContextFromOpportunity } from "@/lib/workspace-documents-data";
import { getActivitiesForDeal } from "@/lib/activity-utils";
import { findCompanyForDeal } from "@/lib/opportunity-intelligence-engine";
import { computeCommercialViability } from "@/lib/commercial-viability-engine";
import { buildOpportunityUnderstanding } from "@/lib/opportunity-workspace-intelligence";
import {
  patchDiscoveryNote,
  patchSourceFindings,
  patchUnderstandingCapture,
} from "@/lib/opportunity-understanding-model";
import { DealStakeholdersTable } from "@/components/opportunity/deal-stakeholders-table";
import { OpportunityWorkspaceHeader } from "@/components/opportunity/opportunity-workspace-header";
import { OpportunityMissionControl } from "@/components/opportunity/opportunity-mission-control";
import { WorkspaceStack } from "@/components/ui/workspace-main";
import type {
  OpportunityUnderstandingCapture,
  UnderstandingFieldId,
} from "@/types/opportunity-understanding";
import type { OpportunityDiscoveryQuestionItem } from "@/lib/opportunity-workspace-intelligence";
import type { SourceFinding } from "@/lib/source-findings";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import type { QueryPackRosterCompany } from "@/components/opportunity/query-pack-panel";

const LEGACY_HASH_TO_ACTION: Record<string, OpportunityActionTab> = {
  activities: "activities",
  "activities-full": "activities",
  documents: "documents",
};

function buildDealUrl(
  dealId: string,
  view: OpportunityMissionControlView,
  actionTab: OpportunityActionTab | null,
  fieldId?: string | null,
): string {
  const params = new URLSearchParams();
  if (view !== DEFAULT_MISSION_CONTROL_VIEW) {
    params.set("view", view);
  }
  if (view === "work" && actionTab && actionTab !== DEFAULT_OPPORTUNITY_ACTION_TAB) {
    params.set("action", actionTab);
  }
  if (fieldId && view === "understanding") {
    params.set("field", fieldId);
  }
  const query = params.toString();
  const hash =
    view === "work" && actionTab && actionTab !== "activities" ? `#${actionTab}` : "";
  return `/opportunities/${encodeURIComponent(dealId)}${query ? `?${query}` : ""}${hash}`;
}

/**
 * Opportunity Mission Control — overview answers first, execution on Work.
 */
export function Deal360LivingWorkspace({
  pipeline,
  companies,
  pipelines,
  commercialPackages,
  activities,
  attentionItems,
  dealTeam,
  role,
  onPipelinePatch,
  onOpportunityDelete,
}: {
  pipeline: PipelineRow;
  companies: Company[];
  pipelines: PipelineRow[];
  commercialPackages: CommercialPackage[];
  activities: Activity[];
  attentionItems: AttentionItem[];
  dealTeam: {
    team: PipelineTeamMember[];
    onAssign: (contactId: string, projectRole: string) => Promise<void>;
    onRemove?: (contactId: string) => Promise<void>;
    onUpdateRole?: (contactId: string, projectRole: string) => Promise<void>;
    readOnly?: boolean;
  };
  role: UserRole;
  onPipelinePatch?: (patch: Partial<PipelineRow>) => Promise<void>;
  onOpportunityDelete?: () => Promise<void>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");
  const actionParam = searchParams.get("action");
  const fieldParam = searchParams.get("field");
  const legacyTabParam = searchParams.get("tab");

  const [documentCount, setDocumentCount] = useState(0);

  // Old links (gaps, influence, meetings, emails, stakeholders) keep working.
  const legacyLocation = useMemo(
    () => mapLegacyDealLocation(viewParam, actionParam),
    [viewParam, actionParam],
  );

  const actionTab = useMemo(() => {
    if (legacyLocation?.action) return legacyLocation.action;
    if (isOpportunityActionTab(actionParam)) return actionParam;
    const fromLegacy = legacyWorkspaceTabToActionTab(legacyTabParam);
    if (fromLegacy) return fromLegacy;
    return DEFAULT_OPPORTUNITY_ACTION_TAB;
  }, [actionParam, legacyTabParam, legacyLocation]);

  const missionView = useMemo(() => {
    if (legacyLocation) return legacyLocation.view;
    if (isOpportunityMissionControlView(viewParam)) {
      return viewParam;
    }
    if (legacyTabParam === "stakeholders") return "overview";
    if (legacyTabParam === "knowledge" || legacyTabParam === "intelligence") {
      return "understanding";
    }
    if (legacyTabParam) {
      return "work";
    }
    return DEFAULT_MISSION_CONTROL_VIEW;
  }, [viewParam, legacyTabParam, legacyLocation]);

  const setMissionView = useCallback(
    (view: OpportunityMissionControlView) => {
      const nextAction =
        view === "work" ? actionTab ?? DEFAULT_OPPORTUNITY_ACTION_TAB : null;
      router.replace(buildDealUrl(pipeline.id, view, nextAction), { scroll: false });
    },
    [pipeline.id, router, actionTab],
  );

  const setActionTab = useCallback(
    (tab: OpportunityActionTab) => {
      router.replace(buildDealUrl(pipeline.id, "work", tab), { scroll: false });
    },
    [pipeline.id, router],
  );

  useEffect(() => {
    if (missionView !== "work") return;
    const id =
      actionTab === "documents" ||
      actionTab === "emails" ||
      actionTab === "meetings" ||
      actionTab === "activities"
        ? actionTab
        : null;
    if (!id) return;
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [missionView, actionTab]);

  const goAnswerField = useCallback(
    (fieldId: string) => {
      router.replace(buildDealUrl(pipeline.id, "understanding", null, fieldId), {
        scroll: false,
      });
    },
    [pipeline.id, router],
  );

  const handleSaveUnderstandingField = useCallback(
    async (fieldId: UnderstandingFieldId, value: string) => {
      if (!onPipelinePatch) return;
      const understanding = patchUnderstandingCapture(pipeline.understanding, fieldId, value);
      await onPipelinePatch({ understanding });
    },
    [onPipelinePatch, pipeline.understanding],
  );

  const handleSaveDiscoveryAnswer = useCallback(
    async (item: OpportunityDiscoveryQuestionItem, value: string) => {
      if (!onPipelinePatch) return;
      if (item.fieldId) {
        const understanding = patchUnderstandingCapture(
          pipeline.understanding,
          item.fieldId,
          value,
        );
        await onPipelinePatch({ understanding });
        return;
      }
      const understanding = patchDiscoveryNote(
        pipeline.understanding,
        item.id,
        value,
      );
      await onPipelinePatch({ understanding });
    },
    [onPipelinePatch, pipeline.understanding],
  );

  const handleSaveFindings = useCallback(
    async (findings: SourceFinding[]) => {
      if (!onPipelinePatch) return;
      const understanding = patchSourceFindings(pipeline.understanding, findings);
      await onPipelinePatch({ understanding });
    },
    [onPipelinePatch, pipeline.understanding],
  );

  const handleSaveUnderstandingCapture = useCallback(
    async (understanding: OpportunityUnderstandingCapture) => {
      if (!onPipelinePatch) return;
      await onPipelinePatch({ understanding });
    },
    [onPipelinePatch],
  );

  const handleReadDocuments = useCallback(async (): Promise<SourceFinding[]> => {
    const response = await fetch(
      `/api/deals/${encodeURIComponent(pipeline.id)}/findings/from-documents`,
      {
        method: "POST",
        headers: {
          [AUTH_ROLE_HEADER]: role,
        },
      },
    );
    const payload = (await response.json().catch(() => null)) as {
      findings?: SourceFinding[];
      unread?: Array<{ name: string; reason: string }>;
      error?: string;
    } | null;
    if (!response.ok) {
      throw new Error(payload?.error || "Could not read documents");
    }
    const unread = payload?.unread ?? [];
    const proposed = Array.isArray(payload?.findings) ? payload.findings : [];
    if (proposed.length === 0 && unread.length > 0) {
      throw new Error(unread[0]?.reason || "Could not read the filed documents");
    }
    return proposed;
  }, [pipeline.id, role]);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const mapped = LEGACY_HASH_TO_ACTION[hash];
    if (mapped) {
      router.replace(buildDealUrl(pipeline.id, "work", mapped), { scroll: false });
    }
  }, [pipeline.id, router]);

  const company = findCompanyForDeal(pipeline.id, companies);

  const rosterCompaniesForQueryPack = useMemo((): QueryPackRosterCompany[] => {
    const byId = new Map<string, QueryPackRosterCompany>();
    if (company?.CompanyID && company.Title) {
      byId.set(company.CompanyID, {
        companyId: company.CompanyID,
        companyTitle: company.Title,
      });
    }
    for (const member of dealTeam.team) {
      if (!member.companyId) continue;
      const match = companies.find((row) => row.CompanyID === member.companyId);
      if (!match?.CompanyID || !match.Title) continue;
      byId.set(match.CompanyID, {
        companyId: match.CompanyID,
        companyTitle: match.Title,
      });
    }
    for (const row of companies) {
      if (row.pipelineIds?.includes(pipeline.id) && row.CompanyID && row.Title) {
        byId.set(row.CompanyID, {
          companyId: row.CompanyID,
          companyTitle: row.Title,
        });
      }
    }
    return [...byId.values()].sort((a, b) =>
      a.companyTitle.localeCompare(b.companyTitle),
    );
  }, [company, companies, dealTeam.team, pipeline.id]);
  const documentsContext = workspaceDocumentsContextFromOpportunity(pipeline, company);

  const dealActivities = useMemo(
    () => getActivitiesForDeal(activities, pipeline.id),
    [activities, pipeline.id],
  );

  const assessment = useMemo(
    () =>
      computeCommercialViability(
        pipeline,
        companies,
        activities,
        pipelines,
        commercialPackages,
      ),
    [pipeline, companies, activities, pipelines, commercialPackages],
  );

  const understanding = useMemo(
    () =>
      buildOpportunityUnderstanding(
        pipeline,
        companies,
        assessment,
        activities,
        attentionItems,
      ),
    [pipeline, companies, assessment, activities, attentionItems],
  );

  const actionCounts = useMemo(
    () => ({
      activities: dealActivities.length,
      documents: documentCount,
      questions: understanding.suggestedQuestions.length,
      validations: understanding.suggestedValidations.length,
      conversations: understanding.recommendedConversations.length,
    }),
    [
      dealActivities.length,
      documentCount,
      understanding.suggestedQuestions.length,
      understanding.suggestedValidations.length,
      understanding.recommendedConversations.length,
    ],
  );

  const activitiesContent = useMemo(
    () => (
      <SmartActivityWorkspace
        activities={dealActivities}
        companies={companies}
        pipelines={pipelines}
        attentionItems={attentionItems}
        context={{
          companyId: company?.CompanyID,
          companyName: company?.Title,
          dealId: pipeline.id,
          dealName: pipeline.assetName,
        }}
      />
    ),
    [dealActivities, companies, pipelines, attentionItems, company, pipeline],
  );

  const documentsContent = useMemo(
    () => (
      <WorkspaceDocumentsPanel
        context={documentsContext}
        pipelines={pipelines}
        companies={companies}
        activities={activities}
        readOnly={dealTeam.readOnly}
        onDocumentCountChange={setDocumentCount}
        onExtractKnowledge={
          onPipelinePatch
            ? async () => {
                const proposed = await handleReadDocuments();
                if (proposed.length === 0) return;
                const { appendSourceFinding } = await import("@/lib/source-findings");
                let next = pipeline.understanding?.findings ?? [];
                for (const item of proposed) {
                  next = appendSourceFinding(next, item);
                }
                await handleSaveFindings(next);
              }
            : undefined
        }
        onOpenUnderstanding={() => setMissionView("understanding")}
      />
    ),
    [
      documentsContext,
      pipelines,
      companies,
      activities,
      dealTeam.readOnly,
      onPipelinePatch,
      handleReadDocuments,
      handleSaveFindings,
      pipeline.understanding?.findings,
      setMissionView,
    ],
  );

  const draftToEmail = useMemo(() => {
    const email =
      company?.contacts.find((contact) => contact.Email?.trim())?.Email?.trim() ||
      company?.Email?.trim() ||
      "";
    return email || undefined;
  }, [company]);

  const stakeholdersOverview = useMemo(
    () => (
      <DealStakeholdersTable
        team={dealTeam.team}
        companies={companies}
        dealId={pipeline.id}
        activities={activities}
        onAssign={dealTeam.onAssign}
        onRemove={dealTeam.onRemove}
        onUpdateRole={dealTeam.onUpdateRole}
        readOnly={dealTeam.readOnly}
        offeringIds={pipeline.offeringIds}
      />
    ),
    [dealTeam, companies, pipeline.id, pipeline.offeringIds, activities],
  );

  return (
    <WorkspaceStack className="gap-5 xl:gap-6">
      <OpportunityWorkspaceHeader
        pipeline={pipeline}
        companies={companies}
        commercialPackages={commercialPackages}
        activities={activities}
        pipelines={pipelines}
        role={role}
        onPipelinePatch={onPipelinePatch}
        onOpportunityDelete={onOpportunityDelete}
      />

      <OpportunityMissionControl
        view={missionView}
        onViewChange={setMissionView}
        actionTab={actionTab}
        onActionTabChange={setActionTab}
        actionCounts={actionCounts}
        activitiesContent={activitiesContent}
        documentsContent={documentsContent}
        stakeholdersOverview={stakeholdersOverview}
        pipeline={pipeline}
        companies={companies}
        pipelines={pipelines}
        commercialPackages={commercialPackages}
        assessment={assessment}
        activities={activities}
        attentionItems={attentionItems}
        focusFieldId={fieldParam}
        onAnswerNow={goAnswerField}
        onSaveUnderstandingField={
          onPipelinePatch ? handleSaveUnderstandingField : undefined
        }
        onSaveDiscoveryAnswer={
          onPipelinePatch ? handleSaveDiscoveryAnswer : undefined
        }
        onSaveFindings={onPipelinePatch ? handleSaveFindings : undefined}
        onSaveUnderstandingCapture={
          onPipelinePatch ? handleSaveUnderstandingCapture : undefined
        }
        rosterCompaniesForQueryPack={rosterCompaniesForQueryPack}
        onReadDocuments={onPipelinePatch ? handleReadDocuments : undefined}
        role={role}
        influenceReadOnly={dealTeam.readOnly}
        draftToEmail={draftToEmail}
      />
    </WorkspaceStack>
  );
}
