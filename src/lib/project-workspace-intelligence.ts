import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { Project, ProjectIntelligence, ProjectOpenWork } from "@/types/project";
import { isPostDeliveryStage } from "@/types/project";
import { buildProjectUnderstanding } from "@/lib/project-discovery-intelligence";
import { getProjectRelatedOrganizations } from "@/lib/project-relationship-utils";
import { buildProjectStakeholderIntelligence } from "@/lib/project-stakeholder-intelligence";
import { buildProjectInsightCatalog } from "@/lib/smartassist-intelligence-layer";
import { isFollowUpOpen, isFollowUpOverdue } from "@/lib/activity-utils";

/** Pure project intelligence — safe for client and server bundles. */

export function partitionProjectActivities(activities: Activity[]): {
  open: Activity[];
  blocked: Activity[];
  waiting: Activity[];
  completed: Activity[];
} {
  const open: Activity[] = [];
  const blocked: Activity[] = [];
  const waiting: Activity[] = [];
  const completed: Activity[] = [];

  for (const activity of activities) {
    if (activity.ActionStatus === "Completed" || activity.ActionStatus === "Cancelled") {
      completed.push(activity);
      continue;
    }
    if (activity.ActionStatus === "Waiting") {
      waiting.push(activity);
      continue;
    }
    if (activity.ActionStatus === "In Progress" || isFollowUpOverdue(activity)) {
      blocked.push(activity);
      continue;
    }
    open.push(activity);
  }

  return { open, blocked, waiting, completed };
}

function buildOpenWork(project: Project, activities: Activity[]): ProjectOpenWork {
  const buckets = partitionProjectActivities(activities);
  const openActivities = [...buckets.open, ...buckets.waiting].map((activity) => ({
    id: String(activity.id),
    subject: activity.Subject?.trim() || "Untitled activity",
    status: activity.ActionStatus,
  }));
  const blockedActivities = buckets.blocked.map((activity) => ({
    id: String(activity.id),
    subject: activity.Subject?.trim() || "Untitled activity",
    status: activity.ActionStatus,
  }));
  const openRisks = project.risks
    .filter((risk) => risk.severity === "critical" || risk.severity === "warning")
    .map((risk) => ({
      id: risk.id,
      risk: risk.risk,
      severity: risk.severity,
    }));
  const openIssues = project.milestones
    .filter((milestone) => milestone.status === "Blocked")
    .map((milestone) => ({
      id: `ms-${milestone.id}`,
      label: milestone.title,
      detail: `Blocked milestone — owner: ${milestone.owner}`,
    }));

  return { openActivities, blockedActivities, openRisks, openIssues };
}

