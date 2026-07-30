"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Activity } from "@/types/activity";
import type { AttentionItem } from "@/types/attention-item";
import type { Company, SharePointPerson } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { Project } from "@/types/project";
import {
  DEFAULT_PROJECT_MISSION_CONTROL_VIEW,
  resolveProjectMissionControlView,
  type ProjectMissionControlView,
} from "@/types/project-mission-control";
import type {
  ProjectRelatedOrganization,
  ProjectStakeholderRecord,
} from "@/types/project-relationships";
import type { UserRole } from "@/types/auth";
import { companyRouteKey } from "@/types/company-360";
import { WorkspaceDocumentsPanel } from "@/components/documents/workspace-documents-panel";
import { SmartActivityWorkspace } from "@/components/activities/smart-activity-workspace";
import { ProjectActivitiesPanel } from "@/components/project/project-activities-panel";
import { ProjectDecisionsPanel } from "@/components/project/project-decisions-panel";
import { ProjectMilestonesPanel } from "@/components/project/project-milestones-panel";
import { ProjectMissionControl } from "@/components/project/project-mission-control";
import { ProjectRelatedOrganizationsPanel } from "@/components/project/project-related-organizations-panel";
import { ProjectStakeholderIntelligencePanel } from "@/components/project/project-stakeholder-intelligence-panel";
import { ProjectStakeholdersRosterPanel } from "@/components/project/project-stakeholders-roster-panel";
import { ProjectWorkspaceHeader } from "@/components/project/project-workspace-header";
import { ProjectCommandUrgentBanner } from "@/components/project/project-command-urgent-banner";
import { DecisionJournalPanel } from "@/components/assistant/DecisionJournalPanel";
import { ProjectStageGateView } from "@/components/execution/ProjectStageGateView";
import { WorkspaceStack } from "@/components/ui/workspace-main";
import { getActivitiesForDeal } from "@/lib/activity-utils";
import {
  getProjectRelatedOrganizations,
  getProjectStakeholders,
} from "@/lib/project-relationship-utils";
import { getProjectAccountCompanyId } from "@/lib/project-stakeholder-contacts";
import {
  buildProjectIntelligence,
  partitionProjectActivities,
} from "@/lib/project-workspace-intelligence";
import { workspaceDocumentsContextFromProject } from "@/lib/workspace-documents-data";
import {
  EDITORIAL_BODY_MUTED,
  EDITORIAL_LABEL,
} from "@/lib/editorial-design-system";

const LEGACY_HASH_TO_VIEW: Record<string, ProjectMissionControlView> = {
  questions: "command",
  activities: "docs",
  documents: "docs",
  organizations: "organizations",
  stakeholders: "organizations",
  team: "organizations",
  milestones: "stage-gates",
  decisions: "docs",
  validations: "command",
  conversations: "command",
  objective: "command",
  intelligence: "command",
  risks: "command",
};

