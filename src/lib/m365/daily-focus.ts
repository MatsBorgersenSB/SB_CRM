import { buildRelationshipCommandCenter } from "@/lib/relationship-intelligence";
import { buildDailyBriefing } from "@/lib/smartcrm-copilot-engine";
import { buildOpportunityCommandCenter } from "@/lib/opportunity-command-center-data";
import { formatDealValue } from "@/types/pipeline";
import { buildM365Meta, ensureImpact } from "@/lib/m365/meta";
import { toM365ActionFromFields, toM365RiskFromDealSignal } from "@/lib/m365/blocks";
import type { M365DataContext } from "@/lib/m365/resolve-context";
import type { M365DailyFocusPayload, M365RiskBlock } from "@/types/m365";
import { M365_BUDGETS, capItems } from "@/types/m365";
import { company360Href } from "@/types/company-360";

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

  const topActions = capItems(
    commandCenter.nextBestActions.map((nba) =>
      toM365ActionFromFields({
        id: `${nba.companyId}-${nba.ruleId}`,
        action: nba.action,
        reason: nba.reason,
        priority: nba.priority,
        href: company360Href(nba.companyId),
        extraImpact: [nba.companyName],
      }),
    ),
    M365_BUDGETS.dailyFocus.maxActions,
  );

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

  const whatIsAtRisk =
    topRelationshipRisk?.label ??
    topOpportunityRisk?.label ??
    "Portfolio is stable";

  const whyItMatters = [
    ...(topRelationshipRisk?.impact ?? []),
    ...(topOpportunityRisk?.impact ?? []),
  ].slice(0, 3);

  return {
    kind: "daily-focus",
    meta: buildM365Meta({
      whatMatters: briefing.headline,
      whatIsAtRisk,
      whyItMatters: whyItMatters.length > 0 ? whyItMatters : [briefing.headline],
      whatShouldHappenNext: topActions[0]?.action ?? "Review portfolio in Intelligence Center",
    }),
    todaysFocus: briefing.headline,
    topActions,
    topRelationshipRisk,
    topOpportunityRisk,
  };
}