export function buildProjectIntelligence(
  project: Project,
  activities: Activity[],
  companies: Company[] = [],
  linkedDeal?: PipelineRow,
): ProjectIntelligence {
  const realityFirst = isPostDeliveryStage(project.stage);
  const discovery = buildProjectUnderstanding(project, companies, activities, linkedDeal);
  const stakeholderIntelligence = buildProjectStakeholderIntelligence(project, companies, activities);
  const insightCatalog = buildProjectInsightCatalog(
    discovery,
    stakeholderIntelligence,
    project,
  );
  const openWork = buildOpenWork(project, activities);

  const blockedMilestones = project.milestones.filter((m) => m.status === "Blocked");
  const inProgressMilestones = project.milestones.filter((m) => m.status === "In Progress");
  const criticalRisks = project.risks.filter((r) => r.severity === "critical");
  const openFollowUps = activities.filter(isFollowUpOpen);
  const overdueActivities = activities.filter(isFollowUpOverdue);
  const topGap = realityFirst ? undefined : discovery.knowledgeModel.criticalGaps[0];
  const topStakeholderGap = realityFirst
    ? undefined
    : stakeholderIntelligence.missingRoles[0];
  const relationshipMismatch = stakeholderIntelligence.relationshipValidation;

  const healthLabel = project.health;
  const stageLabel = project.stage ?? "Planning";

  if (realityFirst) {
    const hasOpenWork =
      openWork.openActivities.length > 0 ||
      openWork.blockedActivities.length > 0 ||
      openWork.openRisks.length > 0 ||
      openWork.openIssues.length > 0;

    const known = insightCatalog.known.filter((item) =>
      [
        "account",
        "opportunity",
        "stakeholders",
        "engagement",
        "decisions",
        "milestones",
        "discovery-ready",
        "field-objective",
      ].includes(item.id) || item.id.startsWith("resp-"),
    );

    return {
      healthLabel,
      summary: `${project.name} — ${stageLabel.toLowerCase()}. Customer follow-up and relationship management.`,
      whatChanged: hasOpenWork
        ? "Open work items require attention."
        : "No open issues. No open risks.",
      requiresAttention: hasOpenWork
        ? openWork.openRisks[0]?.risk ??
          openWork.openIssues[0]?.label ??
          (overdueActivities.length > 0
            ? `${overdueActivities.length} overdue follow-up${overdueActivities.length === 1 ? "" : "s"}.`
            : openWork.openActivities[0]?.subject ?? null)
        : null,
      recommendedNext: null,
      biggestRisk: openWork.openRisks[0]?.risk ?? null,
      biggestOpportunity: null,
      confidence: "high",
      stakeholderIntelligence: {
        ...stakeholderIntelligence,
        missingRoles: [],
      },
      discovery: {
        ...discovery,
        knowledgeModel: {
          ...discovery.knowledgeModel,
          criticalGaps: [],
        },
        assessment: {
          ...discovery.assessment,
          gapsInUnderstanding: [],
          workingAssumptions: [],
        },
      },
      insightCatalog: {
        known,
        assumed: [],
        unknown: [],
        missingCritical: [],
        all: known,
      },
      discoveryReady: true,
      openWork,
      realityFirst: true,
    };
  }

  if (!discovery.discoveryReady) {
    return {
      healthLabel,
      summary: `${project.name} — discovery in progress (${discovery.discoveryScore}/100). SmartAssist is gathering evidence before generating recommendations.`,
      whatChanged: discovery.discoveryLabel,
      requiresAttention:
        topGap?.missingInformation ??
        relationshipMismatch?.message ??
        "Project discovery in progress — critical context is still missing.",
      recommendedNext: discovery.nextBestAction.action,
      biggestRisk: null,
      biggestOpportunity: null,
      confidence: "low",
      stakeholderIntelligence,
      discovery,
      insightCatalog,
      discoveryReady: false,
      openWork,
      realityFirst: false,
    };
  }

  const whatChanged =
    inProgressMilestones.length > 0
      ? `${inProgressMilestones[0]!.title} is in progress — ${inProgressMilestones.length} active milestone${inProgressMilestones.length === 1 ? "" : "s"}.`
      : blockedMilestones.length > 0
        ? `${blockedMilestones.length} milestone${blockedMilestones.length === 1 ? "" : "s"} blocked.`
        : "No milestone status changes since last review.";

  const requiresAttention =
    relationshipMismatch?.detected
      ? relationshipMismatch.message
      : topGap?.priority === "high"
        ? topGap.missingInformation
        : criticalRisks.length > 0
          ? criticalRisks[0]!.risk
          : topStakeholderGap?.severity === "critical"
            ? topStakeholderGap.label
            : overdueActivities.length > 0
              ? `${overdueActivities.length} overdue follow-up${overdueActivities.length === 1 ? "" : "s"} on linked activities.`
              : topStakeholderGap
                ? topStakeholderGap.label
                : openFollowUps.length > 0
                  ? `${openFollowUps.length} open commitment${openFollowUps.length === 1 ? "" : "s"} need ownership.`
                  : null;

  const recommendedNext =
    relationshipMismatch?.detected
      ? relationshipMismatch.recommendedAction
      : discovery.nextBestAction.action;

  const biggestRisk =
    criticalRisks[0]?.risk ?? project.risks[0]?.risk ?? topGap?.missingInformation ?? null;

  const nextPlanned = project.milestones.find((m) => m.status === "Planned");
  const primaryCustomer = getProjectRelatedOrganizations(project).find(
    (org) => org.organizationType === "customer" || org.isPrimary,
  );
  const customerCompany =
    companies.find((company) => company.CompanyID === primaryCustomer?.companyId)?.Title ??
    "the customer";
  const biggestOpportunity =
    project.kind === "customer" && nextPlanned
      ? `Successful ${nextPlanned.title.toLowerCase()} unlocks reference-case credibility with ${customerCompany}.`
      : project.kind === "strategic"
        ? "Platform adoption across commercial and delivery teams reduces manual CRM configuration."
        : nextPlanned
          ? `Completing ${nextPlanned.title} advances the defined outcome.`
          : null;

  const objectiveSnippet = project.objective.trim()
    ? project.objective
    : "Objective pending validation";

  const summary = `${project.name} — ${project.status.toLowerCase()}, ${project.health.toLowerCase()} health. ${objectiveSnippet}`;

  return {
    healthLabel,
    summary,
    whatChanged,
    requiresAttention,
    recommendedNext,
    biggestRisk,
    biggestOpportunity,
    confidence: criticalRisks.length > 0 ? "high" : project.health === "At Risk" ? "medium" : "high",
    stakeholderIntelligence,
    discovery,
    insightCatalog,
    discoveryReady: true,
    openWork,
    realityFirst: false,
  };
}
