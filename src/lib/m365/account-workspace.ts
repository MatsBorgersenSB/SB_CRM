import { buildCompany360Snapshot } from "@/lib/company-360-data";
import { computeOpportunityIntelligence } from "@/lib/opportunity-intelligence-engine";
import { computeDocumentIntelligence } from "@/lib/document-intelligence-engine";
import { buildDocumentImpactLines } from "@/lib/impact-context";
import { formatDealValue } from "@/types/pipeline";
import { formatRelativeTime } from "@/lib/relative-time";
import { buildM365Meta, ensureImpact } from "@/lib/m365/meta";
import { toM365Action, toM365RiskFromCompanySignal } from "@/lib/m365/blocks";
import type { M365DataContext } from "@/lib/m365/resolve-context";
import type { Company } from "@/types/company";
import type { M365AccountWorkspacePayload, M365KnowledgeRiskBlock } from "@/types/m365";
import { M365_BUDGETS, capItems } from "@/types/m365";
import { company360Href } from "@/types/company-360";
import { smartDocFromPipeline, smartDocHref } from "@/types/smartdoc";

export function buildM365AccountWorkspace(
  company: Company,
  ctx: M365DataContext,
): M365AccountWorkspacePayload {
  const snapshot = buildCompany360Snapshot(
    company,
    ctx.pipelines,
    ctx.activities,
    ctx.inventory,
  );

  const { header, intelligence, pipelines, activities } = snapshot;
  const topRiskSignal = intelligence.riskSignals[0];
  const topRisk = topRiskSignal ? toM365RiskFromCompanySignal(topRiskSignal) : null;

  const openOpportunities = capItems(
    pipelines.map((pipeline) => {
      const intel = computeOpportunityIntelligence(
        pipeline,
        [company],
        ctx.activities,
        ctx.pipelines,
      );
      return {
        id: intel.dealId,
        label: intel.dealName,
        stage: intel.stage,
        valueLabel: formatDealValue(intel.currency, intel.salesValue),
        healthScore: intel.healthScore,
        impact: ensureImpact([intel.healthSummary, intel.nextBestAction.reason], intel.dealName),
        href: company360Href(company.CompanyID, "opportunities"),
      };
    }),
    M365_BUDGETS.accountWorkspace.maxOpportunities,
  );

  const recentActivity = capItems(
    activities.slice(0, M365_BUDGETS.accountWorkspace.maxRecentActivity).map((activity) => ({
      id: activity.ActivityID,
      label: activity.Subject,
      occurredLabel: formatRelativeTime(activity.ActivityDate),
      href: `/activities/${activity.ActivityID}`,
    })),
    M365_BUDGETS.accountWorkspace.maxRecentActivity,
  );

  const knowledgeAtRisk = capItems(
    buildKnowledgeAtRisk(snapshot, company, ctx),
    M365_BUDGETS.accountWorkspace.maxKnowledgeAtRisk,
  );

  const nextBestAction = toM365Action(intelligence.recommendedAction, company.CompanyID);

  return {
    kind: "account-workspace",
    meta: buildM365Meta({
      whatMatters: `${header.companyName} — ${header.healthStatus} account`,
      whatIsAtRisk: topRisk?.label ?? "No critical account risks",
      whyItMatters: topRisk?.impact ?? [snapshot.summary.healthReport.summary],
      whatShouldHappenNext: nextBestAction.action,
    }),
    companyName: header.companyName,
    health: {
      score: header.healthScore,
      status: header.healthStatus,
      trend: header.trend,
    },
    relationshipSnapshot: snapshot.summary.healthReport.summary,
    lastContactLabel: header.lastContactLabel,
    nextBestAction,
    topRisk,
    openOpportunities,
    recentActivity,
    knowledgeAtRisk,
    deepLink: company360Href(company.CompanyID),
  };
}

function buildKnowledgeAtRisk(
  snapshot: ReturnType<typeof buildCompany360Snapshot>,
  company: Company,
  ctx: M365DataContext,
): M365KnowledgeRiskBlock[] {
  const items: M365KnowledgeRiskBlock[] = [];

  for (const doc of snapshot.documents) {
    const record = smartDocFromPipeline(doc);
    if (!record) continue;

    const intel = computeDocumentIntelligence(
      record,
      ctx.pipelines,
      [company],
      ctx.activities,
    );

    if (intel.healthScore >= 60 && intel.risks.length === 0) continue;

    items.push({
      id: record.id,
      label: record.displayName,
      impact: buildDocumentImpactLines({
        companyCount: 1,
        opportunityCount: record.pipelineId ? 1 : 0,
        referenceCount: intel.referenceCount,
        businessImpactLevel: intel.insights.businessImpactLevel,
        riskCount: intel.risks.length,
      }),
      href: smartDocHref(record.id),
    });
  }

  return items.sort((a, b) => a.impact.length - b.impact.length).reverse();
}
