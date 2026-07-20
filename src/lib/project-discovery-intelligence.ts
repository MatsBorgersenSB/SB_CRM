/**
 * Phase 2.2 — Project Discovery Principle
 *
 * SmartAssist builds project understanding through conversation and evidence,
 * not assumptions. Objectives, risks, blockers, and recommendations are gated
 * until discovery is sufficient.
 */

import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { Project } from "@/types/project";
import { isPostDeliveryStage } from "@/types/project";
import { isFollowUpOpen, isFollowUpOverdue } from "@/lib/activity-utils";
import { detectProjectRelationshipMismatch } from "@/lib/project-relationship-validation";
import {
  getProjectRelatedOrganizations,
  getProjectStakeholders,
} from "@/lib/project-relationship-utils";
import { buildProjectStakeholderIntelligence } from "@/lib/project-stakeholder-intelligence";
import {
  SMARTASSIST_PROJECT_QUALIFICATION,
  SMARTASSIST_REGULATORY_LEVELS,
} from "@/lib/smart-assist-config";
import type {
  CriticalKnowledgeGap,
  ConfirmedUnderstandingRow,
  NextBestAction,
} from "@/lib/opportunity-workspace-intelligence";

export type ProjectDiscoveryAssessment = {
  wellUnderstood: string[];
  gapsInUnderstanding: string[];
  workingAssumptions: string[];
};

export type ProjectKnowledgeModel = {
  criticalGaps: CriticalKnowledgeGap[];
  confirmedUnderstanding: ConfirmedUnderstandingRow[];
};

export type ProjectUnderstanding = {
  discoveryReady: boolean;
  discoveryScore: number;
  discoveryLabel: string;
  knowledgeModel: ProjectKnowledgeModel;
  suggestedQuestions: string[];
  suggestedValidations: string[];
  recommendedConversations: string[];
  nextBestAction: NextBestAction;
  assessment: ProjectDiscoveryAssessment;
};

type GapTemplate = {
  missingInformation: string;
  whyItMatters: string;
  recommendedAction: string;
  priority: CriticalKnowledgeGap["priority"];
};

const PROJECT_GAP_TEMPLATES: Record<string, GapTemplate> = {
  account: {
    missingInformation: "Connected account not established",
    whyItMatters: "Without a linked account, delivery context and stakeholder ownership stay unclear.",
    recommendedAction: "Link the customer or partner organization this project serves",
    priority: "high",
  },
  objective: {
    missingInformation: "Project objective not recorded",
    whyItMatters: "The team cannot align on outcomes without a stated objective from discovery.",
    recommendedAction: "Capture why this project exists — ask the sponsor directly",
    priority: "high",
  },
  "success-criteria": {
    missingInformation: "Success criteria not defined",
    whyItMatters: "Completion and handover cannot be judged without explicit success measures.",
    recommendedAction: "Ask what done looks like and record success criteria on the project",
    priority: "high",
  },
  stakeholders: {
    missingInformation: "Stakeholder map incomplete",
    whyItMatters: "Projects are executed by organizations and people — roles must be named.",
    recommendedAction: "Add stakeholders with roles across customer, delivery, and approval paths",
    priority: "high",
  },
  engagement: {
    missingInformation: "No customer dialogue logged",
    whyItMatters: "Understanding must come from conversation and evidence, not assumptions.",
    recommendedAction: "Log a discovery conversation or site visit on linked activities",
    priority: "high",
  },
  "decision-maker": {
    missingInformation: "Decision maker not identified",
    whyItMatters: "Trade-offs and approvals stall without a named decision owner.",
    recommendedAction: "Identify who holds budget and sign-off authority on the customer side",
    priority: "high",
  },
  permitting: {
    missingInformation: "Permitting pathway unclear",
    whyItMatters: "Regulatory gates are a common source of project delay and blocked commissioning.",
    recommendedAction: "Ask which permits apply and who owns regulatory engagement",
    priority: "medium",
  },
  "relationship-mismatch": {
    missingInformation: "Project name and connected account may not align",
    whyItMatters: "A mismatched account link can misroute stakeholder intelligence and reporting.",
    recommendedAction: "Verify the connected account matches the delivery context",
    priority: "medium",
  },
  milestones: {
    missingInformation: "Delivery milestones not defined",
    whyItMatters: "Progress cannot be tracked without a milestone plan agreed with delivery leads.",
    recommendedAction: "Define the next 2–3 milestones with owners and target dates",
    priority: "medium",
  },
};

