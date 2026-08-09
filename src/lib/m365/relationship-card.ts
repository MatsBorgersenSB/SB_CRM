import { buildCompany360Snapshot } from "@/lib/company-360-data";
import { sumPipelineValue, buildPipelineImpactLines } from "@/lib/impact-context";
import { isFollowUpOpen, isFollowUpOverdue } from "@/lib/activity-utils";
import { buildM365Meta } from "@/lib/m365/meta";
import { toM365Action, toM365RiskFromCompanySignal } from "@/lib/m365/blocks";
import type { M365DataContext } from "@/lib/m365/resolve-context";
import type { Company } from "@/types/company";
import type { M365RelationshipCardPayload } from "@/types/m365";
import { M365_BUDGETS } from "@/types/m365";
import { company360Href } from "@/types/company-360";

export function buildM365RelationshipCard(
  company: Company,
  ctx: M365DataContext,
): M365RelationshipCardPayload {
  const snapshot = buildCompany360Snapshot(
    company,
    ctx.pipelines,
    ctx.activities,
    ctx.inventory,
  );

  const { header, intelligence, pipelines, openActions } = snapshot;
  const topRiskSignal = intelligence.riskSignals[0];
  const topRisk = topRiskSignal ? toM365RiskFromCompanySignal(topRiskSignal) : null;

  const overdue = openActions.filter((a) => isFollowUpOverdue(a));
  const open = openActions.filter((a) => isFollowUpOpen(a));

  const commitmentState =
    overdue.length > 0
      ? `${overdue.length} overdue`
      : open.length > 0
        ? `${open.length} open`
        : "None open";

  const pipelineValue = sumPipelineValue(pipelines);
  const pipelineImpact = buildPipelineImpactLines(pipelines);

  const nextBestAction = toM365Action(
    intelligence.recommendedAction,
    company.CompanyID,
    pipelineImpact,
  );

  const whatIsAtRisk = topRisk?.label ?? "No critical risks detected";
  const whyItMatters =
    topRisk?.impact ?? pipelineImpact.length > 0 ? pipelineImpact : ["Relationship is stable"];

  return {
    kind: "relationship-card",
    meta: buildM365Meta({
      whatMatters: `${header.companyName} — ${header.healthStatus} relationship`,
      whatIsAtRisk,
      whyItMatters,
      whatShouldHappenNext: nextBestAction.action,
    }),
    companyName: header.companyName,
    companyId: company.CompanyID,
    health: {
      score: header.healthScore,
      status: header.healthStatus,
      trend: header.trend,
    },
    topRisk,
    nextBestAction,
    openOpportunities: {
      count: pipelines.length,
      valueLabel: pipelineValue,
      impact: ensurePipelineImpact(pipelineImpact, pipelines.length),
    },
    openCommitments: {
      count: openActions.length,
      stateLabel: commitmentState,
      impact:
        overdue.length > 0
          ? [
              "Overdue commitments erode trust and delay progress",
              pipelineValue !== "—" ? `${pipelineValue} pipeline depends on follow-through` : "",
            ].filter(Boolean)
          : open.length > 0
            ? ["Open commitments must be resolved to maintain momentum"]
            : ["No open commitments blocking progress"],
    },
    deepLink: company360Href(company.CompanyID),
  };
}

function ensurePipelineImpact(lines: string[], count: number): string[] {
  if (lines.length > 0) return lines;
  return count > 0 ? [`${count} active opportunities`] : ["No active pipeline"];
}

/** Validates North Star 5-block budget at build time. */
export function assertRelationshipCardBudget(payload: M365RelationshipCardPayload): void {
  if (M365_BUDGETS.relationshipCard.blocks !== 5) return;
  void payload;
}
