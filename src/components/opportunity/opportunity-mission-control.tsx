"use client";

import { useMemo, type ReactNode } from "react";
import type { Activity } from "@/types/activity";
import type { AttentionItem } from "@/types/attention-item";
import type { CommercialViabilityAssessment } from "@/types/commercial-viability";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { OpportunityActionsTabBar } from "@/components/opportunity/opportunity-actions-tab-bar";
import { OpportunityKnowledgeView } from "@/components/opportunity/opportunity-knowledge-view";
import { OpportunityUnderstandingCapturePanel } from "@/components/opportunity/opportunity-understanding-capture-panel";
import { InfluenceMatrix } from "@/components/opportunities/influence-matrix";
import { OpportunityMissionControlTabBar } from "@/components/opportunity/opportunity-mission-control-tab-bar";
import { OpportunityQuestionBox } from "@/components/opportunity/opportunity-question-box";
import { OpportunityQuestionsWorkspace } from "@/components/opportunity/opportunity-questions-workspace";
import { OpportunityTimelineWorkspace } from "@/components/opportunity/opportunity-timeline-workspace";
import { buildOpportunityUnderstanding } from "@/lib/opportunity-workspace-intelligence";
import { buildSmartDocsIntelligence } from "@/lib/smartdocs-intelligence-data";
import type { OpportunityAskContext } from "@/lib/opportunity-smartassist-ask";
import type { CommercialPackage } from "@/types/commercial-package";
import type { OpportunityActionTab } from "@/types/opportunity-actions";
import type { OpportunityMissionControlView } from "@/types/opportunity-mission-control";
import type { UnderstandingFieldId } from "@/types/opportunity-understanding";
import type { UserRole } from "@/types/auth";
import {
  SmartAssistCategoryBadge,
  SmartAssistConfidenceLabel,
} from "@/components/smartassist/smartassist-intelligence-display";
import type { InsightCategory } from "@/types/smartassist-intelligence";
import { confidenceToCategory } from "@/lib/smartassist-intelligence-layer";
import {
  EDITORIAL_BODY_MUTED,
  EDITORIAL_CONTENT,
  EDITORIAL_EMPTY,
  EDITORIAL_GAP_LIST,
  EDITORIAL_GAP_SECTION,
  EDITORIAL_INSIGHT_PROMINENT,
  EDITORIAL_INSIGHT_STANDARD,
  EDITORIAL_LABEL,
} from "@/lib/editorial-design-system";

