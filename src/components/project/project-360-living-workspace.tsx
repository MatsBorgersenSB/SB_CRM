"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Activity } from "@/types/activity";
import type { AttentionItem } from "@/types/attention-item";
import type { Company, SharePointPerson } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { Project } from "@/types/project";
import {
  DEFAULT_PROJECT_ACTION_TAB,
  isProjectActionTab,
  legacyProjectTabToActionTab,
  type ProjectActionTab,
} from "@/types/project-actions";
import {
  DEFAULT_PROJECT_MISSION_CONTROL_VIEW,
  isProjectMissionControlView,
  type ProjectMissionControlView,
} from "@/types/project-mission-control";
import type {
  ProjectOrganizationType,
  ProjectRelatedOrganization,
  ProjectStakeholderRecord,
} from "@/types/project-relationships";
import type {
  OpportunityUnderstandingCapture,
  UnderstandingFieldId,
} from "@/types/opportunity-understanding";
import type { UserRole } from "@/types/auth";
import type { SourceFinding } from "@/lib/source-findings";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import { buildDealBrief } from "@/lib/opportunity-deal-brief";
import {
  patchSourceFindings,
  patchUnderstandingCapture,
} from "@/lib/opportunity-understanding-model";
import { WorkspaceDocumentsPanel } from "@/components/documents/workspace-documents-panel";
import { SmartActivityWorkspace } from "@/components/activities/smart-activity-workspace";
import { ProjectActivitiesPanel } from "@/components/project/project-activities-panel";
import { ProjectDecisionsPanel } from "@/components/project/project-decisions-panel";
import { ProjectMilestonesPanel } from "@/components/project/project-milestones-panel";
import { ProjectDiscoveryQuestionsPanel } from "@/components/project/project-discovery-questions-panel";
import { ProjectMissionControl } from "@/components/project/project-mission-control";
import { ProjectRelatedOrganizationsPanel } from "@/components/project/project-related-organizations-panel";
import { ProjectStakeholderIntelligencePanel } from "@/components/project/project-stakeholder-intelligence-panel";
import { ProjectStakeholdersRosterPanel } from "@/components/project/project-stakeholders-roster-panel";
import { ProjectWorkspaceHeader } from "@/components/project/project-workspace-header";
import { WorkspaceStack } from "@/components/ui/workspace-main";
import { getActivitiesForProject } from "@/lib/activity-utils";
import {
  getProjectRelatedOrganizations,
  getProjectStakeholders,
} from "@/lib/project-relationship-utils";
import {
  buildProjectIntelligence,
  partitionProjectActivities,
} from "@/lib/project-workspace-intelligence";
import { workspaceDocumentsContextFromProject } from "@/lib/workspace-documents-data";

const LEGACY_HASH_TO_ACTION: Record<string, ProjectActionTab> = {
  questions: "questions",
  activities: "activities",
  documents: "documents",
  organizations: "organizations",
  stakeholders: "stakeholders",
  team: "stakeholders",
  milestones: "milestones",
  decisions: "decisions",
  validations: "questions",
  conversations: "questions",
  objective: "milestones",
  intelligence: "activities",
  risks: "decisions",
};

function buildProjectUrl(
  projectId: string,
  view: ProjectMissionControlView,
  actionTab: ProjectActionTab | null,
): string {
  const params = new URLSearchParams();
  if (view !== DEFAULT_PROJECT_MISSION_CONTROL_VIEW) {
    params.set("view", view);
  }
  if (view === "actions") {
    const tab = actionTab ?? DEFAULT_PROJECT_ACTION_TAB;
    params.set("action", tab);
  }
  const query = params.toString();
  return `/projects/${encodeURIComponent(projectId)}${query ? `?${query}` : ""}`;
}

