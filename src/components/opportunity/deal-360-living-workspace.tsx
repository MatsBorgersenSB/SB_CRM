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
import { DealVelocityCard } from "@/components/ai/deal-velocity-card";
import { workspaceDocumentsContextFromOpportunity } from "@/lib/workspace-documents-data";
import { getActivitiesForDeal } from "@/lib/activity-utils";
import { findCompanyForDeal } from "@/lib/opportunity-intelligence-engine";
import { computeCommercialViability } from "@/lib/commercial-viability-engine";
import { buildOpportunityUnderstanding } from "@/lib/opportunity-workspace-intelligence";
import { patchUnderstandingCapture } from "@/lib/opportunity-understanding-model";
import { DealStakeholdersTable } from "@/components/opportunity/deal-stakeholders-table";
import { BuyingCenterGraph } from "@/components/companies/BuyingCenterGraph";
import { ReconBattlecardPanel } from "@/components/assistant/ReconBattlecardPanel";
import { OpportunityWorkspaceHeader } from "@/components/opportunity/opportunity-workspace-header";
import { OpportunityMissionControl } from "@/components/opportunity/opportunity-mission-control";
import { WorkspaceStack } from "@/components/ui/workspace-main";
import { WorkspacePanel } from "@/components/ui/smartcrm-icon";
import type { UnderstandingFieldId } from "@/types/opportunity-understanding";
import { companyRouteKey } from "@/types/company-360";

const LEGACY_HASH_TO_ACTION: Record<string, OpportunityActionTab> = {
  activities: "activities",
  "activities-full": "activities",
  stakeholders: "stakeholders",
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
  if (view === "actions") {
    const tab = actionTab ?? DEFAULT_OPPORTUNITY_ACTION_TAB;
    params.set("action", tab);
  }
  if (fieldId && (view === "understanding" || view === "gaps")) {
    params.set("field", fieldId);
    if (view === "gaps") {
      // Answer Now always lands on the capture surface
      params.set("view", "understanding");
    }
  }
  const query = params.toString();
  return `/deals/${encodeURIComponent(dealId)}${query ? `?${query}` : ""}`;
}

/**
 * Opportunity Mission Control — overview answers first, execution in Actions.
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
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");
  const actionParam = searchParams.get("action");
  const fieldParam = searchParams.get("field");
  const legacyTabParam = searchParams.get("tab");

  const [documentCount, setDocumentCount] = useState(0);

  const actionTab = useMemo(() => {
    if (isOpportunityActionTab(actionParam)) return actionParam;
    const fromLegacy = legacyWorkspaceTabToActionTab(legacyTabParam);
    if (fromLegacy) return fromLegacy;
    return DEFAULT_OPPORTUNITY_ACTION_TAB;
  }, [actionParam, legacyTabParam]);

  const missionView = useMemo(() => {
    if (isOpportunityMissionControlView(viewParam)) {
      return viewParam;
    }
    if (legacyTabParam === "knowledge" || legacyTabParam === "intelligence") {
      return "understanding";
    }
    if (legacyTabParam) {
      return "actions";
    }
    return DEFAULT_MISSION_CONTROL_VIEW;
  }, [viewParam, legacyTabParam]);

  const setMissionView = useCallback(
    (view: OpportunityMissionControlView) => {
      const nextAction =
        view === "actions" ? actionTab ?? DEFAULT_OPPORTUNITY_ACTION_TAB : null;
      router.replace(buildDealUrl(pipeline.id, view, nextAction), { scroll: false });
    },
    [pipeline.id, router, actionTab],
  );

  const setActionTab = useCallback(
    (tab: OpportunityActionTab) => {
      router.replace(buildDealUrl(pipeline.id, "actions", tab), { scroll: false });
    },
    [pipeline.id, router],
  );

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

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const mapped = LEGACY_HASH_TO_ACTION[hash];
    if (mapped) {
      router.replace(buildDealUrl(pipeline.id, "actions", mapped), { scroll: false });
    }
  }, [pipeline.id, router]);

  const company = findCompanyForDeal(pipeline.id, companies);
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
      stakeholders: dealTeam.team.length,
      documents: documentCount,
      questions: understanding.suggestedQuestions.length,
      validations: understanding.suggestedValidations.length,
      conversations: understanding.recommendedConversations.length,
    }),
    [
      dealActivities.length,
      dealTeam.team.length,
      documentCount,
      understanding.suggestedQuestions.length,
      understanding.suggestedValidations.length,
      understanding.recommendedConversations.length,
    ],
  );

  const actionContent = useMemo(() => {
    switch (actionTab) {
      case "activities":
        return (
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
        );
      case "stakeholders":
        return (
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
        );
      case "documents":
        return (
          <WorkspaceDocumentsPanel
            context={documentsContext}
            pipelines={pipelines}
            companies={companies}
            activities={activities}
            readOnly={dealTeam.readOnly}
            onDocumentCountChange={setDocumentCount}
          />
        );
      default:
        return null;
    }
  }, [
    actionTab,
    dealActivities,
    companies,
    pipelines,
    attentionItems,
    company,
    pipeline,
    dealTeam,
    activities,
    documentsContext,
  ]);

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
        compact
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
        role={role}
        onPipelinePatch={onPipelinePatch}
      />

      <DealVelocityCard dealId={pipeline.id} />

      {company ? (
        <WorkspacePanel title="Buying Center" id="buying-center" collapsible>
          <BuyingCenterGraph
            companyId={companyRouteKey(company)}
            companyName={company.Title}
          />
        </WorkspacePanel>
      ) : null}

      {company ? (
        <WorkspacePanel title="Executive Recon" id="web-recon" collapsible>
          <ReconBattlecardPanel
            companyId={companyRouteKey(company)}
            companyName={company.Title}
            domain={company.Domain || undefined}
          />
        </WorkspacePanel>
      ) : null}

      <OpportunityMissionControl
        view={missionView}
        onViewChange={setMissionView}
        actionTab={actionTab}
        onActionTabChange={setActionTab}
        actionCounts={actionCounts}
        actionContent={actionContent}
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
        role={role}
        influenceReadOnly={dealTeam.readOnly}
      />
    </WorkspaceStack>
  );
}
