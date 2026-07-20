import type {
  InsightCategory,
  SmartAssistAssessmentSummary,
  SmartAssistInsight,
  SmartAssistInsightCatalog,
  SmartAssistUnknownResponse,
} from "@/types/smartassist-intelligence";
import type {
  ConfidenceLevel,
  CriticalKnowledgeGap,
  OpportunityUnderstanding,
} from "@/lib/opportunity-workspace-intelligence";
import {
  projectFieldCategory,
  type ProjectUnderstanding,
} from "@/lib/project-discovery-intelligence";
import type { ProjectStakeholderIntelligence } from "@/types/project-relationships";
import type { Project } from "@/types/project";

export function confidenceToCategory(confidence: ConfidenceLevel): InsightCategory {
  if (confidence === "high") return "known";
  if (confidence === "medium") return "assumed";
  return "assumed";
}

export function gapToCategory(gap: CriticalKnowledgeGap): InsightCategory {
  return gap.priority === "high" ? "missing_critical" : "unknown";
}

export function buildUnknownResponse(
  why: string,
  missingInformation: string[],
  askNext: string[],
): SmartAssistUnknownResponse {
  return {
    statement: "I do not know",
    why,
    missingInformation,
    askNext: askNext.slice(0, 4),
  };
}

export function buildOpportunityInsightCatalog(
  understanding: OpportunityUnderstanding,
  pipeline?: {
    team?: Array<{ projectRole: string }>;
    offeringIds?: string[];
  },
): SmartAssistInsightCatalog {
  const known: SmartAssistInsight[] = [];
  const assumed: SmartAssistInsight[] = [];
  const unknown: SmartAssistInsight[] = [];
  const missingCritical: SmartAssistInsight[] = [];

  const objectiveCategory = confidenceToCategory(understanding.clientObjective.confidence);
  const objectiveInsight: SmartAssistInsight = {
    id: "client-objective",
    topic: "Customer objective",
    statement: understanding.clientObjective.statement,
    category: objectiveCategory,
    confidence: understanding.clientObjective.confidence,
    confidenceReason: understanding.clientObjective.confidenceReason,
  };

  if (objectiveCategory === "known") known.push(objectiveInsight);
  else assumed.push(objectiveInsight);

  for (const row of understanding.knowledgeModel.confirmedUnderstanding) {
    const category = inferConfirmedCategory(row.id, row.answer);
    const insight: SmartAssistInsight = {
      id: row.id,
      topic: row.topic,
      statement: row.answer,
      category,
      confidence: category === "known" ? "high" : "medium",
      confidenceReason:
        category === "known"
          ? "Supported by logged customer interaction or explicit project data."
          : "Derived from project context — confirm with the customer.",
    };
    pushByCategory(known, assumed, unknown, missingCritical, insight);
  }

  for (const gap of understanding.knowledgeModel.criticalGaps) {
    const insight: SmartAssistInsight = {
      id: `gap-${gap.id}`,
      topic: gap.missingInformation,
      statement: gap.whyItMatters,
      category: gapToCategory(gap),
      confidence: gap.priority === "high" ? "low" : "medium",
      confidenceReason: gap.recommendedAction,
    };
    pushByCategory(known, assumed, unknown, missingCritical, insight);
  }

  for (const assumption of understanding.assessment.workingAssumptions) {
    assumed.push({
      id: `assumption-${slug(assumption)}`,
      topic: "Working assumption",
      statement: assumption,
      category: "assumed",
      confidence: "medium",
      confidenceReason: "Not yet validated with the customer.",
    });
  }

  for (const gapText of understanding.assessment.gapsInUnderstanding) {
    unknown.push({
      id: `gap-text-${slug(gapText)}`,
      topic: "Gap in understanding",
      statement: gapText,
      category: "unknown",
      confidence: "low",
      confidenceReason: "Requires customer confirmation.",
    });
  }

  const hasDecisionMaker = (pipeline?.team ?? []).some((member) =>
    /decision maker/i.test(member.projectRole),
  );
  const alreadyHasDecisionMakerInsight =
    known.some((item) => item.id === "buyer" || /decision maker/i.test(item.topic ?? "")) ||
    unknown.some((item) => item.id === "decision-maker-unknown") ||
    missingCritical.some((item) => item.id === "gap-decision-maker");

  if (!hasDecisionMaker && !alreadyHasDecisionMakerInsight) {
    unknown.push({
      id: "decision-maker-unknown",
      topic: "Decision Maker",
      statement: "Unknown",
      category: "unknown",
      confidence: "low",
      confidenceReason:
        "No Decision Maker is assigned on this opportunity. Add a real company contact — do not invent one.",
    });
  }

  const offeringIds = pipeline && "offeringIds" in pipeline ? pipeline.offeringIds : undefined;
  const hasOfferings = Array.isArray(offeringIds) && offeringIds.length > 0;
  const alreadyHasOfferingsInsight =
    known.some((item) => item.id === "offerings") ||
    unknown.some((item) => item.id === "offerings-unknown") ||
    missingCritical.some((item) => item.id === "gap-offerings");

  if (!hasOfferings && !alreadyHasOfferingsInsight) {
    unknown.push({
      id: "offerings-unknown",
      topic: "Standard Bio offerings",
      statement: "Unknown",
      category: "unknown",
      confidence: "low",
      confidenceReason:
        "No systems, products, or services are linked. Select offerings so SmartAssist knows what we are selling.",
    });
  }

  return {
    known,
    assumed,
    unknown,
    missingCritical,
    all: [...known, ...assumed, ...unknown, ...missingCritical],
  };
}

