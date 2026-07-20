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
  ProjectRelatedOrganization,
  ProjectStakeholderRecord,
} from "@/types/project-relationships";
import type { UserRole } from "@/types/auth";
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
import { getActivitiesForDeal } from "@/lib/activity-utils";
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
  standardBioUsers: SharePointPerson[];
  relationshipsReadOnly?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");
  const actionParam = searchParams.get("action");
  const legacyTabParam = searchParams.get("tab");

  const [documentCount, setDocumentCount] = useState(0);
  const organizations = useMemo(() => getProjectRelatedOrganizations(project), [project]);
  const stakeholders = useMemo(() => getProjectStakeholders(project), [project]);

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
    if (project.linkedDealId) {
      return getActivitiesForDeal(activities, project.linkedDealId);
    }
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
      />
    ),
    [organizations, companies, relationshipsReadOnly, onOrganizationsChange],
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
            questions={intelligence.discovery.suggestedQuestions}
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
                dealId: project.linkedDealId,
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
    documentsContext,
    activities,
    project.milestones,
    project.decisions,
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
      />
    </WorkspaceStack>
  );
}
