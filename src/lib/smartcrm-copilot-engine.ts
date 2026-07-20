import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type {
  CompanyCopilotSummary,
  CopilotBriefing,
  CopilotEnhancementProvider,
  CopilotRecommendation,
  CopilotSource,
  DailyBriefing,
  DocumentCopilotSummary,
  OpportunityCopilotSummary,
} from "@/types/smartcrm-copilot";
import type { Company360Snapshot } from "@/lib/company-360-data";
import type { Document360Snapshot } from "@/lib/document-360-data";
import type { OpportunityCommandCenterSnapshot } from "@/lib/opportunity-command-center-data";
import { buildRelationshipCommandCenter } from "@/lib/relationship-intelligence";
import { buildSmartDocsIntelligence } from "@/lib/smartdocs-intelligence-data";
import { buildOpportunityCommandCenter } from "@/lib/opportunity-command-center-data";
import {
  computeOpportunityIntelligence,
  type OpportunityIntelligence,
} from "@/lib/opportunity-intelligence-engine";
import { buildCompanyRelationshipGraph } from "@/lib/relationship-graph-engine";
import { computeDocumentIntelligence } from "@/lib/document-intelligence-engine";
import { buildRelationshipMemory } from "@/lib/relationship-memory";
import { formatRelativeTime } from "@/lib/relative-time";
import { company360Href } from "@/types/company-360";
import { smartDocFromPipeline, smartDocHref } from "@/types/smartdoc";
import { isFollowUpOpen } from "@/lib/activity-utils";

let enhancementProvider: CopilotEnhancementProvider | null = null;

/** Extension point for Azure OpenAI — enhances rule-based briefings with narrative polish. */
export function registerCopilotEnhancementProvider(
  provider: CopilotEnhancementProvider,
): void {
  enhancementProvider = provider;
}

export async function enhanceCopilotBriefing(
  briefing: CopilotBriefing,
): Promise<CopilotBriefing> {
  if (!enhancementProvider) return briefing;
  return enhancementProvider(briefing);
}

function toRecommendation(
  action: string,
  reason: string,
  priority: "High" | "Medium" | "Low",
  href?: string,
): CopilotRecommendation {
  return { action, reason, priority, href };
}

export function buildDailyBriefing(
  companies: Company[],
  pipelines: PipelineRow[],
  activities: Activity[],
  source: CopilotSource = "rule",
): DailyBriefing {
  const commandCenter = buildRelationshipCommandCenter(companies, pipelines, activities);
  const smartDocs = buildSmartDocsIntelligence(pipelines, companies, activities);
  const oppCenter = buildOpportunityCommandCenter(pipelines, companies, activities);

  const relationshipsAttention = commandCenter.relationshipsNeedingAttention
    .slice(0, 6)
    .map((item) => ({
      id: `rel-${item.companyId}`,
      label: item.companyName,
      detail: item.detail,
      href: item.href,
      severity:
        item.priority === "critical"
          ? ("critical" as const)
          : item.priority === "high"
            ? ("warning" as const)
            : ("info" as const),
    }));

  const opportunitiesAtRisk = oppCenter.dealsAtRisk.slice(0, 6).map((deal) => ({
    id: `opp-${deal.dealId}`,
    label: deal.dealName,
    detail: `${deal.healthStatus} · ${deal.healthSummary}`,
    href: deal.href,
    severity: deal.healthStatus === "At Risk" ? ("critical" as const) : ("warning" as const),
  }));

  const knowledgeRisks = smartDocs.knowledgeAtRisk.slice(0, 6).map((doc) => ({
    id: `doc-${doc.document.id}`,
    label: doc.document.displayName,
    detail: `${doc.insights.businessImpactLevel} impact · health ${doc.healthScore}`,
    href: doc.href,
    severity: doc.insights.businessImpactLevel === "Critical" ? ("critical" as const) : ("warning" as const),
  }));

  const recommendedFocus = commandCenter.nextBestActions.slice(0, 4).map((nba) =>
    toRecommendation(
      nba.action,
      nba.reason,
      nba.priority,
      company360Href(nba.companyId, "attention"),
    ),
  );

  const attentionCount = relationshipsAttention.length + opportunitiesAtRisk.length;

  return {
    kind: "daily",
    context: "dashboard",
    generatedAt: new Date().toISOString(),
    headline:
      attentionCount > 0
        ? `${attentionCount} item${attentionCount === 1 ? "" : "s"} need your attention today`
        : "Portfolio is stable — maintain relationship momentum",
    relationshipsAttention,
    opportunitiesAtRisk,
    knowledgeRisks,
    recommendedFocus,
    source,
  };
}

