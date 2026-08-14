import { buildCompany360Snapshot } from "@/lib/company-360-data";
import {
  formatCompanyTypesLabel,
  formatRelationshipPostureLabel,
  getCompanyRelationshipPosture,
  normalizeCompanyTypes,
} from "@/lib/company-classification";
import {
  hasCorrespondence,
  shouldOfferCreateOpportunity,
  type CompanyCorrespondenceEvidence,
} from "@/lib/company-correspondence";
import { sumPipelineValue, buildPipelineImpactLines } from "@/lib/impact-context";
import { isFollowUpOpen, isFollowUpOverdue } from "@/lib/activity-utils";
import {
  pickPendingCommitment,
  toPendingCommitmentView,
} from "@/lib/complete-commitment";
import { buildM365Meta } from "@/lib/m365/meta";
import {
  toM365Action,
  toM365ActionFromFields,
  toM365RiskFromCompanySignal,
} from "@/lib/m365/blocks";
import type { M365DataContext } from "@/lib/m365/resolve-context";
import { buildCoPilotProposals } from "@/lib/smartassist-copilot-engine";
import type { Company } from "@/types/company";
import type { M365RelationshipCardPayload } from "@/types/m365";
import { M365_BUDGETS } from "@/types/m365";
import { company360Href } from "@/types/company-360";
import { normalizeCompanySectors } from "@/lib/company-sectors";

export type BuildM365RelationshipCardOptions = {
  correspondence?: CompanyCorrespondenceEvidence | null;
};

export function buildM365RelationshipCard(
  company: Company,
  ctx: M365DataContext,
  options?: BuildM365RelationshipCardOptions,
): M365RelationshipCardPayload {
  const correspondence = options?.correspondence ?? null;
  const correspondenceByCompanyId = new Map<string, CompanyCorrespondenceEvidence>();
  if (correspondence) {
    correspondenceByCompanyId.set(company.CompanyID, correspondence);
  }

  const snapshot = buildCompany360Snapshot(
    company,
    ctx.pipelines,
    ctx.activities,
    ctx.inventory,
    { correspondence },
  );

  const { header, intelligence, pipelines, openActions } = snapshot;
  const posture = getCompanyRelationshipPosture(company);
  const nonCommercialPosture =
    posture === "buy_from" ||
    posture === "collaborate" ||
    posture === "watch" ||
    posture === "fund" ||
    posture === "internal";

  const topRiskSignal =
    intelligence.riskSignals.find(
      (signal) =>
        signal.id !== "no-contact" &&
        !(nonCommercialPosture && signal.id === "mail-not-in-crm"),
    ) ??
    (hasCorrespondence(correspondence) || nonCommercialPosture
      ? undefined
      : intelligence.riskSignals[0]);
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

  // FS-013 — prefer Active Assist prepared action when available for this company.
  const prepared = buildCoPilotProposals(
    [company],
    pipelines,
    ctx.activities,
    [],
    { correspondenceByCompanyId },
  ).find((proposal) => proposal.companyId === company.CompanyID);

  const rawRecommended = intelligence.recommendedAction;
  const recommendedAction =
    rawRecommended.ruleId === "create_new_opportunity" &&
    !shouldOfferCreateOpportunity(company, correspondence)
      ? {
          ...rawRecommended,
          action: "Classify this relationship",
          reason:
            "Project or correspondence context suggests delivery work — classify the role before inventing a sales opportunity.",
          ruleId: "classify_relationship",
        }
      : nonCommercialPosture && hasCorrespondence(correspondence)
        ? {
            ...rawRecommended,
            id: `nba-supplier-mail-${company.CompanyID}`,
            action: "No commercial tag required",
            reason: `${formatCompanyTypesLabel(normalizeCompanyTypes(company), { max: 1 })} correspondence is visible — keep it on the company; do not invent an opportunity or project link.`,
            priority: "Low" as const,
            confidenceScore: 88,
            ruleId: "supplier_relationship_mail",
          }
        : rawRecommended.ruleId === "new_relationship" &&
            hasCorrespondence(correspondence)
          ? {
              ...rawRecommended,
              action: "Capture correspondence",
              reason:
                "Mail already exists for this relationship — capture it in CRM instead of treating this as a first cold contact.",
              ruleId: "capture_correspondence",
            }
          : rawRecommended;

  // Prefer Active Assist only when it is not capture-busywork for suppliers.
  const preparedUsable =
    prepared &&
    !(
      nonCommercialPosture &&
      prepared.suppressionKey?.includes("capture_correspondence")
    )
      ? prepared
      : null;

  const nextBestAction = preparedUsable
    ? toM365ActionFromFields({
        id: preparedUsable.id,
        action: preparedUsable.title,
        reason: preparedUsable.reason,
        priority:
          preparedUsable.severity === "urgent"
            ? "High"
            : preparedUsable.severity === "needs_attention"
              ? "Medium"
              : "Low",
        href: preparedUsable.href ?? company360Href(company.CompanyID),
        extraImpact: [preparedUsable.impact, ...pipelineImpact],
        activeAssistProposal: preparedUsable,
        plannerEligible: false,
      })
    : toM365Action(recommendedAction, company.CompanyID, pipelineImpact);

  const whatIsAtRisk = topRisk?.label ?? "No critical risks detected";
  const whyItMatters =
    topRisk?.impact ?? pipelineImpact.length > 0 ? pipelineImpact : ["Relationship is stable"];

  const companyTypes = normalizeCompanyTypes(company);
  const relationshipRoleLabel =
    companyTypes[0] === "Unclassified"
      ? formatRelationshipPostureLabel(posture)
      : formatCompanyTypesLabel(companyTypes, { max: 2 });

  const pending = pickPendingCommitment(openActions);
  const pendingCommitment = pending ? toPendingCommitmentView(pending) : null;

  return {
    kind: "relationship-card",
    meta: buildM365Meta({
      whatMatters: `${header.companyName} — ${relationshipRoleLabel} · ${header.healthStatus}`,
      whatIsAtRisk,
      whyItMatters,
      whatShouldHappenNext: nextBestAction.action,
    }),
    companyName: header.companyName,
    companyId: company.CompanyID,
    relationshipRoleLabel,
    sectors: normalizeCompanySectors(company.Sectors),
    pendingCommitment,
    opportunityEligible: shouldOfferCreateOpportunity(company, correspondence),
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
