import type {
  SmartAssistFocus,
  SmartAssistItem,
  SmartAssistMetric,
  SmartAssistMetricId,
} from "@/types/smart-assist";

export function buildSmartAssistMetrics(focus: SmartAssistFocus): SmartAssistMetric[] {
  const { metrics } = focus;
  return [
    {
      id: "critical_opportunities",
      emoji: "🔥",
      label: "Critical Opportunities",
      count: metrics.criticalOpportunities,
      viewAllHref: "/opportunities",
    },
    {
      id: "follow_ups_due",
      emoji: "⚠",
      label: "Follow-Ups Due",
      count: metrics.followUpsDue,
      viewAllHref: "/activities",
    },
    {
      id: "meetings_today",
      emoji: "📅",
      label: "Meetings Today",
      count: metrics.meetingsToday,
      viewAllHref: "/activities",
    },
    {
      id: "awaiting_response",
      emoji: "📄",
      label: "Awaiting Response",
      count: metrics.quotationsAwaiting,
      viewAllHref: "/intelligence",
    },
    {
      id: "open_commitments",
      emoji: "✅",
      label: "Open Commitments",
      count: metrics.openCommitments,
      viewAllHref: "/activities",
    },
  ];
}

export function itemsForSmartAssistMetric(
  focus: SmartAssistFocus,
  metricId: SmartAssistMetricId,
): SmartAssistItem[] {
  const { sections } = focus;

  switch (metricId) {
    case "critical_opportunities":
      return sections.opportunities.filter((item) => item.priority === "critical");
    case "follow_ups_due":
      return sections.follow_ups.filter((item) => item.emoji === "⚠");
    case "meetings_today":
      return sections.upcoming.filter((item) => item.id.startsWith("meeting-"));
    case "awaiting_response":
      return sections.opportunities.filter((item) => item.emoji === "📄");
    case "open_commitments":
      return sections.follow_ups;
    default:
      return [];
  }
}

export function attentionCountForMetrics(metrics: SmartAssistMetric[]): number {
  return metrics.reduce((sum, metric) => sum + metric.count, 0);
}
