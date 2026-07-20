import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { smartDocHref } from "@/types/smartdoc";
import {
  computeAllDocumentIntelligence,
  type DocumentIntelligence,
} from "@/lib/document-intelligence-engine";
import { buildSmartDocRegistry } from "@/lib/smartdoc-registry";
import { isKnowledgeAtRisk } from "@/lib/smartdoc-timeline";

export type SmartDocsIntelligenceItem = DocumentIntelligence & {
  href: string;
  subtitle: string;
};

export type SmartDocsIntelligenceOverview = {
  totalDocuments: number;
  atRiskCount: number;
  expiringCount: number;
  reviewQueueCount: number;
  criticalMissingCount: number;
  knowledgeAtRiskCount: number;
  averageHealthScore: number;
};

export type SmartDocsIntelligenceSnapshot = {
  generatedAt: string;
  overview: SmartDocsIntelligenceOverview;
  documentRisks: SmartDocsIntelligenceItem[];
  expiringCertificates: SmartDocsIntelligenceItem[];
  reviewQueue: SmartDocsIntelligenceItem[];
  knowledgeAtRisk: SmartDocsIntelligenceItem[];
  missingCriticalDocuments: Array<{
    id: string;
    entityName: string;
    entityKind: "company" | "deal";
    label: string;
    detail: string;
    href: string;
  }>;
  mostReferenced: SmartDocsIntelligenceItem[];
  allDocuments: SmartDocsIntelligenceItem[];
};

function toItem(intelligence: DocumentIntelligence): SmartDocsIntelligenceItem {
  return {
    ...intelligence,
    href: smartDocHref(intelligence.document.id),
    subtitle: [
      intelligence.document.docCategory,
      intelligence.document.docType,
      `Rev ${intelligence.document.revision}`,
      `${intelligence.referenceCount} refs`,
    ].join(" · "),
  };
}

export function buildSmartDocsIntelligence(
  pipelines: PipelineRow[],
  companies: Company[],
  activities: Activity[],
): SmartDocsIntelligenceSnapshot {
  const documents = buildSmartDocRegistry(pipelines, activities);
  const intelligences = computeAllDocumentIntelligence(
    pipelines,
    companies,
    activities,
    documents,
  );
  const items = intelligences.map(toItem);

  const documentRisks = items
    .filter((i) => i.risks.length > 0)
    .sort((a, b) => a.healthScore - b.healthScore)
    .slice(0, 8);

  const expiringCertificates = items
    .filter((i) => i.risks.some((r) => r.type === "expiring_certificate"))
    .slice(0, 8);

  const reviewQueue = items
    .filter(
      (i) =>
        i.reviewStatus === "Due" ||
        i.reviewStatus === "Overdue" ||
        i.reviewStatus === "Unknown",
    )
    .sort((a, b) => a.healthScore - b.healthScore)
    .slice(0, 8);

  const knowledgeAtRisk = items
    .filter((i) =>
      isKnowledgeAtRisk(
        i.healthScore,
        i.insights.businessImpactLevel,
        i.risks.length,
      ),
    )
    .sort((a, b) => {
      const impactOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
      const diff =
        impactOrder[a.insights.businessImpactLevel] -
        impactOrder[b.insights.businessImpactLevel];
      if (diff !== 0) return diff;
      return a.healthScore - b.healthScore;
    })
    .slice(0, 8);

  const missingCritical: SmartDocsIntelligenceSnapshot["missingCriticalDocuments"] = [];

  for (const deal of pipelines) {
    const hasDoc = documents.some(
      (d) =>
        (d.pipelineId === deal.id || d.clientLookup === deal.id) &&
        (d.docCategory === "Legal" || d.docCategory === "Compliance"),
    );
    if (
      !hasDoc &&
      ["Contract Negotiation", "Site Installation", "Commissioning Phase"].includes(
        deal.status,
      )
    ) {
      const company = companies.find((c) => c.pipelineIds.includes(deal.id));
      missingCritical.push({
        id: `missing-${deal.id}-legal`,
        entityName: deal.assetName,
        entityKind: "deal",
        label: "Critical document missing",
        detail: `${deal.status} requires Legal/Compliance documentation`,
        href: company
          ? `/companies/${company.CompanyID}#opportunities`
          : "/deals",
      });
    }
  }

  const mostReferenced = [...items]
    .sort((a, b) => b.referenceCount - a.referenceCount)
    .slice(0, 8);

  const averageHealthScore =
    items.length === 0
      ? 0
      : Math.round(items.reduce((s, i) => s + i.healthScore, 0) / items.length);

  return {
    generatedAt: new Date().toISOString(),
    overview: {
      totalDocuments: items.length,
      atRiskCount: items.filter(
        (i) => i.healthStatus === "At Risk" || i.healthStatus === "Weak",
      ).length,
      expiringCount: expiringCertificates.length,
      reviewQueueCount: reviewQueue.length,
      criticalMissingCount: missingCritical.length,
      knowledgeAtRiskCount: knowledgeAtRisk.length,
      averageHealthScore,
    },
    documentRisks,
    expiringCertificates,
    reviewQueue,
    knowledgeAtRisk,
    missingCriticalDocuments: missingCritical.slice(0, 8),
    mostReferenced,
    allDocuments: items,
  };
}