const PROJECT_QUESTION_MAP: Record<string, string> = {
  account: "Which organization is the primary customer or partner for this project?",
  objective: "Why does this project exist — what outcome is the customer pursuing?",
  "success-criteria": "What does success look like when this project is complete?",
  stakeholders: "Who owns delivery, approval, and customer coordination on this project?",
  engagement: "When did we last speak with the customer about this project?",
  "decision-maker": "Who is the decision maker with budget authority?",
  permitting: "What permits or regulatory approvals are required?",
  "relationship-mismatch": "Is the connected account correct for this project scope?",
  milestones: "What are the next delivery milestones and who owns them?",
};

function hasEvidenceActivities(activities: Activity[]): boolean {
  return activities.some(
    (activity) =>
      activity.ActionStatus !== "Cancelled" &&
      (activity.Summary?.trim() || activity.Subject?.trim()),
  );
}

function buildConfirmedUnderstanding(
  project: Project,
  companies: Company[],
  activities: Activity[],
  linkedDeal?: PipelineRow,
): ConfirmedUnderstandingRow[] {
  const rows: ConfirmedUnderstandingRow[] = [];

  if (project.objective.trim()) {
    rows.push({
      id: "objective",
      topic: "Project objective",
      answer: project.objective.trim(),
    });
  }

  if (project.problem.trim()) {
    rows.push({
      id: "problem",
      topic: "Problem statement",
      answer: project.problem.trim(),
    });
  }

  if (project.successCriteria.trim()) {
    rows.push({
      id: "success",
      topic: "Success criteria",
      answer: project.successCriteria.trim(),
    });
  }

  const primaryOrg = getProjectRelatedOrganizations(project).find(
    (org) => org.isPrimary || org.organizationType === "customer",
  );
  if (primaryOrg) {
    const company = companies.find((entry) => entry.CompanyID === primaryOrg.companyId);
    rows.push({
      id: "account",
      topic: "Connected account",
      answer: `${company?.Title ?? primaryOrg.companyId} is linked as the primary organization (${primaryOrg.organizationType}).`,
    });
  }

  if (linkedDeal) {
    rows.push({
      id: "opportunity",
      topic: "Linked opportunity",
      answer: `Project is linked to opportunity ${linkedDeal.assetName} (${linkedDeal.status}).`,
    });
  }

  const stakeholders = getProjectStakeholders(project);
  if (stakeholders.length > 0) {
    const named = stakeholders
      .slice(0, 4)
      .map((entry) => `${entry.name} (${entry.role})`)
      .join("; ");
    rows.push({
      id: "stakeholders",
      topic: "Stakeholder roster",
      answer: `${stakeholders.length} stakeholder${stakeholders.length === 1 ? "" : "s"} recorded: ${named}${stakeholders.length > 4 ? "; …" : ""}.`,
    });
  }

  const withResponsibilities = stakeholders.filter((entry) => entry.responsibilities?.trim());
  for (const entry of withResponsibilities.slice(0, 3)) {
    rows.push({
      id: `resp-${entry.id}`,
      topic: `${entry.role} responsibility`,
      answer: `${entry.name}: ${entry.responsibilities!.trim()}`,
    });
  }

  if (project.milestones.length > 0) {
    const active = project.milestones.filter((m) => m.status !== "Complete");
    rows.push({
      id: "milestones",
      topic: "Delivery milestones",
      answer: `${project.milestones.length} milestone${project.milestones.length === 1 ? "" : "s"} defined${active.length ? ` — ${active.length} still open` : ""}.`,
    });
  }

  if (project.decisions.length > 0) {
    rows.push({
      id: "decisions",
      topic: "Recorded decisions",
      answer: `${project.decisions.length} decision${project.decisions.length === 1 ? "" : "s"} logged on this project.`,
    });
  }

  if (hasEvidenceActivities(activities)) {
    const latest = [...activities].sort(
      (a, b) => new Date(b.ActivityDate).getTime() - new Date(a.ActivityDate).getTime(),
    )[0];
    const context = latest?.Summary?.trim() || latest?.Subject?.trim();
    if (context) {
      rows.push({
        id: "engagement",
        topic: "Recent dialogue",
        answer: `Latest logged interaction: ${context}`,
      });
    }
  }

  return rows.slice(0, 12);
}

