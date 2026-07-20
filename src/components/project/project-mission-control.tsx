"use client";

import type { ReactNode } from "react";
import type { Project, ProjectIntelligence } from "@/types/project";
import { PROJECT_STAGE_LABELS } from "@/types/project";
import type { ProjectActionTab } from "@/types/project-actions";
import type { ProjectMissionControlView } from "@/types/project-mission-control";
import { OpportunityKnowledgeView } from "@/components/opportunity/opportunity-knowledge-view";
import { ProjectActionsTabBar } from "@/components/project/project-actions-tab-bar";
import { ProjectInsightCatalogPanel } from "@/components/project/project-insight-catalog-panel";
import { ProjectMissionControlTabBar } from "@/components/project/project-mission-control-tab-bar";
import { ProjectObjectivePanel } from "@/components/project/project-objective-panel";
import { ProjectOpenWorkPanel } from "@/components/project/project-open-work-panel";
import { ProjectRisksPanel } from "@/components/project/project-risks-panel";
import {
  SmartAssistCategoryBadge,
  SmartAssistConfidenceLabel,
} from "@/components/smartassist/smartassist-intelligence-display";
import { projectFieldCategory } from "@/lib/project-discovery-intelligence";
import type { InsightCategory } from "@/types/smartassist-intelligence";
import {
  EDITORIAL_BODY_MUTED,
  EDITORIAL_CONTENT,
  EDITORIAL_GAP_SECTION,
  EDITORIAL_INSIGHT_PROMINENT,
  EDITORIAL_INSIGHT_STANDARD,
  EDITORIAL_LABEL,
} from "@/lib/editorial-design-system";