function buildProjectUrl(projectId: string, view: ProjectMissionControlView): string {
  const params = new URLSearchParams();
  if (view !== DEFAULT_PROJECT_MISSION_CONTROL_VIEW) {
    params.set("view", view);
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
  const accountCompanyId = useMemo(() => getProjectAccountCompanyId(project), [project]);

  const missionView = useMemo(
    () => resolveProjectMissionControlView(viewParam, actionParam, legacyTabParam),
    [viewParam, actionParam, legacyTabParam],
  );

  const setMissionView = useCallback(
    (view: ProjectMissionControlView) => {
      router.replace(buildProjectUrl(project.id, view), { scroll: false });
    },
    [project.id, router],
  );

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const mapped = LEGACY_HASH_TO_VIEW[hash];
    if (mapped) {
      router.replace(buildProjectUrl(project.id, mapped), { scroll: false });
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

  const linkedCompany = companies.find((row) => row.CompanyID === accountCompanyId);
  const documentsContext = workspaceDocumentsContextFromProject(
    project,
    linkedPipeline,
    linkedCompany,
  );

  const showUrgentBanner =
    project.health === "Needs Attention" ||
    project.health === "At Risk" ||
    !accountCompanyId;

  const urgentBanner = showUrgentBanner ? (
    <ProjectCommandUrgentBanner
      project={project}
      hasAccount={Boolean(accountCompanyId)}
      onLinkAccount={() => setMissionView("organizations")}
      onReviewRisks={() => setMissionView("command")}
      onOpenStageGates={() => setMissionView("stage-gates")}
    />
  ) : null;

  const stageGatesContent = (
    <div className="flex flex-col gap-10">
      <div>
        <p className={EDITORIAL_LABEL}>Workspace milestones</p>
        <p className={`${EDITORIAL_BODY_MUTED} mb-4 mt-1 text-[13px]`}>
          Delivery checkpoints for this project workspace.
        </p>
        {project.milestones.length > 0 ? (
          <ProjectMilestonesPanel milestones={project.milestones} />
        ) : (
          <p className={EDITORIAL_BODY_MUTED}>No milestones recorded yet.</p>
        )}
      </div>

      {linkedCompany ? (
        <div>
          <p className={EDITORIAL_LABEL}>Stage-Gate execution &amp; QA</p>
          <p className={`${EDITORIAL_BODY_MUTED} mb-4 mt-1 text-[13px]`}>
            FAT/SAT quality gates, EC&amp;I traceability, and ATEX/PLC interlocks for{" "}
            {linkedCompany.Title}.
          </p>
          <ProjectStageGateView
            companyId={companyRouteKey(linkedCompany)}
            companyName={linkedCompany.Title}
            opportunityId={project.linkedDealId}
          />
        </div>
      ) : (
        <div className="border border-carbon-blue/10 bg-carbon-blue/[0.02] px-4 py-3">
          <p className="text-[14px] font-semibold text-carbon-blue">
            Link an account to unlock Stage-Gate &amp; QA
          </p>
          <p className={`mt-1 ${EDITORIAL_BODY_MUTED}`}>
            Quality inspections, EC&amp;I tags, and ATEX interlocks are scoped to the linked
            customer organization.
          </p>
          <button
            type="button"
            onClick={() => setMissionView("organizations")}
            className="mt-3 border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-xs font-semibold text-white"
          >
            Link account
          </button>
        </div>
      )}
    </div>
  );

  const organizationsContent = (
    <div className="flex flex-col gap-10">
      <div>
        <p className={EDITORIAL_LABEL}>Organizations</p>
        <p className={`${EDITORIAL_BODY_MUTED} mb-4 mt-1 text-[13px]`}>
          Customer, EPC, supplier, and other companies involved in delivery.
        </p>
        <ProjectRelatedOrganizationsPanel
          organizations={organizations}
          companies={companies}
          readOnly={relationshipsReadOnly}
          onChange={onOrganizationsChange}
        />
      </div>

      {intelligence.stakeholderIntelligence ? (
        <ProjectStakeholderIntelligencePanel
          intelligence={intelligence.stakeholderIntelligence}
        />
      ) : null}

      <div>
        <p className={EDITORIAL_LABEL}>Stakeholders</p>
        <p className={`${EDITORIAL_BODY_MUTED} mb-4 mt-1 text-[13px]`}>
          Contacts and internal delivery owners for this project.
        </p>
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
    </div>
  );

  const docsContent = (
    <div className="flex flex-col gap-10">
      <div>
        <p className={EDITORIAL_LABEL}>
          Documents{documentCount > 0 ? ` (${documentCount})` : ""}
        </p>
        <div className="mt-4">
          <WorkspaceDocumentsPanel
            context={documentsContext}
            companies={companies}
            pipelines={pipelines}
            activities={activities}
            onDocumentCountChange={setDocumentCount}
          />
        </div>
      </div>

      <div>
        <p className={EDITORIAL_LABEL}>Activity timeline</p>
        <div className="mt-4 flex flex-col gap-4">
          <ProjectActivitiesPanel {...activityBuckets} />
          <SmartActivityWorkspace
            activities={projectActivities}
            companies={companies}
            pipelines={pipelines}
            context={{
              dealId: project.linkedDealId,
              companyId: accountCompanyId,
              companyName: linkedCompany?.Title,
            }}
            attentionItems={attentionItems}
            variant="embedded"
          />
        </div>
      </div>

      <div>
        <p className={EDITORIAL_LABEL}>Project decisions</p>
        <div className="mt-4">
          {project.decisions.length > 0 ? (
            <ProjectDecisionsPanel decisions={project.decisions} />
          ) : (
            <p className={EDITORIAL_BODY_MUTED}>No project decisions recorded yet.</p>
          )}
        </div>
      </div>

      {linkedCompany ? (
        <div>
          <p className={EDITORIAL_LABEL}>Decision Journal</p>
          <p className={`${EDITORIAL_BODY_MUTED} mb-4 mt-1 text-[13px]`}>
            Organizational decisions captured for {linkedCompany.Title}.
          </p>
          <DecisionJournalPanel
            companyId={companyRouteKey(linkedCompany)}
            companyName={linkedCompany.Title}
          />
        </div>
      ) : null}
    </div>
  );

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
        onAddOrganization={() => setMissionView("organizations")}
      />

      <ProjectMissionControl
        view={missionView}
        onViewChange={setMissionView}
        project={project}
        intelligence={intelligence}
        urgentBanner={urgentBanner}
        stageGatesContent={stageGatesContent}
        organizationsContent={organizationsContent}
        docsContent={docsContent}
      />
    </WorkspaceStack>
  );
}