function buildCriticalKnowledgeGaps(
  project: Project,
  companies: Company[],
  activities: Activity[],
  stakeholderGaps: ReturnType<typeof buildProjectStakeholderIntelligence>["missingRoles"],
): CriticalKnowledgeGap[] {
  if (isPostDeliveryStage(project.stage)) {
    return [];
  }

  const gapIds: string[] = [];
  const organizations = getProjectRelatedOrganizations(project);
  const stakeholders = getProjectStakeholders(project);

  if (!project.linkedCompanyId && organizations.length === 0) {
    gapIds.push("account");
  }

  if (!project.objective.trim()) {
    gapIds.push("objective");
  }

  if (!project.successCriteria.trim()) {
    gapIds.push("success-criteria");
  }

  if (stakeholders.length < 2) {
    gapIds.push("stakeholders");
  }

  if (!hasEvidenceActivities(activities)) {
    gapIds.push("engagement");
  }

  if (stakeholderGaps.some((gap) => gap.id === "decision_maker")) {
    gapIds.push("decision-maker");
  }

  if (
    project.risks.some((risk) => /permit/i.test(risk.risk)) ||
    organizations.some((org) => org.organizationType === "regulator")
  ) {
    gapIds.push("permitting");
  }

  const mismatch = detectProjectRelationshipMismatch(project, companies);
  if (mismatch?.detected) {
    gapIds.push("relationship-mismatch");
  }

  if (project.milestones.length === 0 && project.status === "Active") {
    gapIds.push("milestones");
  }

  const priorityRank = { high: 0, medium: 1, low: 2 };

  return [...new Set(gapIds)]
    .map((id) => {
      const template = PROJECT_GAP_TEMPLATES[id];
      if (!template) return null;
      return { id, ...template };
    })
    .filter((gap): gap is CriticalKnowledgeGap => gap !== null)
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])
    .slice(0, 8);
}

function computeDiscoveryScore(
  confirmed: ConfirmedUnderstandingRow[],
  gaps: CriticalKnowledgeGap[],
): number {
  const base = Math.min(100, confirmed.length * 10);
  const penalty =
    gaps.filter((gap) => gap.priority === "high").length * 15 +
    gaps.filter((gap) => gap.priority === "medium").length * 6;
  return Math.max(0, Math.min(100, base - penalty));
}

function discoveryLabel(score: number, ready: boolean): string {
  if (ready) return "Sufficient understanding for recommendations";
  if (score >= 45) return "Discovery in progress — gaps remain";
  return "Early discovery — gather evidence before acting";
}

function isDiscoveryReady(
  confirmed: ConfirmedUnderstandingRow[],
  gaps: CriticalKnowledgeGap[],
): boolean {
  const blockingIds = new Set(["account", "objective", "engagement", "stakeholders"]);
  const blockingGaps = gaps.filter(
    (gap) => gap.priority === "high" && blockingIds.has(gap.id),
  );
  const hasObjectiveEvidence = confirmed.some((row) =>
    ["objective", "engagement", "decisions"].includes(row.id),
  );
  return confirmed.length >= 4 && blockingGaps.length === 0 && hasObjectiveEvidence;
}

function buildSuggestedQuestions(gaps: CriticalKnowledgeGap[]): string[] {
  const fromGaps = gaps
    .map((gap) => PROJECT_QUESTION_MAP[gap.id])
    .filter(Boolean) as string[];

  const defaults = [...SMARTASSIST_REGULATORY_LEVELS.projectQuestions];

  return [...new Set([...fromGaps, ...defaults])].slice(0, 8);
}

function buildSuggestedValidations(
  gaps: CriticalKnowledgeGap[],
  project: Project,
): string[] {
  const validations = gaps.map((gap) => gap.recommendedAction);

  if (project.linkedDealId) {
    validations.push("Cross-check project scope against the linked opportunity record");
  }

  validations.push(
    `Validate ${SMARTASSIST_PROJECT_QUALIFICATION.evaluates[0].toLowerCase()} with the customer`,
  );

  return [...new Set(validations)].slice(0, 6);
}

function buildRecommendedConversations(
  project: Project,
  gaps: CriticalKnowledgeGap[],
): string[] {
  const conversations: string[] = [];

  if (gaps.some((gap) => gap.id === "stakeholders" || gap.id === "decision-maker")) {
    conversations.push("Discovery call with customer sponsor and technical lead");
  }
  if (gaps.some((gap) => gap.id === "permitting")) {
    conversations.push("Regulatory and permitting review with customer EHS or legal contact");
  }
  if (gaps.some((gap) => gap.id === "milestones")) {
    conversations.push("Delivery planning session with project manager and customer coordinator");
  }
  if (project.kind === "customer") {
    conversations.push("Site or operational walkthrough to confirm delivery assumptions");
  }

  return conversations.slice(0, 5);
}