export function ProjectMissionControl({
  view,
  onViewChange,
  actionTab,
  onActionTabChange,
  actionCounts,
  actionContent,
  project,
  intelligence,
  organizationsOverview,
  stakeholderIntelligenceOverview,
  stakeholdersOverview,
}: {
  view: ProjectMissionControlView;
  onViewChange: (view: ProjectMissionControlView) => void;
  actionTab: ProjectActionTab;
  onActionTabChange: (tab: ProjectActionTab) => void;
  actionCounts?: Partial<Record<ProjectActionTab, number>>;
  actionContent: ReactNode;
  project: Project;
  intelligence: ProjectIntelligence;
  organizationsOverview?: ReactNode;
  stakeholderIntelligenceOverview?: ReactNode;
  stakeholdersOverview?: ReactNode;
}) {
  const discovery = intelligence.discovery;
  const discoveryReady = intelligence.discoveryReady ?? false;
  const realityFirst = intelligence.realityFirst ?? false;
  const topGap = discovery?.knowledgeModel.criticalGaps[0];
  const hasRelationshipMismatch =
    intelligence.stakeholderIntelligence?.relationshipValidation?.detected ?? false;
  const hasCriticalRisk = project.risks.some((risk) => risk.severity === "critical");
  const hasStakeholderGap = (intelligence.stakeholderIntelligence?.missingRoles.length ?? 0) > 0;
  const hasCriticalContext =
    !realityFirst &&
    (!discoveryReady || hasCriticalRisk || hasStakeholderGap || hasRelationshipMismatch || Boolean(topGap));

  const objectiveCategory: InsightCategory = discovery
    ? projectFieldCategory("objective", project, discovery) === "known"
      ? "known"
      : project.objective.trim()
        ? "assumed"
        : "unknown"
    : "assumed";

  const objectiveLabel =
    !project.objective.trim()
      ? "Not recorded — gather through discovery conversation."
      : objectiveCategory === "known"
        ? project.objective
        : `Working view (assumed): ${project.objective}`;

  const stageLabel = project.stage ? PROJECT_STAGE_LABELS[project.stage] : "Planning";

  return (
    <section aria-label="Project mission control" className="flex flex-col">
      <ProjectMissionControlTabBar active={view} onChange={onViewChange} />

      {view === "actions" ? (
        <div className="mt-4">
          <ProjectActionsTabBar
            active={actionTab}
            onChange={onActionTabChange}
            counts={actionCounts}
          />
        </div>
      ) : null}

      <div className="mt-10">
        {view === "overview" ? (
          realityFirst ? (
            <OperationalOverviewPanel
              stageLabel={stageLabel}
              purpose={project.objective.trim() || null}
              openWork={intelligence.openWork}
              organizationsOverview={organizationsOverview}
              stakeholdersOverview={stakeholdersOverview}
            />
          ) : (
            <OverviewPanel
              objective={objectiveLabel}
              objectiveCategory={objectiveCategory}
              objectiveDetail={
                discoveryReady
                  ? project.problem || undefined
                  : discovery?.discoveryLabel ??
                    "Discovery in progress — evidence required before recommendations."
              }
              blocker={intelligence.requiresAttention}
              blockerDetail={discoveryReady ? intelligence.biggestRisk : topGap?.recommendedAction}
              hasCriticalContext={hasCriticalContext}
              nextAction={intelligence.recommendedNext}
              nextActionWhy={discovery?.nextBestAction.why ?? intelligence.whatChanged}
              insightCatalogOverview={
                intelligence.insightCatalog ? (
                  <ProjectInsightCatalogPanel catalog={intelligence.insightCatalog} compact />
                ) : null
              }
              stakeholderIntelligenceOverview={stakeholderIntelligenceOverview}
              organizationsOverview={organizationsOverview}
              stakeholdersOverview={stakeholdersOverview}
            />
          )
        ) : null}

        {view === "gaps" && discovery && !realityFirst ? (
          <OpportunityKnowledgeView
            variant="gaps"
            criticalGaps={discovery.knowledgeModel.criticalGaps}
            confirmedUnderstanding={[]}
          />
        ) : null}

        {view === "gaps" && realityFirst ? (
          <p className={`${EDITORIAL_CONTENT} ${EDITORIAL_BODY_MUTED}`}>
            No critical discovery gaps for this operational project. Capture new issues only when
            evidence appears.
          </p>
        ) : null}

        {view === "understanding" ? (
          <div className={`${EDITORIAL_CONTENT} flex flex-col gap-10`}>
            {discovery ? (
              <OpportunityKnowledgeView
                variant="understanding"
                criticalGaps={[]}
                confirmedUnderstanding={discovery.knowledgeModel.confirmedUnderstanding}
              />
            ) : null}
            {intelligence.insightCatalog && !realityFirst ? (
              <ProjectInsightCatalogPanel catalog={intelligence.insightCatalog} />
            ) : null}
            {!realityFirst ? (
              <ProjectObjectivePanel project={project} discovery={discovery} />
            ) : project.objective.trim() ? (
              <div>
                <p className={EDITORIAL_LABEL}>Purpose</p>
                <p className="mt-2 text-[14px] leading-relaxed text-carbon-blue">{project.objective}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {view === "risks" ? (
          <div className={EDITORIAL_CONTENT}>
            {project.risks.length === 0 ? (
              <p className={EDITORIAL_BODY_MUTED}>No open risks.</p>
            ) : (
              <ProjectRisksPanel risks={project.risks} />
            )}
          </div>
        ) : null}

        {view === "actions" ? <div className="pt-1">{actionContent}</div> : null}
      </div>
    </section>
  );
}

function OperationalOverviewPanel({
  stageLabel,
  purpose,
  openWork,
  organizationsOverview,
  stakeholdersOverview,
}: {
  stageLabel: string;
  purpose: string | null;
  openWork?: ProjectIntelligence["openWork"];
  organizationsOverview?: ReactNode;
  stakeholdersOverview?: ReactNode;
}) {
  return (
    <div className={`flex flex-col ${EDITORIAL_GAP_SECTION} py-1`}>
      <div className={EDITORIAL_CONTENT}>
        <p className={EDITORIAL_LABEL}>Project stage</p>
        <p className={`mt-2.5 ${EDITORIAL_INSIGHT_PROMINENT}`}>{stageLabel}</p>
        {purpose ? <p className={`mt-2.5 ${EDITORIAL_BODY_MUTED}`}>{purpose}</p> : null}
      </div>

      {openWork ? (
        <section className="border-t border-carbon-blue/10 pt-8">
          <ProjectOpenWorkPanel openWork={openWork} />
        </section>
      ) : null}

      {organizationsOverview ? (
        <section className="border-t border-carbon-blue/10 pt-8">
          <p className={`${EDITORIAL_LABEL} mb-1`}>Related organizations</p>
          <p className={`${EDITORIAL_BODY_MUTED} mb-4 text-[13px]`}>
            Customer, partner, supplier, and other companies involved.
          </p>
          {organizationsOverview}
        </section>
      ) : null}

      {stakeholdersOverview ? (
        <section className="border-t border-carbon-blue/10 pt-8">
          <p className={`${EDITORIAL_LABEL} mb-1`}>Stakeholders</p>
          <p className={`${EDITORIAL_BODY_MUTED} mb-4 text-[13px]`}>
            User-controlled. Add, edit, or remove — removed stakeholders stay removed.
          </p>
          {stakeholdersOverview}
        </section>
      ) : null}
    </div>
  );
}

function OverviewPanel({
  objective,
  objectiveCategory,
  objectiveDetail,
  blocker,
  blockerDetail,
  hasCriticalContext,
  nextAction,
  nextActionWhy,
  insightCatalogOverview,
  organizationsOverview,
  stakeholderIntelligenceOverview,
  stakeholdersOverview,
}: {
  objective: string;
  objectiveCategory: InsightCategory;
  objectiveDetail?: string;
  blocker: string | null;
  blockerDetail?: string | null;
  hasCriticalContext: boolean;
  nextAction: string | null;
  nextActionWhy?: string;
  insightCatalogOverview?: ReactNode;
  organizationsOverview?: ReactNode;
  stakeholderIntelligenceOverview?: ReactNode;
  stakeholdersOverview?: ReactNode;
}) {
  return (
    <div className={`flex flex-col ${EDITORIAL_GAP_SECTION} py-1`}>
      <MissionInsight
        label="Why this project exists"
        answer={objective}
        detail={objectiveDetail}
        category={objectiveCategory}
        confidence={
          objectiveCategory === "known" ? "high" : objectiveCategory === "assumed" ? "medium" : "low"
        }
      />
      {blocker ? (
        <MissionInsight
          label="What is blocking progress"
          answer={blocker}
          detail={blockerDetail ?? undefined}
          category={hasCriticalContext ? "missing_critical" : "known"}
          confidence={hasCriticalContext ? "high" : "medium"}
        />
      ) : null}
      {nextAction ? (
        <MissionInsight
          label="What should happen next"
          answer={nextAction}
          detail={nextActionWhy}
          prominent
          category={hasCriticalContext ? "missing_critical" : "known"}
          confidence="medium"
        />
      ) : null}

      {insightCatalogOverview ? (
        <section className="border-t border-carbon-blue/10 pt-8">
          <p className={`${EDITORIAL_LABEL} mb-1`}>What SmartAssist knows</p>
          <p className={`${EDITORIAL_BODY_MUTED} mb-4 text-[13px]`}>
            Known, assumed, unknown, and missing critical information — always visible.
          </p>
          {insightCatalogOverview}
        </section>
      ) : null}

      {stakeholderIntelligenceOverview ? (
        <section className="border-t border-carbon-blue/10 pt-8">
          <p className={`${EDITORIAL_LABEL} mb-1`}>Stakeholder intelligence</p>
          <p className={`${EDITORIAL_BODY_MUTED} mb-4 text-[13px]`}>
            SmartAssist evaluates coverage, relationship health, execution ownership, and missing roles.
          </p>
          {stakeholderIntelligenceOverview}
        </section>
      ) : null}

      {organizationsOverview ? (
        <section className="border-t border-carbon-blue/10 pt-8">
          <p className={`${EDITORIAL_LABEL} mb-1`}>Related organizations</p>
          <p className={`${EDITORIAL_BODY_MUTED} mb-4 text-[13px]`}>
            Customer, partner, supplier, and other companies involved in delivery.
          </p>
          {organizationsOverview}
        </section>
      ) : null}

      {stakeholdersOverview ? (
        <section className="border-t border-carbon-blue/10 pt-8">
          <p className={`${EDITORIAL_LABEL} mb-1`}>Stakeholders</p>
          <p className={`${EDITORIAL_BODY_MUTED} mb-4 text-[13px]`}>
            Who plays which role, from which organization, and with what responsibility.
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
