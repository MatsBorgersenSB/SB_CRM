import type { Activity } from "@/types/activity";
import type { AttentionItem } from "@/types/attention-item";
import type { CommercialViabilityAssessment } from "@/types/commercial-viability";
import { VIABILITY_RECOMMENDATION_LABELS } from "@/types/commercial-viability";
import {
  getActivitiesForDeal,
  isFollowUpOpen,
  isFollowUpOverdue,
} from "@/lib/activity-utils";
import type { SmartDocsIntelligenceSnapshot } from "@/lib/smartdocs-intelligence-data";

export type OpportunityDecisionBrief = {
  happening: string;
  shouldDo: string;
  blocking: string;
  forgetting: string[];
};

export type OpportunityMatterItem = {
  id: string;
  label: string;
  detail?: string;
  severity: "critical" | "warning" | "info";
};

export type OpportunityCriticalRisk = {
  id: string;
  label: string;
  detail?: string;
  impact: string[];
  severity: "critical" | "high" | "medium";
  href?: string;
};

export function buildOpportunityDecisionBrief(
  assessment: CommercialViabilityAssessment,
  attentionItems: AttentionItem[],
  dealActivities: Activity[],
): OpportunityDecisionBrief {
  const overdueCount = dealActivities.filter(isFollowUpOverdue).length;
  const openCount = dealActivities.filter(isFollowUpOpen).length;
  const fatalCount = assessment.fatalFlawAlerts.length;
  const topAction = assessment.nextActions[0];

  const happening = [
    assessment.coreQuestions.isDealProgressing,
    `Contract probability ${assessment.contractProbabilityLabel}.`,
    VIABILITY_RECOMMENDATION_LABELS[assessment.recommendation],
  ]
    .filter(Boolean)
    .join(" ");

  const shouldDo = topAction
    ? topAction.action
    : openCount > 0
      ? "Close out the oldest open commitment on this deal."
      : "Log a customer interaction to refresh commercial intelligence.";

  const blockingParts: string[] = [];
  if (fatalCount > 0) {
    blockingParts.push(
      `${fatalCount} fatal flaw${fatalCount === 1 ? "" : "s"} block contract readiness.`,
    );
  }
  if (overdueCount > 0) {
    blockingParts.push(
      `${overdueCount} overdue commitment${overdueCount === 1 ? "" : "s"} need action.`,
    );
  }
  const urgentAttention = attentionItems.filter((item) => item.severity === "urgent");
  if (urgentAttention.length > 0) {
    blockingParts.push(
      `${urgentAttention.length} urgent attention item${urgentAttention.length === 1 ? "" : "s"}.`,
    );
  }
  if (
    assessment.recommendation === "deprioritize" ||
    assessment.recommendation === "walk_away"
  ) {
    blockingParts.push(
      `Commercial recommendation: ${VIABILITY_RECOMMENDATION_LABELS[assessment.recommendation]}.`,
    );
  }
  const blocking =
    blockingParts.length > 0
      ? blockingParts.join(" ")
      : "No critical blockers — momentum depends on executing the next recommended action.";

  const forgetting: string[] = [];
  if (openCount > 0 && overdueCount === 0) {
    forgetting.push(`${openCount} open commitment${openCount === 1 ? "" : "s"} without overdue status.`);
  }
  if (assessment.risks.length > 0) {
    forgetting.push(assessment.risks[0].label);
  }
  if (attentionItems.length > 0) {
    forgetting.push(attentionItems[0].recommendation);
  }
  if (forgetting.length === 0) {
    forgetting.push("Stakeholder coverage and document completeness — review before your next customer touchpoint.");
  }

  return { happening, shouldDo, blocking, forgetting: forgetting.slice(0, 3) };
}

export function buildWhatMattersNow(
  assessment: CommercialViabilityAssessment,
  attentionItems: AttentionItem[],
  dealActivities: Activity[],
): OpportunityMatterItem[] {
  const items: OpportunityMatterItem[] = [];

  for (const flaw of assessment.fatalFlawAlerts.slice(0, 2)) {
    items.push({
      id: `flaw-${flaw.id}`,
      label: flaw.label,
      detail: flaw.detail,
      severity: "critical",
    });
  }

  const overdue = dealActivities.filter(isFollowUpOverdue);
  if (overdue.length > 0) {
    items.push({
      id: "overdue-commitments",
      label: `${overdue.length} overdue commitment${overdue.length === 1 ? "" : "s"}`,
      detail: overdue[0].NextAction || overdue[0].Subject,
      severity: "critical",
    });
  }

  for (const item of attentionItems.slice(0, 2)) {
    items.push({
      id: `attention-${item.id}`,
      label: item.recommendation,
      detail: item.suggestedAiAction,
      severity: item.severity === "urgent" ? "critical" : "warning",
    });
  }

  if (assessment.contractReadiness.percent < 50) {
    items.push({
      id: "contract-readiness",
      label: `Contract readiness at ${assessment.contractReadiness.percent}%`,
      detail: assessment.estimatedContractReadinessLabel,
      severity: "warning",
    });
  }

  const topAction = assessment.nextActions[0];
  if (topAction && items.length < 4) {
    items.push({
      id: "next-action",
      label: topAction.action,
      detail: topAction.reason,
      severity: "info",
    });
  }

  if (items.length === 0) {
    items.push({
      id: "healthy",
      label: "Deal momentum is stable",
      detail: assessment.coreQuestions.shouldInvestResources,
      severity: "info",
    });
  }

  return items.slice(0, 4);
}

export function buildCriticalRisks(
  assessment: CommercialViabilityAssessment,
  attentionItems: AttentionItem[],
  dealId: string,
  smartDocs?: SmartDocsIntelligenceSnapshot,
): OpportunityCriticalRisk[] {
  const risks: OpportunityCriticalRisk[] = [];

  for (const flaw of assessment.fatalFlawAlerts) {
    risks.push({
      id: `fatal-${flaw.id}`,
      label: flaw.label,
      detail: flaw.detail,
      impact: flaw.impact,
      severity: "critical",
      href: `/deals/${encodeURIComponent(dealId)}?tab=commercial`,
    });
  }

  for (const risk of assessment.risks.slice(0, 3)) {
    risks.push({
      id: `cvm-${risk.label}`,
      label: risk.label,
      detail: risk.detail,
      impact: risk.impact,
      severity: "high",
      href: `/deals/${encodeURIComponent(dealId)}?tab=commercial`,
    });
  }

  for (const item of attentionItems.filter((i) => i.severity === "urgent").slice(0, 2)) {
    risks.push({
      id: `attn-${item.id}`,
      label: item.recommendation,
      detail: item.suggestedAiAction,
      impact: [item.recommendation],
      severity: "high",
      href: item.href,
    });
  }

  if (smartDocs) {
    const dealKnowledge = smartDocs.knowledgeAtRisk.filter(
      (doc) => doc.document.pipelineId === dealId,
    );
    for (const doc of dealKnowledge.slice(0, 2)) {
      risks.push({
        id: `doc-${doc.document.id}`,
        label: doc.document.displayName,
        detail: doc.nextBestAction.action,
        impact: doc.risks.map((r) => r.detail || r.label),
        severity: "medium",
        href: doc.href,
      });
    }
  }

  return risks.slice(0, 6);
}

export function getDealActivities(
  activities: Activity[],
  dealId: string,
): Activity[] {
  return getActivitiesForDeal(activities, dealId);
}