function buildNextBestAction(
  discoveryReady: boolean,
  gaps: CriticalKnowledgeGap[],
  questions: string[],
  activities: Activity[],
): NextBestAction {
  if (!discoveryReady) {
    const topGap = gaps[0];
    return {
      action: topGap?.recommendedAction ?? questions[0] ?? "Begin project discovery conversation",
      why: "SmartAssist will not recommend operational actions until understanding is evidence-based.",
      expectedImpact: "Establishes a factual foundation before objectives, risks, and next steps are generated.",
    };
  }

  const overdue = activities.filter(isFollowUpOverdue);
  if (overdue.length > 0) {
    return {
      action: `Close loop on overdue follow-up: ${overdue[0]!.Subject ?? "open activity"}`,
      why: "Evidence from recent dialogue keeps project understanding current.",
      expectedImpact: "Reduces delivery risk and keeps stakeholder map aligned.",
    };
  }

  const open = activities.filter(isFollowUpOpen);
  if (open.length > 0) {
    return {
      action: `Advance open commitment: ${open[0]!.Subject ?? "logged activity"}`,
      why: "The next logged action maintains momentum with named owners.",
      expectedImpact: "Moves delivery forward with traceable evidence.",
    };
  }

  const topGap = gaps[0];
  if (topGap) {
    return {
      action: topGap.recommendedAction,
      why: topGap.whyItMatters,
      expectedImpact: "Closes a documented gap in project understanding.",
    };
  }

  return {
    action: "Review milestones and confirm owners for the next delivery gate",
    why: "Sufficient understanding exists — focus shifts to execution.",
    expectedImpact: "Keeps delivery cadence visible and accountable.",
  };
}

function buildAssessment(
  confirmed: ConfirmedUnderstandingRow[],
  gaps: CriticalKnowledgeGap[],
  discoveryReady: boolean,
): ProjectDiscoveryAssessment {
  return {
    wellUnderstood: confirmed.map((row) => `${row.topic}: ${row.answer}`),
    gapsInUnderstanding: gaps.map((gap) => gap.missingInformation),
    workingAssumptions: discoveryReady
      ? []
      : [
          "Operational recommendations are withheld until discovery gaps close.",
          "Stored project fields may exist but require customer validation before reliance.",
        ],
  };
}

export function buildProjectUnderstanding(
  project: Project,
  companies: Company[],
  activities: Activity[],
  linkedDeal?: PipelineRow,
): ProjectUnderstanding {
  const stakeholderIntelligence = buildProjectStakeholderIntelligence(project, companies, activities);
  const confirmedUnderstanding = buildConfirmedUnderstanding(
    project,
    companies,
    activities,
    linkedDeal,
  );
  const criticalGaps = buildCriticalKnowledgeGaps(
    project,
    companies,
    activities,
    stakeholderIntelligence.missingRoles,
  );
  const discoveryScore = isPostDeliveryStage(project.stage)
    ? Math.max(80, computeDiscoveryScore(confirmedUnderstanding, criticalGaps))
    : computeDiscoveryScore(confirmedUnderstanding, criticalGaps);
  const discoveryReady = isPostDeliveryStage(project.stage)
    ? true
    : isDiscoveryReady(confirmedUnderstanding, criticalGaps);
  const suggestedQuestions = isPostDeliveryStage(project.stage)
    ? []
    : buildSuggestedQuestions(criticalGaps);
  const suggestedValidations = isPostDeliveryStage(project.stage)
    ? []
    : buildSuggestedValidations(criticalGaps, project);
  const recommendedConversations = isPostDeliveryStage(project.stage)
    ? []
    : buildRecommendedConversations(project, criticalGaps);

  return {
    discoveryReady,
    discoveryScore,
    discoveryLabel: discoveryLabel(discoveryScore, discoveryReady),
    knowledgeModel: {
      criticalGaps,
      confirmedUnderstanding,
    },
    suggestedQuestions,
    suggestedValidations,
    recommendedConversations,
    nextBestAction: buildNextBestAction(
      discoveryReady,
      criticalGaps,
      suggestedQuestions,
      activities,
    ),
    assessment: buildAssessment(confirmedUnderstanding, criticalGaps, discoveryReady),
  };
}

export function projectFieldCategory(
  field: "objective" | "problem" | "successCriteria",
  project: Project,
  understanding: ProjectUnderstanding,
): "known" | "assumed" | "unknown" {
  const value = project[field].trim();
  if (!value) return "unknown";

  const rowId =
    field === "objective" ? "objective" : field === "problem" ? "problem" : "success";
  const confirmed = understanding.knowledgeModel.confirmedUnderstanding.some(
    (row) => row.id === rowId || row.id === "engagement",
  );

  if (!understanding.discoveryReady) return "assumed";
  if (confirmed && understanding.knowledgeModel.criticalGaps.every((g) => g.id !== "engagement")) {
    return "known";
  }
  return "assumed";
}
