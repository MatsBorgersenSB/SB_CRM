import type { IntelligenceCenterSnapshot } from "@/lib/intelligence-center-data";
import { formatIntelligenceCenterTimestamp } from "@/lib/intelligence-center-data";

export type ExecutivePriorityAction = {
  id: string;
  action: string;
  context: string;
  href: string;
  domain: "relationship" | "opportunity" | "knowledge" | "commitment";
  priority: "critical" | "high" | "normal";
  impact: string[];
};

export type ExecutiveGrowingItem = {
  id: string;
  label: string;
  detail: string;
  href: string;
};

export type ExecutiveBriefing = {
  timestamp: string;
  needsAttention: string;
  whatChanged: string;
  growingNarrative: string;
  growingItems: ExecutiveGrowingItem[];
  priorityActions: ExecutivePriorityAction[];
};

function actionPriority(
  priority: string | undefined,
  fallback: "critical" | "high" | "normal" = "normal",
): ExecutivePriorityAction["priority"] {
  if (priority === "High" || priority === "critical") return "critical";
  if (priority === "Medium" || priority === "warning" || priority === "high") return "high";
  return fallback;
}

export function buildExecutiveBriefing(snapshot: IntelligenceCenterSnapshot): ExecutiveBriefing {
  const { overview, healthTrends, smartDocs } = snapshot;

  const relationshipActions: ExecutivePriorityAction[] = snapshot.relationshipsAtRisk
    .slice(0, 2)
    .map((item) => ({
      id: `rel-${item.id}`,
      action: item.nextBestAction,
      context: item.companyName,
      href: item.href,
      domain: "relationship" as const,
      priority: actionPriority(item.action.priority, item.healthScore < 40 ? "critical" : "high"),
      impact: [item.subtitle, `Health score ${item.healthScore}`],
    }));

  const opportunityActions: ExecutivePriorityAction[] = snapshot.stalledOpportunities
    .slice(0, 2)
    .map((item) => ({
      id: `opp-${item.dealId}`,
      action: item.nextBestAction,
      context: `${item.dealName} · ${item.companyName}`,
      href: item.href,
      domain: "opportunity" as const,
      priority: item.daysStalled >= 30 ? "critical" : "high",
      impact: [`${item.daysStalled} days without activity`, item.reason],
    }));

  const commitmentActions: ExecutivePriorityAction[] = snapshot.openCommitments
    .filter((item) => item.isOverdue)
    .slice(0, 1)
    .map((item) => ({
      id: `commit-${item.id}`,
      action: item.commitmentLabel,
      context: `${item.companyName} · ${item.dueLabel}`,
      href: item.href,
      domain: "commitment" as const,
      priority: "critical" as const,
      impact: ["Overdue commitment — relationship trust at stake", item.subtitle],
    }));

  const knowledgeActions: ExecutivePriorityAction[] = smartDocs.knowledgeAtRisk
    .slice(0, 2)
    .map((item) => ({
      id: `doc-${item.document.id}`,
      action: item.nextBestAction?.action ?? "Review document health",
      context: item.document.displayName,
      href: item.href,
      domain: "knowledge" as const,
      priority:
        item.insights.businessImpactLevel === "Critical" ? ("critical" as const) : ("high" as const),
      impact: [
        `${item.insights.businessImpactLevel} business impact`,
        `${item.referenceCount} activity references`,
        item.risks[0]?.label ?? "Knowledge asset requires review",
      ],
    }));

  const priorityRank = { critical: 0, high: 1, normal: 2 } as const;
  const priorityActions = [
    ...commitmentActions,
    ...relationshipActions,
    ...opportunityActions,
    ...knowledgeActions,
  ]
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])
    .slice(0, 5);

  const riskTotal =
    overview.atRiskCount + overview.stalledDeals + smartDocs.overview.knowledgeAtRiskCount;

  const needsAttention =
    riskTotal === 0
      ? "Portfolio is stable. Protect momentum on growing accounts and maintain proactive outreach."
      : `${overview.atRiskCount} relationship${overview.atRiskCount === 1 ? "" : "s"} need attention, ${overview.stalledDeals} deal${overview.stalledDeals === 1 ? "" : "s"} are stalled, and ${smartDocs.overview.knowledgeAtRiskCount} knowledge asset${smartDocs.overview.knowledgeAtRiskCount === 1 ? "" : "s"} are at risk.`;

  const growingItems: ExecutiveGrowingItem[] = [
    ...snapshot.fastestGrowing.slice(0, 3).map((item) => ({
      id: `grow-${item.id}`,
      label: item.companyName,
      detail: item.subtitle,
      href: item.href,
    })),
    ...snapshot.strategicAccounts
      .filter((item) => !snapshot.fastestGrowing.some((g) => g.id === item.id))
      .slice(0, 2)
      .map((item) => ({
        id: `strategic-${item.id}`,
        label: item.companyName,
        detail: `Strategic account · health ${item.healthScore}`,
        href: item.href,
      })),
  ].slice(0, 5);

  const growingNarrative =
    overview.improvingCount > 0
      ? `${overview.improvingCount} relationship${overview.improvingCount === 1 ? "" : "s"} improving — deepen these accounts while addressing risks.`
      : growingItems.length > 0
        ? "Momentum is building on key accounts — protect and expand these relationships."
        : "No strong growth signals yet — focus on re-engaging stalled accounts.";

  return {
    timestamp: formatIntelligenceCenterTimestamp(snapshot.generatedAt),
    needsAttention,
    whatChanged: healthTrends.narrative,
    growingNarrative,
    growingItems,
    priorityActions,
  };
}
