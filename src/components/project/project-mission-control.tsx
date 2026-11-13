"use client";

import { useMemo, useState, type ReactNode } from "react";
import { linkedWorkByPillar, resolvePillarCounterparties } from "@/lib/development-pillars";
import { evaluatePipelineFelMassEnergy } from "@/lib/fel-mass-energy-engine";
import type { Activity, ActivityWorkspaceContext } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { Project, ProjectIntelligence } from "@/types/project";
import { PROJECT_STAGE_LABELS } from "@/types/project";
import type { ProjectActionTab } from "@/types/project-actions";
import type { ProjectMissionControlView } from "@/types/project-mission-control";
import { EmailIntelligence } from "@/components/opportunities/email-intelligence";
import { OpportunityDealBriefHero } from "@/components/opportunity/opportunity-deal-brief";
import { OpportunityKnowledgeView } from "@/components/opportunity/opportunity-knowledge-view";
import { OpportunityUnderstandingCapturePanel } from "@/components/opportunity/opportunity-understanding-capture-panel";
import { AddFindingPanel } from "@/components/knowledge/add-finding-panel";
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
import type { DealBrief } from "@/lib/opportunity-deal-brief";
import {
  buildGapsFromUnderstandingModel,
  resolveAllUnderstandingFields,
} from "@/lib/opportunity-understanding-model";
import type { SourceFinding } from "@/lib/source-findings";
import type { UnderstandingFieldId } from "@/types/opportunity-understanding";
import type { UserRole } from "@/types/auth";
import type { InsightCategory } from "@/types/smartassist-intelligence";
import {
  EDITORIAL_BODY_MUTED,
  EDITORIAL_CONTENT,
  EDITORIAL_GAP_SECTION,
  EDITORIAL_INSIGHT_PROMINENT,
  EDITORIAL_INSIGHT_STANDARD,
  EDITORIAL_LABEL,
} from "@/lib/editorial-design-system";
import { QueryPackStrip } from "@/components/opportunity/query-pack-strip";
import {
  QueryPackPanel,
  type QueryPackRosterCompany,
} from "@/components/opportunity/query-pack-panel";
import type { OpportunityUnderstandingCapture } from "@/types/opportunity-understanding";

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
  companies = [],
  pipelines = [],
  activities = [],
  activityContext,
  role = "superuser",
  emailsReadOnly = false,
  developmentPipeline = null,
  developmentBrief = null,
  focusFieldId = null,
  onAnswerNow,
  onSaveUnderstandingField,
  onSaveFindings,
  onSaveUnderstandingCapture,
  rosterCompaniesForQueryPack,
  onReadDocuments,
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
  companies?: Company[];
  pipelines?: PipelineRow[];
  activities?: Activity[];
  activityContext: ActivityWorkspaceContext;
  role?: UserRole;
  emailsReadOnly?: boolean;
  developmentPipeline?: PipelineRow | null;
  developmentBrief?: DealBrief | null;
  focusFieldId?: string | null;
  onAnswerNow?: (fieldId: string) => void;
  onSaveUnderstandingField?: (fieldId: UnderstandingFieldId, value: string) => Promise<void>;
  onSaveFindings?: (findings: SourceFinding[]) => Promise<void>;
  onSaveUnderstandingCapture?: (
    understanding: OpportunityUnderstandingCapture,
  ) => Promise<void>;
  rosterCompaniesForQueryPack?: QueryPackRosterCompany[];
  onReadDocuments?: () => Promise<SourceFinding[]>;
}) {
  const [askCompaniesOpen, setAskCompaniesOpen] = useState(false);
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
  const linkedWork = useMemo(
    () => linkedWorkByPillar(project.milestones, project.decisions),
    [project.milestones, project.decisions],
  );
  const pillarCounterparties = useMemo(
    () => resolvePillarCounterparties(project, companies, activities),
    [project, companies, activities],
  );
  const felEvaluation = useMemo(
    () => (developmentPipeline ? evaluatePipelineFelMassEnergy(developmentPipeline) : null),
    [developmentPipeline],
  );
  const [scanningHero, setScanningHero] = useState(false);
  const [heroScanNotice, setHeroScanNotice] = useState<string | null>(null);

  const handleHeroScan = async () => {
    if (!onReadDocuments || !onSaveFindings || scanningHero) return;
    setScanningHero(true);
    setHeroScanNotice(null);
    try {
      const proposed = await onReadDocuments();
      if (proposed.length > 0) {
        const { appendSourceFinding } = await import("@/lib/source-findings");
        let next = developmentPipeline?.understanding?.findings ?? [];
        for (const item of proposed) {
          next = appendSourceFinding(next, item);
        }
        await onSaveFindings(next);
        setHeroScanNotice(`Extracted ${proposed.length} source & FEL radar finding(s)`);
        onViewChange("understanding");
      } else {
        setHeroScanNotice("All filed sources & FEL registries up to date");
      }
    } catch {
      setHeroScanNotice("Could not scan sources");
    } finally {
      setScanningHero(false);
    }
  };
  const developmentGaps = developmentPipeline
    ? buildGapsFromUnderstandingModel(developmentPipeline)
    : [];
  const knownDevelopmentFieldIds = developmentPipeline
    ? resolveAllUnderstandingFields(developmentPipeline)
        .filter((f) => f.source === "captured")
        .map((f) => f.definition.id)
    : [];

  return (
    <section aria-label="Project mission control" className="flex flex-col">
      <ProjectMissionControlTabBar
        active={view}
        onChange={onViewChange}
        activityContext={activityContext}
        companies={companies}
        pipelines={pipelines}
        documentCount={actionCounts?.documents}
      />

      <div className="mt-10">
        {view === "overview" ? (
          developmentBrief ? (
            <div className={`flex flex-col ${EDITORIAL_GAP_SECTION} py-1`}>
              <OpportunityDealBriefHero
                brief={developmentBrief}
                projectName={project.name}
                pillarCounterparties={pillarCounterparties}
                felEvaluation={felEvaluation}
                onAnswerNow={onAnswerNow}
                onScanFelRadar={
                  onReadDocuments && onSaveFindings ? () => void handleHeroScan() : undefined
                }
                scanningFelRadar={scanningHero}
                scanNotice={heroScanNotice}
              />
              {onSaveUnderstandingCapture ? (
                <div className="flex flex-col gap-3">
                  <QueryPackStrip
                    pack={
                      project.understanding?.queryPack ??
                      developmentPipeline?.understanding?.queryPack
                    }
                    contextLabel={project.name}
                    onOpen={() => setAskCompaniesOpen(true)}
                  />
                  {askCompaniesOpen ? (
                    <QueryPackPanel
                      scope="project"
                      scopeId={project.id}
                      understanding={
                        project.understanding ?? developmentPipeline?.understanding
                      }
                      rosterCompanies={rosterCompaniesForQueryPack ?? []}
                      onSave={onSaveUnderstandingCapture}
                      onClose={() => setAskCompaniesOpen(false)}
                      uploadScope={{ kind: "project", projectId: project.id }}
                      uploadRole={role}
                    />
                  ) : null}
                </div>
              ) : null}
              {organizationsOverview ? (
                <section className="border-t border-carbon-blue/10 pt-8">
                  <p className={`${EDITORIAL_LABEL} mb-1`}>Related organizations</p>
                  <p className={`${EDITORIAL_BODY_MUTED} mb-4 text-[13px]`}>
                    Host / energy offtaker, feedstock supplier, biochar offtake partner, regulator, and investors.
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
              {stakeholderIntelligenceOverview ? (
                <section className="border-t border-carbon-blue/10 pt-8">
                  <p className={`${EDITORIAL_LABEL} mb-1`}>Stakeholder intelligence</p>
                  <p className={`${EDITORIAL_BODY_MUTED} mb-4 text-[13px]`}>
                    SmartAssist evaluates coverage, relationship health, execution ownership, and missing roles.
                  </p>
                  {stakeholderIntelligenceOverview}
                </section>
              ) : null}
            </div>
          ) : realityFirst ? (
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

        {view === "understanding" ? (
          <div className={`${EDITORIAL_CONTENT} flex flex-col gap-10`}>
            {!realityFirst ? (
              <OpportunityKnowledgeView
                variant="gaps"
                criticalGaps={
                  developmentPipeline
                    ? [
                        ...developmentGaps,
                        ...(discovery?.knowledgeModel.criticalGaps ?? []),
                      ]
                    : (discovery?.knowledgeModel.criticalGaps ?? [])
                }
                confirmedUnderstanding={[]}
                onAnswerNow={onAnswerNow}
              />
            ) : (
              <p className={EDITORIAL_BODY_MUTED}>
                No critical discovery gaps for this operational project. Capture new issues only when
                evidence appears.
              </p>
            )}
            {developmentPipeline ? (
              <>
                <OpportunityUnderstandingCapturePanel
                  pipeline={developmentPipeline}
                  linkedWork={linkedWork}
                  pillarCounterparties={pillarCounterparties}
                  onLinkCounterparty={() => {
                    onViewChange("work");
                    onActionTabChange("organizations");
                  }}
                  focusFieldId={focusFieldId}
                  onSaveField={onSaveUnderstandingField}
                  onSaveFindings={onSaveFindings}
                  onReadDocuments={onReadDocuments}
                  documentCount={actionCounts?.documents ?? 0}
                  readOnly={!onSaveUnderstandingField}
                />
                {onSaveFindings ? (
                  <AddFindingPanel
                    targetLabel="this project"
                    findings={developmentPipeline.understanding?.findings ?? []}
                    onFindingsChange={onSaveFindings}
                    documentCount={actionCounts?.documents ?? 0}
                    onReadDocuments={onReadDocuments}
                    knownFieldIds={knownDevelopmentFieldIds}
                  />
                ) : null}
              </>
            ) : discovery ? (
              <OpportunityKnowledgeView
                variant="understanding"
                criticalGaps={[]}
                confirmedUnderstanding={discovery.knowledgeModel.confirmedUnderstanding}
              />
            ) : null}
            {intelligence.insightCatalog && !realityFirst && !developmentPipeline ? (
              <ProjectInsightCatalogPanel catalog={intelligence.insightCatalog} />
            ) : null}
            {!realityFirst && !developmentPipeline ? (
              <ProjectObjectivePanel project={project} discovery={discovery} />
            ) : project.objective.trim() && !developmentPipeline ? (
              <div>
                <p className={EDITORIAL_LABEL}>Purpose</p>
                <p className="mt-2 text-[14px] leading-relaxed text-carbon-blue">{project.objective}</p>
              </div>
            ) : null}
            <div className="border-t border-carbon-blue/10 pt-8">
              <p className={`${EDITORIAL_LABEL} mb-3`}>Risks</p>
              {project.risks.length === 0 ? (
                <p className={EDITORIAL_BODY_MUTED}>No open risks.</p>
              ) : (
                <ProjectRisksPanel risks={project.risks} />
              )}
            </div>
          </div>
        ) : null}

        {view === "work" ? (
          <div className="flex flex-col gap-8 pt-1">
            <nav
              aria-label="Work sections"
              className="flex flex-wrap gap-2 text-[12px] font-semibold text-carbon-blue/55"
            >
              {(
                [
                  ["activities", "Activities"],
                  ["emails", "Emails"],
                  ["documents", "Documents"],
                  ["organizations", "Organizations"],
                  ["stakeholders", "Stakeholders"],
                ] as const
              ).map(([id, label]) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className={
                    actionTab === id ? "text-upcycle-orange" : "hover:text-carbon-blue"
                  }
                  onClick={(event) => {
                    event.preventDefault();
                    if (id !== "emails") {
                      onActionTabChange(id);
                    }
                    document.getElementById(id)?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }}
                >
                  {label}
                </a>
              ))}
            </nav>
            <section id="emails" className="scroll-mt-24">
              <EmailIntelligence
                projectId={project.id}
                role={role}
                readOnly={emailsReadOnly}
              />
            </section>
            {actionContent}
          </div>
        ) : null}

        {view === "ask" ? (
          <p className={`${EDITORIAL_CONTENT} ${EDITORIAL_BODY_MUTED}`}>
            Ask from the global Ask SmartAssist control — project context is already in the
            workspace.
          </p>
        ) : null}
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