export function buildCompanyCopilotSummary(
  snapshot: Company360Snapshot,
  activities: Activity[],
  source: CopilotSource = "rule",
): CompanyCopilotSummary {
  const { company, header, intelligence, openActions, summary } = snapshot;

  const docIntel = snapshot.documents
    .map((doc) => {
      const record = smartDocFromPipeline(doc);
      if (!record) return null;
      return computeDocumentIntelligence(record, snapshot.pipelines, [company], activities);
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  const graphData = buildCompanyRelationshipGraph(company, snapshot, docIntel, activities);

  const risks = [
    ...intelligence.riskSignals.map((r) => ({
      id: r.id,
      label: r.label,
      detail: r.detail,
      severity: r.severity,
    })),
    ...graphData.insights.map((i) => ({
      id: i.id,
      label: i.label,
      detail: i.detail,
      severity: i.severity,
    })),
  ].slice(0, 8);

  const openCommitments = openActions.slice(0, 6).map((a) => ({
    id: `commit-${a.ActivityID}`,
    label: a.NextAction || a.Subject,
    detail: a.NextActionDate
      ? `Due ${formatRelativeTime(a.NextActionDate)}`
      : "Open commitment",
    href: `/activities/${a.ActivityID}`,
    severity:
      a.NextActionDate && new Date(a.NextActionDate) < new Date()
        ? ("critical" as const)
        : ("warning" as const),
  }));

  const activityMemory = snapshot.activities.slice(0, 4).flatMap((activity) => {
    const memory = buildRelationshipMemory(activity);
    if (!memory.hasRichMemory && !memory.whatHappensNext) return [];
    return [
      {
        id: `mem-${activity.ActivityID}`,
        label: activity.Subject,
        detail: memory.whatHappensNext ?? memory.whatHappened.slice(0, 120),
        href: `/activities/${activity.ActivityID}`,
        severity: isFollowUpOpen(activity) ? ("warning" as const) : ("info" as const),
      },
    ];
  });

  const recommendedActions = [
    toRecommendation(
      intelligence.recommendedAction.action,
      intelligence.recommendedAction.reason,
      intelligence.recommendedAction.priority,
      company360Href(company.CompanyID, "attention"),
    ),
    ...intelligence.suggestedActions.slice(0, 2).map((s, i) =>
      toRecommendation(s, "Suggested from relationship intelligence", "Medium"),
    ),
  ];

  return {
    kind: "company",
    context: "company",
    generatedAt: new Date().toISOString(),
    headline: `${company.Title} — ${header.healthStatus} relationship`,
    companyId: company.CompanyID,
    companyName: company.Title,
    relationshipSummary: summary.healthReport.summary,
    healthScore: header.healthScore,
    healthStatus: header.healthStatus,
    risks,
    openCommitments,
    activityMemory,
    recommendedActions,
    source,
  };
}

export function buildOpportunityPortfolioCopilot(
  oppSnapshot: OpportunityCommandCenterSnapshot,
  source: CopilotSource = "rule",
): OpportunityCopilotSummary {
  const risks = oppSnapshot.dealsAtRisk.slice(0, 6).flatMap((deal) =>
    deal.risks.map((r) => ({
      id: r.id,
      label: `${deal.dealName}: ${r.label}`,
      detail: r.detail,
      href: deal.href,
      severity: r.severity,
    })),
  ).slice(0, 8);

  const opportunitiesAtRisk = oppSnapshot.dealsAtRisk.slice(0, 6).map((deal) => ({
    id: deal.dealId,
    label: deal.dealName,
    detail: `${deal.winProbability}% win · ${deal.momentum} · ${deal.healthStatus}`,
    href: deal.href,
    severity: deal.healthStatus === "At Risk" ? ("critical" as const) : ("warning" as const),
  }));

  const recommendedActions = oppSnapshot.dealsAtRisk
    .slice(0, 3)
    .map((deal) =>
      toRecommendation(
        deal.nextBestAction.action,
        deal.nextBestAction.reason,
        deal.nextBestAction.priority,
        deal.href,
      ),
    );

  return {
    kind: "opportunity",
    context: "opportunity",
    generatedAt: new Date().toISOString(),
    headline: `${oppSnapshot.dealsAtRisk.length} opportunit${oppSnapshot.dealsAtRisk.length === 1 ? "y" : "ies"} at risk in portfolio`,
    portfolioMode: true,
    risks,
    opportunitiesAtRisk,
    recommendedActions,
    source,
  };
}

export function buildOpportunityCopilotSummary(
  intelligence: OpportunityIntelligence,
  source: CopilotSource = "rule",
): OpportunityCopilotSummary {
  return {
    kind: "opportunity",
    context: "opportunity",
    generatedAt: new Date().toISOString(),
    headline: `${intelligence.dealName} — ${intelligence.healthStatus}`,
    portfolioMode: false,
    healthScore: intelligence.healthScore,
    healthStatus: intelligence.healthStatus,
    winProbability: intelligence.winProbability,
    momentum: intelligence.momentum,
    risks: intelligence.risks.map((r) => ({
      id: r.id,
      label: r.label,
      detail: r.detail,
      severity: r.severity,
    })),
    opportunitiesAtRisk: [],
    recommendedActions: [
      toRecommendation(
        intelligence.nextBestAction.action,
        intelligence.nextBestAction.reason,
        intelligence.nextBestAction.priority,
        intelligence.companyId
          ? company360Href(intelligence.companyId, "opportunities")
          : "/deals",
      ),
    ],
    source,
  };
}

export function buildDocumentCopilotSummary(
  snapshot: Document360Snapshot,
  source: CopilotSource = "rule",
): DocumentCopilotSummary {
  const { intelligence, header, document } = snapshot;
  const { insights, risks } = intelligence;

  const dependencies = [
    ...snapshot.companies.map((c) => ({
      id: `dep-co-${c.CompanyID}`,
      label: c.Title,
      detail: "Linked company",
      href: company360Href(c.CompanyID),
      severity: "info" as const,
    })),
    ...snapshot.contacts.slice(0, 4).map((c) => ({
      id: `dep-ct-${c.contactId}`,
      label: c.name,
      detail: c.companyName,
      severity: "info" as const,
    })),
    ...(snapshot.pipeline
      ? [
          {
            id: `dep-opp-${snapshot.pipeline.id}`,
            label: snapshot.pipeline.assetName,
            detail: snapshot.pipeline.status,
            href: "/deals",
            severity: "info" as const,
          },
        ]
      : []),
  ];

  return {
    kind: "document",
    context: "document",
    generatedAt: new Date().toISOString(),
    headline: `${header.displayName} — ${insights.businessImpactLevel} impact`,
    documentId: document.id,
    documentName: header.displayName,
    businessImpact: insights.businessImpact,
    impactLevel: insights.businessImpactLevel,
    dependencies,
    risks: risks.map((r) => ({
      id: r.id,
      label: r.label,
      detail: r.detail,
      severity: r.severity,
    })),
    recommendations: [
      toRecommendation(
        intelligence.nextBestAction.action,
        intelligence.nextBestAction.reason,
        intelligence.nextBestAction.priority,
        smartDocHref(document.id),
      ),
    ],
    source,
  };
}

export function getCopilotExplanation(): string {
  return (
    "SmartCRM Copilot synthesizes Relationship Health, Next Best Actions, Opportunity Intelligence, " +
    "SmartDocs Intelligence, Relationship Graph, and Activity Memory. Rule-based V1 — Azure OpenAI ready."
  );
}