export function OpportunityMissionControl({
  view,
  onViewChange,
  actionTab,
  onActionTabChange,
  actionCounts,
  actionContent,
  stakeholdersOverview,
  pipeline,
  companies,
  pipelines,
  commercialPackages,
  assessment,
  activities,
  attentionItems,
  focusFieldId,
  onAnswerNow,
  onSaveUnderstandingField,
  role = "superuser",
  influenceReadOnly = false,
}: {
  view: OpportunityMissionControlView;
  onViewChange: (view: OpportunityMissionControlView) => void;
  actionTab: OpportunityActionTab;
  onActionTabChange: (tab: OpportunityActionTab) => void;
  actionCounts?: Partial<Record<OpportunityActionTab, number>>;
  actionContent: ReactNode;
  stakeholdersOverview?: ReactNode;
  pipeline: PipelineRow;
  companies: Company[];
  pipelines: PipelineRow[];
  commercialPackages: CommercialPackage[];
  assessment: CommercialViabilityAssessment;
  activities: Activity[];
  attentionItems: AttentionItem[];
  focusFieldId?: string | null;
  onAnswerNow?: (fieldId: string) => void;
  onSaveUnderstandingField?: (
    fieldId: UnderstandingFieldId,
    value: string,
  ) => Promise<void>;
  role?: UserRole;
  influenceReadOnly?: boolean;
}) {
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

  const dealDocuments = useMemo(() => {
    const smartDocs = buildSmartDocsIntelligence(pipelines, companies, activities);
    return smartDocs.allDocuments.filter(
      (doc) => doc.document.pipelineId === pipeline.id,
    );
  }, [pipelines, companies, activities, pipeline.id]);

  const askContext = useMemo<OpportunityAskContext>(
    () => ({
      pipeline,
      companies,
      understanding,
      activities,
      attentionItems,
      dealDocuments,
    }),
    [pipeline, companies, understanding, activities, attentionItems, dealDocuments],
  );

  const topGap = understanding.knowledgeModel.criticalGaps[0];

  const discoveryCounts = useMemo(
    () => ({
      questions: understanding.suggestedQuestions.length,
      validations: understanding.suggestedValidations.length,
      conversations: understanding.recommendedConversations.length,
      timeline:
        understanding.knowledgeModel.criticalGaps.length +
        activities.filter((activity) =>
          ["Open", "In Progress", "Planned", "Waiting"].includes(activity.ActionStatus),
        ).length,
      ...actionCounts,
    }),
    [understanding, activities, actionCounts],
  );

  return (
    <section aria-label="Mission control" className="flex flex-col">
      <OpportunityMissionControlTabBar active={view} onChange={onViewChange} />

      {view === "actions" ? (
        <div className="mt-4">
          <OpportunityActionsTabBar
            active={actionTab}
            onChange={onActionTabChange}
            counts={discoveryCounts}
          />
        </div>
      ) : null}

      <div className="mt-10">
        {view === "overview" ? (
          <OverviewPanel
            objective={understanding.clientObjective.statement}
            objectiveConfidence={understanding.clientObjective.confidence}
            objectiveConfidenceReason={understanding.clientObjective.confidenceReason}
            blocker={
              topGap
                ? {
                    headline: topGap.missingInformation,
                    detail: topGap.recommendedAction,
                    fieldId: topGap.fieldId,
                  }
                : null
            }
            nextAction={understanding.nextBestAction.action}
            nextActionWhy={understanding.nextBestAction.why}
            hasCriticalGaps={understanding.knowledgeModel.criticalGaps.length > 0}
            stakeholdersOverview={stakeholdersOverview}
            onAnswerNow={onAnswerNow}
          />
        ) : null}

        {view === "gaps" ? (
          <OpportunityKnowledgeView
            variant="gaps"
            criticalGaps={understanding.knowledgeModel.criticalGaps}
            confirmedUnderstanding={[]}
            onAnswerNow={onAnswerNow}
          />
        ) : null}

        {view === "understanding" ? (
          <OpportunityUnderstandingCapturePanel
            pipeline={pipeline}
            focusFieldId={focusFieldId}
            onSaveField={onSaveUnderstandingField}
            readOnly={!onSaveUnderstandingField}
          />
        ) : null}

        {view === "influence" ? (
          <InfluenceMatrix
            opportunityId={pipeline.id}
            role={role}
            readOnly={influenceReadOnly}
          />
        ) : null}

        {view === "actions" ? (
          <div className="pt-1">
            {actionTab === "questions" ? (
              <OpportunityQuestionsWorkspace
                pipeline={pipeline}
                companies={companies}
                commercialPackages={commercialPackages}
                understanding={understanding}
                questions={understanding.suggestedQuestions}
              />
            ) : null}
            {actionTab === "validations" ? (
              <ActionInsightList
                items={understanding.suggestedValidations}
                emptyLabel="No validations suggested yet."
              />
            ) : null}
            {actionTab === "conversations" ? (
              <ActionInsightList
                items={understanding.recommendedConversations}
                emptyLabel="Log a customer interaction to unlock conversation angles."
              />
            ) : null}
            {actionTab === "timeline" ? (
              <OpportunityTimelineWorkspace
                pipeline={pipeline}
                companies={companies}
                commercialPackages={commercialPackages}
                understanding={understanding}
                activities={activities.filter(
                  (activity) =>
                    activity.Deal?.Title === pipeline.id ||
                    activity.LinkedDeals?.some((deal) => deal.Title === pipeline.id),
                )}
              />
            ) : null}
            {actionTab === "activities" ||
            actionTab === "documents" ||
            actionTab === "stakeholders"
              ? actionContent
              : null}
          </div>
        ) : null}

        {view === "ask" ? (
          <div className={`${EDITORIAL_CONTENT} pt-1`}>
            <OpportunityQuestionBox context={askContext} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function OverviewPanel({
  objective,
  objectiveConfidence,
  objectiveConfidenceReason,
  blocker,
  nextAction,
  nextActionWhy,
  hasCriticalGaps,
  stakeholdersOverview,
  onAnswerNow,
}: {
  objective: string;
  objectiveConfidence: "high" | "medium" | "low";
  objectiveConfidenceReason?: string;
  blocker: { headline: string; detail: string; fieldId?: string } | null;
  nextAction: string;
  nextActionWhy: string;
  hasCriticalGaps: boolean;
  stakeholdersOverview?: ReactNode;
  onAnswerNow?: (fieldId: string) => void;
}) {
  const objectiveCategory = confidenceToCategory(objectiveConfidence);
  const objectiveLabel =
    objectiveCategory === "known" ? objective : `Working view (assumed): ${objective}`;

  return (
    <div className={`flex flex-col ${EDITORIAL_GAP_SECTION} py-1`}>
      <MissionInsight
        label="What the customer wants"
        answer={objectiveLabel}
        detail={objectiveConfidenceReason}
        category={objectiveCategory}
        confidence={objectiveConfidence}
      />
      <div className={EDITORIAL_CONTENT}>
        <p className={EDITORIAL_LABEL}>What is blocking progress</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <SmartAssistCategoryBadge category={blocker ? "missing_critical" : "known"} />
          <SmartAssistConfidenceLabel confidence={blocker ? "high" : "medium"} />
        </div>
        <p className={`mt-2.5 ${EDITORIAL_INSIGHT_STANDARD}`}>
          {blocker?.headline ?? "Nothing critical is blocking progress right now."}
        </p>
        {blocker?.detail ? (
          <p className={`mt-2.5 ${EDITORIAL_BODY_MUTED}`}>{blocker.detail}</p>
        ) : null}
        {blocker?.fieldId && onAnswerNow ? (
          <button
            type="button"
            onClick={() => onAnswerNow(blocker.fieldId!)}
            className="mt-3 inline-flex border border-upcycle-orange/30 bg-upcycle-orange/10 px-3 py-1.5 text-[11px] font-semibold text-upcycle-orange transition-colors hover:bg-upcycle-orange/15"
          >
            Answer Now
          </button>
        ) : null}
      </div>
      <MissionInsight
        label="What should happen next"
        answer={nextAction}
        detail={nextActionWhy}
        prominent
        category={hasCriticalGaps ? "missing_critical" : "assumed"}
        confidence="medium"
      />

      {stakeholdersOverview ? (
        <section className="border-t border-carbon-blue/10 pt-8">
          <p className={`${EDITORIAL_LABEL} mb-1`}>Stakeholders</p>
          <p className={`${EDITORIAL_BODY_MUTED} mb-4 text-[13px]`}>
            User-controlled. Add, edit role, or remove — SmartAssist never invents contacts.
          </p>
          {stakeholdersOverview}
        </section>
      ) : null}
    </div>
  );
}

function MissionInsight({
  label,
  answer,
  detail,
  prominent = false,
  category,
  confidence,
}: {
  label: string;
  answer: string;
  detail?: string;
  prominent?: boolean;
  category?: InsightCategory;
  confidence?: "high" | "medium" | "low";
}) {
  return (
    <div className={EDITORIAL_CONTENT}>
      <p className={EDITORIAL_LABEL}>{label}</p>
      {category && confidence ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <SmartAssistCategoryBadge category={category} />
          <SmartAssistConfidenceLabel confidence={confidence} />
        </div>
      ) : null}
      <p className={`mt-2.5 ${prominent ? EDITORIAL_INSIGHT_PROMINENT : EDITORIAL_INSIGHT_STANDARD}`}>
        {answer}
      </p>
      {detail ? <p className={`mt-2.5 ${EDITORIAL_BODY_MUTED}`}>{detail}</p> : null}
    </div>
  );
}

function ActionInsightList({
  items,
  emptyLabel,
}: {
  items: string[];
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return <p className={`${EDITORIAL_CONTENT} ${EDITORIAL_EMPTY}`}>{emptyLabel}</p>;
  }

  return (
    <ul className={`${EDITORIAL_CONTENT} ${EDITORIAL_GAP_LIST}`}>
      {items.map((item) => (
        <li key={item} className="text-[14px] leading-relaxed text-carbon-blue/75">
          {item}
        </li>
      ))}
    </ul>
  );
}