export function Project360LivingWorkspace({
  project,
  companies,
  pipelines,
  activities,
  attentionItems,
  role,
  onOwnerChange,
  onStakeholdersChange,
  onOrganizationsChange,
  onCreateCompany,
  onUnderstandingChange,
  standardBioUsers,
  relationshipsReadOnly = false,
}: {
  project: Project;
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  attentionItems: AttentionItem[];
  role: UserRole;
  onOwnerChange?: (owner: SharePointPerson) => Promise<void>;
  onStakeholdersChange?: (stakeholders: ProjectStakeholderRecord[]) => Promise<void>;
  onOrganizationsChange?: (organizations: ProjectRelatedOrganization[]) => Promise<void>;
  onCreateCompany?: (
    title: string,
    organizationType: ProjectOrganizationType,
  ) => Promise<Company | null>;
  onUnderstandingChange?: (understanding: OpportunityUnderstandingCapture) => Promise<void>;
  standardBioUsers: SharePointPerson[];
  relationshipsReadOnly?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");
  const actionParam = searchParams.get("action");
  const legacyTabParam = searchParams.get("tab");
  const focusFieldParam = searchParams.get("field");

  const [documentCount, setDocumentCount] = useState(0);
  const organizations = useMemo(() => getProjectRelatedOrganizations(project), [project]);
  const stakeholders = useMemo(() => getProjectStakeholders(project), [project]);

  useEffect(() => {
    let active = true;
    fetch(`/api/projects/${encodeURIComponent(project.id)}/smartdocs`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { documents?: unknown[] } | null) => {
        if (active && Array.isArray(data?.documents)) {
          setDocumentCount(data.documents.length);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [project.id]);

  const actionTab = useMemo(() => {
    if (actionParam === "team") return "stakeholders";
    if (isProjectActionTab(actionParam)) return actionParam;
    const fromLegacy = legacyProjectTabToActionTab(legacyTabParam);
    if (fromLegacy) return fromLegacy;
    return DEFAULT_PROJECT_ACTION_TAB;
  }, [actionParam, legacyTabParam]);

  const missionView = useMemo(() => {
    if (isProjectMissionControlView(viewParam)) return viewParam;
    if (legacyTabParam && LEGACY_HASH_TO_ACTION[legacyTabParam]) {
      return "actions";
    }
    return DEFAULT_PROJECT_MISSION_CONTROL_VIEW;
  }, [viewParam, legacyTabParam]);

  const setMissionView = useCallback(
    (view: ProjectMissionControlView) => {
      const nextAction =
        view === "actions" ? actionTab ?? DEFAULT_PROJECT_ACTION_TAB : null;
      router.replace(buildProjectUrl(project.id, view, nextAction), { scroll: false });
    },
    [project.id, router, actionTab],
  );

  const setActionTab = useCallback(
    (tab: ProjectActionTab) => {
      router.replace(buildProjectUrl(project.id, "actions", tab), { scroll: false });
    },
    [project.id, router],
  );

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const mapped = LEGACY_HASH_TO_ACTION[hash];
    if (mapped) {
      router.replace(buildProjectUrl(project.id, "actions", mapped), { scroll: false });
    }
  }, [project.id, router]);

  const projectActivities = useMemo(() => {
    const scoped = getActivitiesForProject(activities, project.id, {
      linkedDealId: project.linkedDealId,
    });
    if (scoped.length > 0) return scoped;
    // Last-resort display for untagged historical rows (not used for new creates).
    return activities.filter(
      (activity) =>
        activity.Company?.Title === project.linkedCompanyId ||
        activity.Subject?.toLowerCase().includes(project.name.toLowerCase()),
    );
  }, [activities, project]);

  const activityBuckets = useMemo(
    () => partitionProjectActivities(projectActivities),
    [projectActivities],
  );

  const linkedPipeline = pipelines.find((row) => row.id === project.linkedDealId);

  const isDevelopmentProject =
    project.kind === "development" ||
    Boolean(project.understanding) ||
    linkedPipeline?.dealModel === "boo";

  const effectiveUnderstanding = useMemo(
    () => project.understanding ?? linkedPipeline?.understanding ?? { fields: {} },
    [project.understanding, linkedPipeline?.understanding],
  );

  const developmentPipeline = useMemo<PipelineRow | null>(() => {
    if (!isDevelopmentProject) return null;
    const isLateStage =
      project.stage === "Execution" ||
      project.stage === "Commissioning" ||
      project.stage === "Operational";
    return {
      id: project.id,
      assetName: project.name,
      companyRole: "Infrastructure Partner",
      targetFeedstock: linkedPipeline?.targetFeedstock ?? "",
      reactorDesignCapacity: linkedPipeline?.reactorDesignCapacity ?? 0,
      currentMilestone: project.stage ?? "Planning",
      status: "Prospecting",
      salesStageId: isLateStage ? "negotiation" : "qualification",
      salesValue: linkedPipeline?.salesValue ?? 0,
      currency: linkedPipeline?.currency ?? "EUR",
      probability: linkedPipeline?.probability ?? 25,
      offeringIds: linkedPipeline?.offeringIds ?? ["sys-complete-turnkey-pyrolysis"],
      dealModel: "boo",
      team: stakeholders.map((s) => ({
        contactId: s.contactId ?? `user-${s.userId ?? s.id}`,
        projectRole: s.role,
      })),
      understanding: effectiveUnderstanding,
    } as PipelineRow;
  }, [isDevelopmentProject, project.id, project.name, project.stage, linkedPipeline, stakeholders, effectiveUnderstanding]);

  const developmentBrief = useMemo(() => {
    if (!developmentPipeline) return null;
    return buildDealBrief({
      pipeline: developmentPipeline,
      activities: projectActivities,
      attentionItems,
    });
  }, [developmentPipeline, projectActivities, attentionItems]);

  const handleAnswerNow = useCallback(
    (fieldId: string) => {
      router.replace(
        `/projects/${encodeURIComponent(project.id)}?view=understanding&field=${encodeURIComponent(fieldId)}`,
        { scroll: false },
      );
    },
    [project.id, router],
  );

  const handleSaveUnderstandingField = useCallback(
    async (fieldId: UnderstandingFieldId, value: string) => {
      if (!onUnderstandingChange) return;
      const next = patchUnderstandingCapture(effectiveUnderstanding, fieldId, value);
      await onUnderstandingChange(next);
    },
    [onUnderstandingChange, effectiveUnderstanding],
  );

  const handleSaveFindings = useCallback(
    async (findings: SourceFinding[]) => {
      if (!onUnderstandingChange) return;
      const next = patchSourceFindings(effectiveUnderstanding, findings);
      await onUnderstandingChange(next);
    },
    [onUnderstandingChange, effectiveUnderstanding],
  );

  const handleReadDocuments = useCallback(async (): Promise<SourceFinding[]> => {
    const response = await fetch(
      `/api/projects/${encodeURIComponent(project.id)}/findings/from-documents`,
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
      throw new Error(payload?.error || "Could not read project sources");
    }
    const unread = payload?.unread ?? [];
    const proposed = Array.isArray(payload?.findings) ? payload.findings : [];
    if (proposed.length === 0 && unread.length > 0) {
      throw new Error(unread[0]?.reason || "Could not read the filed sources");
    }
    return proposed;
  }, [project.id, role]);

  const intelligence = useMemo(
    () => buildProjectIntelligence(project, projectActivities, companies, linkedPipeline),
    [project, projectActivities, companies, linkedPipeline],
  );

  const linkedCompany = companies.find((row) => row.CompanyID === project.linkedCompanyId);
  const documentsContext = workspaceDocumentsContextFromProject(project, linkedPipeline, linkedCompany);

  const actionCounts = useMemo(
    () => ({
      questions: intelligence.discovery?.suggestedQuestions.length ?? 0,
      activities: projectActivities.length,
      organizations: organizations.length,
      stakeholders: stakeholders.length,
      documents: documentCount,
      milestones: project.milestones.length,
      decisions: project.decisions.length,
    }),
    [
      intelligence.discovery?.suggestedQuestions.length,
      projectActivities.length,
      organizations.length,
      stakeholders.length,
      documentCount,
      project.milestones.length,
      project.decisions.length,
    ],
  );

  const organizationsOverview = useMemo(
    () => (
      <ProjectRelatedOrganizationsPanel
        organizations={organizations}
        companies={companies}
        readOnly={relationshipsReadOnly}
        onChange={onOrganizationsChange}
        onCreateCompany={onCreateCompany}
      />
    ),
    [organizations, companies, relationshipsReadOnly, onOrganizationsChange, onCreateCompany],
  );

  const stakeholdersOverview = useMemo(
    () => (
      <ProjectStakeholdersRosterPanel
        project={project}
        stakeholders={stakeholders}
        organizations={organizations}
        companies={companies}
        standardBioUsers={standardBioUsers}
        readOnly={relationshipsReadOnly}
        compact
        onChange={onStakeholdersChange}
      />
    ),
    [
      project,
      stakeholders,
      organizations,
      companies,
      standardBioUsers,
      relationshipsReadOnly,
      onStakeholdersChange,
    ],
  );

  const stakeholderIntelligenceOverview = useMemo(
    () =>
      intelligence.stakeholderIntelligence ? (
        <ProjectStakeholderIntelligencePanel
          intelligence={intelligence.stakeholderIntelligence}
          compact
        />
      ) : null,
    [intelligence.stakeholderIntelligence],
  );

  const actionContent = useMemo(() => {
    switch (actionTab) {
      case "questions":
        return intelligence.discovery ? (
          <ProjectDiscoveryQuestionsPanel
            projectId={project.id}
            project={project}
            questions={intelligence.discovery.discoveryQuestionItems}
            validations={intelligence.discovery.suggestedValidations}
            conversations={intelligence.discovery.recommendedConversations}
          />
        ) : null;
      case "activities":
        return (
          <div className="flex flex-col gap-4">
            <ProjectActivitiesPanel {...activityBuckets} />
            <SmartActivityWorkspace
              activities={projectActivities}
              companies={companies}
              pipelines={pipelines}
              context={{
                projectId: project.id,
                projectName: project.name,
                dealId: linkedPipeline?.id,
                companyId: project.linkedCompanyId,
                companyName: linkedCompany?.Title,
              }}
              attentionItems={attentionItems}
              variant="embedded"
            />
          </div>
        );
      case "organizations":
        return organizationsOverview;
      case "stakeholders":
        return (
          <div className="flex flex-col gap-8">
            {intelligence.stakeholderIntelligence ? (
              <ProjectStakeholderIntelligencePanel
                intelligence={intelligence.stakeholderIntelligence}
              />
            ) : null}
            <ProjectStakeholdersRosterPanel
              project={project}
              stakeholders={stakeholders}
              organizations={organizations}
              companies={companies}
              standardBioUsers={standardBioUsers}
              readOnly={relationshipsReadOnly}
              onChange={onStakeholdersChange}
            />
          </div>
        );
      case "documents":
        return (
          <WorkspaceDocumentsPanel
            context={documentsContext}
            companies={companies}
            pipelines={pipelines}
            activities={activities}
            onDocumentCountChange={setDocumentCount}
            onExtractKnowledge={
              !relationshipsReadOnly && onUnderstandingChange
                ? async () => {
                    const proposed = await handleReadDocuments();
                    if (proposed.length === 0) return;
                    const { appendSourceFinding } = await import(
                      "@/lib/source-findings"
                    );
                    let next = effectiveUnderstanding.findings ?? [];
                    for (const item of proposed) {
                      next = appendSourceFinding(next, item);
                    }
                    await handleSaveFindings(next);
                  }
                : undefined
            }
            onOpenUnderstanding={() => setMissionView("understanding")}
          />
        );
      case "milestones":
        return <ProjectMilestonesPanel milestones={project.milestones} />;
      case "decisions":
        return <ProjectDecisionsPanel decisions={project.decisions} />;
      default:
        return null;
    }
  }, [
    actionTab,
    activityBuckets,
    projectActivities,
    companies,
    pipelines,
    project,
    linkedCompany,
    attentionItems,
    organizationsOverview,
    stakeholders,
    organizations,
    standardBioUsers,
    relationshipsReadOnly,
    onStakeholdersChange,
    intelligence.discovery,
    intelligence.stakeholderIntelligence,
    linkedPipeline?.id,
    documentsContext,
    activities,
    project.milestones,
    project.decisions,
    onUnderstandingChange,
    handleReadDocuments,
    effectiveUnderstanding.findings,
    handleSaveFindings,
    setMissionView,
  ]);

  return (
    <WorkspaceStack className="gap-10 xl:gap-12">
      <ProjectWorkspaceHeader
        project={project}
        companies={companies}
        pipelines={pipelines}
        role={role}
        standardBioUsers={standardBioUsers}
        organizations={organizations}
        relationshipValidation={intelligence.stakeholderIntelligence?.relationshipValidation}
        onOwnerChange={onOwnerChange}
        onOrganizationsChange={relationshipsReadOnly ? undefined : onOrganizationsChange}
        onAddOrganization={() => {
          router.replace(buildProjectUrl(project.id, "actions", "organizations"), { scroll: false });
        }}
      />

      <ProjectMissionControl
        view={missionView}
        onViewChange={setMissionView}
        actionTab={actionTab}
        onActionTabChange={setActionTab}
        actionCounts={actionCounts}
        actionContent={actionContent}
        project={project}
        intelligence={intelligence}
        organizationsOverview={organizationsOverview}
        stakeholderIntelligenceOverview={stakeholderIntelligenceOverview}
        stakeholdersOverview={stakeholdersOverview}
        companies={companies}
        pipelines={pipelines}
        activityContext={{
          projectId: project.id,
          projectName: project.name,
          dealId: linkedPipeline?.id,
          companyId: project.linkedCompanyId,
          companyName: linkedCompany?.Title,
        }}
        role={role}
        emailsReadOnly={relationshipsReadOnly}
        developmentPipeline={developmentPipeline}
        developmentBrief={developmentBrief}
        focusFieldId={focusFieldParam}
        onAnswerNow={handleAnswerNow}
        onSaveUnderstandingField={
          !relationshipsReadOnly && onUnderstandingChange
            ? handleSaveUnderstandingField
            : undefined
        }
        onSaveFindings={
          !relationshipsReadOnly && onUnderstandingChange
            ? handleSaveFindings
            : undefined
        }
        onReadDocuments={handleReadDocuments}
      />
    </WorkspaceStack>
  );
}