export function buildProjectInsightCatalog(
  understanding: ProjectUnderstanding,
  stakeholderIntelligence?: ProjectStakeholderIntelligence,
  project?: Project,
): SmartAssistInsightCatalog {
  const known: SmartAssistInsight[] = [];
  const assumed: SmartAssistInsight[] = [];
  const unknown: SmartAssistInsight[] = [];
  const missingCritical: SmartAssistInsight[] = [];

  if (!understanding.discoveryReady) {
    assumed.push({
      id: "discovery-gate",
      topic: "Discovery status",
      statement: understanding.discoveryLabel,
      category: "assumed",
      confidence: "medium",
      confidenceReason:
        "SmartAssist withholds objectives, risks, blockers, and recommendations until understanding is evidence-based.",
    });
  } else {
    known.push({
      id: "discovery-ready",
      topic: "Discovery status",
      statement: understanding.discoveryLabel,
      category: "known",
      confidence: "high",
      confidenceReason: "Sufficient confirmed understanding exists to support recommendations.",
    });
  }

  for (const row of understanding.knowledgeModel.confirmedUnderstanding) {
    const category = inferProjectConfirmedCategory(row.id, understanding.discoveryReady);
    const insight: SmartAssistInsight = {
      id: row.id,
      topic: row.topic,
      statement: row.answer,
      category,
      confidence: category === "known" ? "high" : "medium",
      confidenceReason:
        category === "known"
          ? "Supported by logged project data, dialogue, or explicit record."
          : "Recorded but not yet validated through customer conversation.",
    };
    pushByCategory(known, assumed, unknown, missingCritical, insight);
  }

  for (const gap of understanding.knowledgeModel.criticalGaps) {
    const insight: SmartAssistInsight = {
      id: `gap-${gap.id}`,
      topic: gap.missingInformation,
      statement: gap.whyItMatters,
      category: gapToCategory(gap),
      confidence: gap.priority === "high" ? "low" : "medium",
      confidenceReason: gap.recommendedAction,
    };
    pushByCategory(known, assumed, unknown, missingCritical, insight);
  }

  for (const assumption of understanding.assessment.workingAssumptions) {
    assumed.push({
      id: `assumption-${slug(assumption)}`,
      topic: "Working assumption",
      statement: assumption,
      category: "assumed",
      confidence: "medium",
      confidenceReason: "Not yet validated with the customer.",
    });
  }

  for (const gapText of understanding.assessment.gapsInUnderstanding) {
    unknown.push({
      id: `gap-text-${slug(gapText)}`,
      topic: "Gap in understanding",
      statement: gapText,
      category: "unknown",
      confidence: "low",
      confidenceReason: "Requires customer confirmation.",
    });
  }

  if (project) {
    for (const field of ["objective", "problem", "successCriteria"] as const) {
      const category = projectFieldCategory(field, project, understanding);
      if (category === "unknown" && !project[field].trim()) continue;
      const labels = {
        objective: "Project objective",
        problem: "Problem statement",
        successCriteria: "Success criteria",
      };
      const insight: SmartAssistInsight = {
        id: `field-${field}`,
        topic: labels[field],
        statement: project[field].trim() || "Not recorded",
        category: category === "known" ? "known" : category === "assumed" ? "assumed" : "unknown",
        confidence: category === "known" ? "high" : "low",
        confidenceReason:
          category === "known"
            ? "Validated through discovery evidence."
            : category === "assumed"
              ? "Recorded — validate with customer before relying on it."
              : "Missing — gather through discovery conversation.",
      };
      pushByCategory(known, assumed, unknown, missingCritical, insight);
    }
  }

  if (stakeholderIntelligence?.relationshipValidation?.detected) {
    missingCritical.push({
      id: "relationship-validation",
      topic: "Relationship validation",
      statement: stakeholderIntelligence.relationshipValidation.message,
      category: "missing_critical",
      confidence: "medium",
      confidenceReason: stakeholderIntelligence.relationshipValidation.recommendedAction,
    });
  }

  for (const gap of stakeholderIntelligence?.missingRoles ?? []) {
    missingCritical.push({
      id: `stakeholder-${gap.id}`,
      topic: gap.label,
      statement: gap.impact,
      category: gap.severity === "critical" ? "missing_critical" : "unknown",
      confidence: gap.severity === "critical" ? "low" : "medium",
      confidenceReason: gap.recommendedAction,
    });
  }

  return {
    known,
    assumed,
    unknown,
    missingCritical,
    all: [...known, ...assumed, ...unknown, ...missingCritical],
  };
}

