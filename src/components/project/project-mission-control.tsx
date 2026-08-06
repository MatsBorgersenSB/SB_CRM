"use client";

import type { ReactNode } from "react";
import type { Project, ProjectIntelligence } from "@/types/project";
import { PROJECT_STAGE_LABELS } from "@/types/project";
import type { ProjectMissionControlView } from "@/types/project-mission-control";
import { OpportunityKnowledgeView } from "@/components/opportunity/opportunity-knowledge-view";
import { ProjectMissionControlTabBar } from "@/components/project/project-mission-control-tab-bar";
import { ProjectInsightCatalogPanel } from "@/components/project/project-insight-catalog-panel";
import { ProjectOpenWorkPanel } from "@/components/project/project-open-work-panel";
import { ProjectRisksPanel } from "@/components/project/project-risks-panel";
import { ProjectDiscoveryQuestionsPanel } from "@/components/project/project-discovery-questions-panel";
import { ProjectMilestonesPanel } from "@/components/project/project-milestones-panel";
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
import { getProjectAccountCompanyId } from "@/lib/project-stakeholder-contacts";

export function ProjectMissionControl({
  view,
  onViewChange,
  project,
  intelligence,
  urgentBanner,
  stageGatesContent,
  organizationsContent,
  docsContent,
}: {
  view: ProjectMissionControlView;
  onViewChange: (view: ProjectMissionControlView) => void;
  project: Project;
  intelligence: ProjectIntelligence;
  urgentBanner?: ReactNode;
  stageGatesContent: ReactNode;
  organizationsContent: ReactNode;
  docsContent: ReactNode;
}) {
  return (
    <section aria-label="Project mission control" className="flex flex-col">
      <ProjectMissionControlTabBar active={view} onChange={onViewChange} />

      <div className="mt-10">
        {view === "command" ? (
          <CommandCenterPanel
            project={project}
            intelligence={intelligence}
            urgentBanner={urgentBanner}
            onLinkAccount={() => onViewChange("organizations")}
          />
        ) : null}

        {view === "stage-gates" ? stageGatesContent : null}
        {view === "organizations" ? organizationsContent : null}
        {view === "docs" ? docsContent : null}
      </div>
    </section>
  );
}

function CommandCenterPanel({
  project,
  intelligence,
  urgentBanner,
  onLinkAccount,
}: {
  project: Project;
  intelligence: ProjectIntelligence;
  urgentBanner?: ReactNode;
  onLinkAccount: () => void;
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
  const accountCompanyId = getProjectAccountCompanyId(project);
  const hasAccount = Boolean(accountCompanyId);

  return (
    <div className={`flex flex-col ${EDITORIAL_GAP_SECTION} py-1`}>
      {urgentBanner}

      {/* Status overview */}
      {realityFirst ? (
        <div className={EDITORIAL_CONTENT}>
          <p className={EDITORIAL_LABEL}>Project stage</p>
          <p className={`mt-2.5 ${EDITORIAL_INSIGHT_PROMINENT}`}>{stageLabel}</p>
          {project.objective.trim() ? (
            <p className={`mt-2.5 ${EDITORIAL_BODY_MUTED}`}>{project.objective}</p>
          ) : null}
          <p className={`mt-2 text-[12px] text-carbon-blue/55`}>
            Health: {project.health} · Priority: {project.priority}
          </p>
        </div>
      ) : (
        <>
          <MissionInsight
            label="Why this project exists"
            answer={objectiveLabel}
            detail={
              discoveryReady
                ? project.problem || undefined
                : discovery?.discoveryLabel ??
                  "Discovery in progress — evidence required before recommendations."
            }
            category={objectiveCategory}
            confidence={
              objectiveCategory === "known"
                ? "high"
                : objectiveCategory === "assumed"
                  ? "medium"
                  : "low"
            }
          />
          {intelligence.requiresAttention ? (
            <MissionInsight
              label="What is blocking progress"
              answer={intelligence.requiresAttention}
              detail={
                discoveryReady
                  ? intelligence.biggestRisk ?? undefined
                  : topGap?.recommendedAction
              }
              category={hasCriticalContext ? "missing_critical" : "known"}
              confidence={hasCriticalContext ? "high" : "medium"}
            />
          ) : null}
          {intelligence.recommendedNext ? (
            <MissionInsight
              label="What should happen next"
              answer={intelligence.recommendedNext}
              detail={discovery?.nextBestAction.why ?? intelligence.whatChanged}
              prominent
              category={hasCriticalContext ? "missing_critical" : "known"}
              confidence="medium"
            />
          ) : null}
        </>
      )}

      {/* Primary account link prompt */}
      <section className="border-t border-carbon-blue/10 pt-8">
        <p className={EDITORIAL_LABEL}>Primary account</p>
        {hasAccount ? (
          <p className={`mt-2 ${EDITORIAL_BODY_MUTED}`}>
            Account linked. Manage organizations and stakeholders in the Organizations &amp;
            Stakeholders tab.
          </p>
        ) : (
          <div className="mt-3 border border-upcycle-orange/25 bg-upcycle-orange/5 px-4 py-3">
            <p className="text-[14px] font-semibold text-carbon-blue">
              No customer account linked
            </p>
            <p className={`mt-1 ${EDITORIAL_BODY_MUTED}`}>
              Link the primary customer organization so contacts, stage-gates, and decisions
              resolve against the right company.
            </p>
            <button
              type="button"
              onClick={onLinkAccount}
              className="mt-3 border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-xs font-semibold text-white hover:bg-upcycle-orange/90"
            >
              Link account
            </button>
          </div>
        )}
      </section>

      {/* Unified Risks / Actions / Questions feed */}
      <section className="border-t border-carbon-blue/10 pt-8">
        <p className={`${EDITORIAL_LABEL} mb-1`}>Risks, actions &amp; questions</p>
        <p className={`${EDITORIAL_BODY_MUTED} mb-4 text-[13px]`}>
          What deserves attention now — risks, open work, and discovery questions in one feed.
        </p>

        <div className="flex flex-col gap-8">
          {intelligence.openWork ? (
            <ProjectOpenWorkPanel openWork={intelligence.openWork} />
          ) : null}

          {project.risks.length > 0 ? (
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-carbon-blue/40">
                Open risks ({project.risks.length})
              </p>
              <ProjectRisksPanel risks={project.risks} />
            </div>
          ) : (
            <p className={EDITORIAL_BODY_MUTED}>No open risks.</p>
          )}

          {discovery && !realityFirst ? (
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-carbon-blue/40">
                Discovery questions
              </p>
              <ProjectDiscoveryQuestionsPanel
                questions={discovery.suggestedQuestions}
                validations={discovery.suggestedValidations}
                conversations={discovery.recommendedConversations}
              />
            </div>
          ) : null}

          {discovery && !realityFirst && discovery.knowledgeModel.criticalGaps.length > 0 ? (
            <OpportunityKnowledgeView
              variant="gaps"
              criticalGaps={discovery.knowledgeModel.criticalGaps}
              confirmedUnderstanding={[]}
            />
          ) : null}

          {intelligence.insightCatalog && !realityFirst ? (
            <ProjectInsightCatalogPanel catalog={intelligence.insightCatalog} compact />
          ) : null}
        </div>
      </section>

      {project.milestones.length > 0 ? (
        <section className="border-t border-carbon-blue/10 pt-8">
          <p className={`${EDITORIAL_LABEL} mb-3`}>Milestone snapshot</p>
          <ProjectMilestonesPanel milestones={project.milestones} />
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
