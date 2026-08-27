import { buildRelationshipCommandCenter } from "@/lib/relationship-intelligence";
import { buildDailyBriefing } from "@/lib/smartcrm-copilot-engine";
import { buildOpportunityCommandCenter } from "@/lib/opportunity-command-center-data";
import { formatDealValue } from "@/types/pipeline";
import { buildM365Meta, ensureImpact } from "@/lib/m365/meta";
import { toM365ActionFromFields, toM365RiskFromDealSignal } from "@/lib/m365/blocks";
import type { M365DataContext } from "@/lib/m365/resolve-context";
import type {
  M365ActionBlock,
  M365DailyFocusCommitment,
  M365DailyFocusPayload,
  M365RiskBlock,
} from "@/types/m365";
import { company360Href } from "@/types/company-360";
import {
  formatDueDate,
  isFollowUpOpen,
  isFollowUpOverdue,
} from "@/lib/activity-utils";

/**
 * FS-018 Daily Focus — exactly four blocks:
 * 1) Who to engage  2) Work at risk  3) Commitment due  4) One NBA
 */
export function buildM365DailyFocus(ctx: M365DataContext): M365DailyFocusPayload {
  const commandCenter = buildRelationshipCommandCenter(
    ctx.companies,
    ctx.pipelines,
    ctx.activities,
  );
  const briefing = buildDailyBriefing(ctx.companies, ctx.pipelines, ctx.activities);
  const oppCenter = buildOpportunityCommandCenter(
    ctx.pipelines,
    ctx.companies,
    ctx.activities,
  );

  const rankedActions = commandCenter.nextBestActions.map((nba) =>
    toM365ActionFromFields({
      id: `${nba.companyId}-${nba.ruleId}`,
      action: nba.action,
      reason: nba.reason,
      priority: nba.priority,
      href: company360Href(nba.companyId),
      extraImpact: [nba.companyName],
    }),
  );

  const whoToEngage: M365ActionBlock | null = rankedActions[0]
    ? {
        ...rankedActions[0],
        action: rankedActions[0].action.startsWith("Engage")
          ? rankedActions[0].action
          : `Engage: ${rankedActions[0].action}`,
      }
    : null;

  const topRelationship = briefing.relationshipsAttention[0];
  const topRelationshipRisk: M365RiskBlock | null = topRelationship
    ? {
        id: topRelationship.id,
        label: topRelationship.label,
        detail: topRelationship.detail,
        severity: topRelationship.severity === "critical" ? "critical" : "warning",
        impact: ensureImpact([topRelationship.detail], "Relationship needs attention"),
      }
    : null;

  const topDeal = oppCenter.dealsAtRisk[0];
  const topOpportunityRisk: M365RiskBlock | null = topDeal
    ? toM365RiskFromDealSignal(
        topDeal.risks[0] ?? {
          id: `deal-risk-${topDeal.dealId}`,
          type: "silence_risk",
          label: `${topDeal.dealName} at risk`,
          detail: topDeal.healthSummary,
          severity: topDeal.healthStatus === "At Risk" ? "critical" : "warning",
        },
        `${formatDealValue(topDeal.currency, topDeal.salesValue)} pipeline exposure`,
      )
    : null;

  const workAtRisk: M365RiskBlock | null =
    topOpportunityRisk ?? topRelationshipRisk;

  const openCommitmentDue = pickOpenCommitmentDue(ctx);

  const nextBestAction: M365ActionBlock =
    rankedActions[1] ??
    rankedActions[0] ??
    toM365ActionFromFields({
      id: "daily-focus-fallback",
      action: "Review portfolio priorities in SmartCRM",
      reason: "No urgent next best action was ranked for today",
      priority: "Medium",
      href: "/intelligence",
      extraImpact: ["Stay ahead of silent accounts and overdue commitments"],
    });

  const whatIsAtRisk =
    workAtRisk?.label ??
    (openCommitmentDue?.overdue ? openCommitmentDue.title : null) ??
    "Portfolio is stable";

  const whyItMatters = [
    ...(workAtRisk?.impact ?? []),
    ...(openCommitmentDue?.impact ?? []),
    ...(whoToEngage?.impact ?? []),
  ].slice(0, 3);

  return {
    kind: "daily-focus",
    meta: buildM365Meta({
      whatMatters: whoToEngage?.action ?? briefing.headline,
      whatIsAtRisk,
      whyItMatters: whyItMatters.length > 0 ? whyItMatters : [briefing.headline],
      whatShouldHappenNext: nextBestAction.action,
    }),
    whoToEngage,
    workAtRisk,
    openCommitmentDue,
    nextBestAction,
  };
}

function pickOpenCommitmentDue(ctx: M365DataContext): M365DailyFocusCommitment | null {
  const open = ctx.activities
    .filter(isFollowUpOpen)
    .filter((activity) => Boolean(activity.NextAction?.trim() || activity.NextActionDate))
    .sort((a, b) => {
      const aOverdue = isFollowUpOverdue(a) ? 0 : 1;
      const bOverdue = isFollowUpOverdue(b) ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      return (a.NextActionDate || "9999").localeCompare(b.NextActionDate || "9999");
    });

  const activity = open[0];
  if (!activity) return null;

  const overdue = isFollowUpOverdue(activity);
  const title =
    activity.NextAction?.trim() ||
    activity.Subject?.trim() ||
    "Open commitment";
  const dueLabel = activity.NextActionDate
    ? overdue
      ? `Overdue · ${formatDueDate(activity.NextActionDate)}`
      : `Due · ${formatDueDate(activity.NextActionDate)}`
    : "Due date unknown";

  const companyId =
    typeof activity.Company === "object" && activity.Company && "CompanyID" in activity.Company
      ? String((activity.Company as { CompanyID?: string }).CompanyID ?? "")
      : "";

  return {
    id: activity.ActivityID || `commitment-${activity.id}`,
    title,
    dueLabel,
    overdue,
    impact: ensureImpact(
      [
        overdue
          ? "Overdue commitments erode trust and stall commercial progress"
          : "Clear the commitment to keep momentum with this relationship",
      ],
      "Commitment needs follow-through",
    ),
    href: companyId ? company360Href(companyId) : "/activities",
  };
}