function inferProjectConfirmedCategory(
  rowId: string,
  discoveryReady: boolean,
): InsightCategory {
  if (rowId === "engagement" || rowId === "decisions" || rowId.startsWith("resp-")) {
    return "known";
  }
  if (rowId === "account" || rowId === "opportunity" || rowId === "milestones") {
    return "known";
  }
  if (!discoveryReady && (rowId === "objective" || rowId === "problem" || rowId === "success")) {
    return "assumed";
  }
  return discoveryReady ? "known" : "assumed";
}

export function buildOpportunityAssessmentSummary(
  understanding: OpportunityUnderstanding,
): SmartAssistAssessmentSummary {
  const nba = understanding.nextBestAction;
  const attentionConfidence: ConfidenceLevel =
    understanding.recommendedAttention === "HIGH"
      ? "high"
      : understanding.recommendedAttention === "MEDIUM"
        ? "medium"
        : "low";

  return {
    headline: nba.action,
    confidence: attentionConfidence,
    confidenceReason: nba.why,
    nextAction: {
      id: "next-best-action",
      topic: "Next best action",
      statement: nba.action,
      category: understanding.knowledgeModel.criticalGaps.length > 0 ? "missing_critical" : "known",
      confidence: attentionConfidence,
      confidenceReason: nba.expectedImpact,
    },
    attentionInsight: {
      id: "attention",
      topic: "Attention",
      statement: understanding.attentionReason,
      category:
        understanding.recommendedAttention === "HIGH" ? "missing_critical" : "assumed",
      confidence: attentionConfidence,
    },
  };
}

function inferConfirmedCategory(rowId: string, answer: string): InsightCategory {
  if (rowId === "engagement" || rowId === "buyer") return "known";
  if (/appears to be|inferred|directionally|discussed/i.test(answer)) return "assumed";
  if (rowId === "product" || rowId === "scope") return "assumed";
  return "known";
}

function pushByCategory(
  known: SmartAssistInsight[],
  assumed: SmartAssistInsight[],
  unknown: SmartAssistInsight[],
  missingCritical: SmartAssistInsight[],
  insight: SmartAssistInsight,
) {
  switch (insight.category) {
    case "known":
      known.push(insight);
      break;
    case "assumed":
      assumed.push(insight);
      break;
    case "unknown":
      unknown.push(insight);
      break;
    case "missing_critical":
      missingCritical.push(insight);
      break;
  }
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32);
}

export function lowestConfidence(
  insights: SmartAssistInsight[],
): ConfidenceLevel {
  if (insights.some((item) => item.confidence === "low")) return "low";
  if (insights.some((item) => item.confidence === "medium")) return "medium";
  return "high";
}

export function primaryCategoryFromInsights(
  insights: SmartAssistInsight[],
): InsightCategory {
  if (insights.some((item) => item.category === "missing_critical")) {
    return "missing_critical";
  }
  if (insights.some((item) => item.category === "unknown")) return "unknown";
  if (insights.some((item) => item.category === "assumed")) return "assumed";
  return "known";
}
