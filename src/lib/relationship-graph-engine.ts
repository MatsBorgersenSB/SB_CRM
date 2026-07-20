import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { formatDealValue, formatReactorCapacity } from "@/types/pipeline";
import { getContactDisplayName } from "@/types/contact";
import { smartDocHref, smartDocFromPipeline } from "@/types/smartdoc";
import { company360Href } from "@/types/company-360";
import type {
  CompanyRelationshipGraph,
  GraphDependency,
  GraphEdge,
  GraphEdgeKind,
  GraphEntityKind,
  GraphInsight,
  GraphNode,
  GraphNodeRiskLevel,
  GraphRiskType,
} from "@/types/relationship-graph";
import type { Company360Snapshot } from "@/lib/company-360-data";
import {
  computeMissingDocumentsForCompany,
  type DocumentIntelligence,
} from "@/lib/document-intelligence-engine";
import { buildSmartDocRegistry } from "@/lib/smartdoc-registry";
import { daysBetween } from "@/lib/relative-time";

const CANVAS = { width: 800, height: 560, cx: 400, cy: 280 };
const RING_RADIUS: Record<number, number> = {
  0: 0,
  1: 95,
  2: 155,
  3: 200,
  4: 235,
  5: 260,
};

function riskFromScore(score: number | undefined): GraphNodeRiskLevel {
  if (score === undefined) return "none";
  if (score < 25) return "critical";
  if (score < 40) return "high";
  if (score < 60) return "medium";
  if (score < 75) return "low";
  return "none";
}

function polarPosition(ring: number, index: number, total: number): { x: number; y: number; angle: number; radius: number } {
  const radius = RING_RADIUS[ring] ?? 260;
  const angle = total <= 1 ? -Math.PI / 2 : (index / total) * Math.PI * 2 - Math.PI / 2;
  return {
    angle,
    radius,
    x: CANVAS.cx + Math.cos(angle) * radius,
    y: CANVAS.cy + Math.sin(angle) * radius,
  };
}

function nodeSize(kind: GraphEntityKind, strength?: number): number {
  if (kind === "company") return 36;
  if (kind === "opportunity") return 14 + Math.min(10, (strength ?? 0) / 10);
  return 10 + Math.min(6, (strength ?? 0) / 15);
}

function buildNode(
  id: string,
  kind: GraphEntityKind,
  label: string,
  ring: number,
  index: number,
  total: number,
  opts: Partial<GraphNode> = {},
): GraphNode {
  const pos = polarPosition(ring, index, total);
  return {
    id,
    kind,
    label,
    ring,
    angle: pos.angle,
    radius: pos.radius,
    x: pos.x,
    y: pos.y,
    riskLevel: "none",
    dependencyCount: 0,
    size: nodeSize(kind, opts.healthScore),
    ...opts,
  };
}

function activityCountForContact(contactId: string, activities: Activity[]): number {
  return activities.filter((a) => a.Contact?.Title === contactId || a.Contact?.Title?.includes(contactId)).length;
}

function activityCountForDeal(dealId: string, activities: Activity[]): number {
  return activities.filter((a) => a.Deal?.Title === dealId).length;
}

function edgeStrength(
  activityCount: number,
  healthScore?: number,
  valueBoost = 0,
): number {
  let strength = Math.min(100, activityCount * 18 + valueBoost);
  if (healthScore !== undefined) {
    strength = Math.round(strength * 0.6 + healthScore * 0.4);
  }
  return Math.max(15, Math.min(100, strength));
}

function addEdge(
  edges: GraphEdge[],
  sourceId: string,
  targetId: string,
  kind: GraphEdgeKind,
  strength: number,
  label?: string,
): void {
  edges.push({
    id: `edge-${sourceId}-${targetId}-${kind}`,
    sourceId,
    targetId,
    kind,
    strength,
    label,
  });
}

function detectGraphInsights(
  company: Company,
  snapshot: Company360Snapshot,
  documentIntelligences: DocumentIntelligence[],
  activities: Activity[],
): GraphInsight[] {
  const insights: GraphInsight[] = [];
  const healthReport = snapshot.intelligence.healthReport;

  if (company.contacts.length === 1) {
    insights.push({
      id: `${company.CompanyID}-single-contact`,
      type: "single_contact",
      label: "Single contact risk",
      detail: "Only one contact — relationship depends on a single person",
      severity: "warning",
    });
  }

  if (company.contacts.length < 2 && snapshot.pipelines.length > 0) {
    insights.push({
      id: `${company.CompanyID}-missing-stakeholders`,
      type: "missing_stakeholders",
      label: "Missing stakeholders",
      detail: "Active opportunities without diverse stakeholder coverage",
      severity: company.contacts.length === 0 ? "critical" : "warning",
    });
  }

  const allDocs = buildSmartDocRegistry(snapshot.pipelines, activities);
  const missing = computeMissingDocumentsForCompany(company, snapshot.pipelines, allDocs);
  if (missing.criticalCount > 0) {
    insights.push({
      id: `${company.CompanyID}-missing-docs`,
      type: "missing_documents",
      label: "Missing documents",
      detail: `${missing.criticalCount} critical document gap${missing.criticalCount === 1 ? "" : "s"} in the network`,
      severity: "critical",
    });
  }

  const diversity = healthReport.components.find((c) => c.id === "contact_diversity");
  if (diversity && diversity.score < 50) {
    insights.push({
      id: `${company.CompanyID}-weak-coverage`,
      type: "weak_coverage",
      label: "Weak coverage",
      detail: `Contact diversity score ${diversity.score} — limited relationship breadth`,
      severity: diversity.score < 30 ? "critical" : "warning",
    });
  }

  for (const deal of snapshot.pipelines) {
    const dealActivities = activityCountForDeal(deal.id, activities);
    if (dealActivities === 0) {
      insights.push({
        id: `${company.CompanyID}-gap-${deal.id}`,
        type: "relationship_gap",
        label: "Relationship gap",
        detail: `${deal.assetName} has no activity trail in the graph`,
        severity: "warning",
      });
    }
  }

  const atRiskDocs = documentIntelligences.filter(
    (d) => d.healthScore < 60 || d.risks.length > 0,
  );
  if (atRiskDocs.length > 0) {
    insights.push({
      id: `${company.CompanyID}-knowledge-risk`,
      type: "knowledge_risk",
      label: "Knowledge at risk",
      detail: `${atRiskDocs.length} document${atRiskDocs.length === 1 ? "" : "s"} with health or compliance risks`,
      severity: atRiskDocs.some((d) => d.insights.businessImpactLevel === "Critical")
        ? "critical"
        : "warning",
    });
  }

  return insights.slice(0, 8);
}

export function buildCompanyRelationshipGraph(
  company: Company,
  snapshot: Company360Snapshot,
  documentIntelligences: DocumentIntelligence[],
  activities: Activity[],
): CompanyRelationshipGraph {
  const centerId = `company-${company.CompanyID}`;
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const dependencies: GraphDependency[] = [];

  const centerNode = buildNode(centerId, "company", company.Title, 0, 0, 1, {
    subtitle: snapshot.header.companyTypesLabel,
    href: company360Href(company.CompanyID),
    healthScore: snapshot.header.healthScore,
    healthLabel: snapshot.header.healthStatus,
    riskLevel: riskFromScore(snapshot.header.healthScore),
    impact: `${snapshot.header.openOpportunities} opportunities · ${company.contacts.length} contacts`,
    size: 38,
  });
  nodes.push(centerNode);

  company.contacts.forEach((contact, i) => {
    const contactId = `contact-${contact.ContactID}`;
    const name = getContactDisplayName(contact);
    const actCount = activityCountForContact(contact.ContactID, activities);
    const strength = edgeStrength(actCount, snapshot.header.healthScore);

    nodes.push(
      buildNode(contactId, "contact", name, 1, i, company.contacts.length, {
        subtitle: contact.JobTitle || contact.Role || "Contact",
        healthScore: Math.min(100, 40 + actCount * 15),
        healthLabel: actCount >= 3 ? "Engaged" : actCount >= 1 ? "Active" : "Dormant",
        riskLevel: actCount === 0 ? "medium" : "none",
        impact: `${actCount} activit${actCount === 1 ? "y" : "ies"}`,
        dependencyCount: actCount,
      }),
    );
    addEdge(edges, centerId, contactId, "ownership", strength, "stakeholder");
    dependencies.push({
      id: `dep-${centerId}-${contactId}`,
      fromLabel: company.Title,
      toLabel: name,
      kind: "ownership",
      strength,
    });
  });

  snapshot.pipelines.forEach((deal, i) => {
    const dealId = `opp-${deal.id}`;
    const actCount = activityCountForDeal(deal.id, activities);
    const valueBoost = Math.min(40, Math.round(deal.salesValue / 100_000));
    const strength = edgeStrength(actCount, snapshot.header.healthScore, valueBoost);

    nodes.push(
      buildNode(dealId, "opportunity", deal.assetName, 2, i, snapshot.pipelines.length, {
        subtitle: deal.status,
        href: `/deals`,
        healthScore: actCount >= 2 ? 75 : actCount >= 1 ? 55 : 30,
        healthLabel: deal.status,
        riskLevel: actCount === 0 ? "high" : riskFromScore(actCount >= 2 ? 70 : 45),
        impact: formatDealValue(deal.currency, deal.salesValue),
        dependencyCount: actCount,
      }),
    );
    addEdge(edges, centerId, dealId, "dependency", strength, "opportunity");
    dependencies.push({
      id: `dep-${centerId}-${dealId}`,
      fromLabel: company.Title,
      toLabel: deal.assetName,
      kind: "dependency",
      strength,
    });
  });

  const recentActivities = [...snapshot.activities]
    .sort((a, b) => new Date(b.ActivityDate).getTime() - new Date(a.ActivityDate).getTime())
    .slice(0, 8);

  recentActivities.forEach((activity, i) => {
    const actId = `activity-${activity.ActivityID}`;
    const recency = daysBetween(activity.ActivityDate);
    const strength = Math.max(20, 100 - recency);

    nodes.push(
      buildNode(actId, "activity", activity.Subject.slice(0, 28), 3, i, recentActivities.length, {
        subtitle: activity.ActivityType,
        href: `/activities/${activity.ActivityID}`,
        healthLabel: `${recency}d ago`,
        riskLevel: recency > 60 ? "medium" : "none",
        impact: activity.ActivityType,
        dependencyCount: 1,
      }),
    );
    addEdge(edges, centerId, actId, "activity", strength, "interaction");

    const linkedContact = activity.Contact?.Title;
    if (linkedContact) {
      const contactNode = nodes.find(
        (n) => n.kind === "contact" && n.label.includes(linkedContact.split(" ")[0] ?? ""),
      );
      if (contactNode) {
        addEdge(edges, contactNode.id, actId, "reference", strength, "contact activity");
      }
    }

    const linkedDeal = activity.Deal?.Title;
    if (linkedDeal) {
      const dealNode = nodes.find((n) => n.id === `opp-${linkedDeal}`);
      if (dealNode) {
        addEdge(edges, dealNode.id, actId, "reference", strength, "deal activity");
      }
    }
  });

  snapshot.documents.forEach((doc, i) => {
    const record = smartDocFromPipeline(doc);
    if (!record) return;
    const intel = documentIntelligences.find((d) => d.document.id === record.id);
    const docId = `doc-${record.id}`;
    const refCount = intel?.referenceCount ?? 0;
    const strength = edgeStrength(refCount, intel?.healthScore, 0);

    nodes.push(
      buildNode(docId, "document", record.displayName.slice(0, 24), 4, i, snapshot.documents.length, {
        subtitle: `${record.docCategory} · Rev ${record.revision}`,
        href: smartDocHref(record.id),
        healthScore: intel?.healthScore,
        healthLabel: intel?.healthStatus,
        riskLevel: intel ? riskFromScore(intel.healthScore) : "medium",
        impact: intel?.insights.businessImpactLevel ?? "Unknown",
        dependencyCount: refCount,
      }),
    );
    addEdge(edges, centerId, docId, "reference", strength, "document");
    dependencies.push({
      id: `dep-${centerId}-${docId}`,
      fromLabel: company.Title,
      toLabel: record.displayName,
      kind: "reference",
      strength,
    });
  });

  snapshot.materials.forEach((material, i) => {
    const matId = `material-${material.dealId}`;
    const strength = edgeStrength(2, snapshot.header.healthScore, 10);

    nodes.push(
      buildNode(matId, "material", material.feedstock, 5, i, snapshot.materials.length, {
        subtitle: material.dealName,
        healthLabel: material.status,
        riskLevel: "none",
        impact: formatReactorCapacity(material.capacityKgH),
        dependencyCount: 1,
      }),
    );
    addEdge(edges, centerId, matId, "material", strength, "feedstock");
    const dealNode = nodes.find((n) => n.id === `opp-${material.dealId}`);
    if (dealNode) {
      addEdge(edges, dealNode.id, matId, "material", strength, "material track");
    }
  });

  for (const node of nodes) {
    node.dependencyCount = edges.filter((e) => e.sourceId === node.id || e.targetId === node.id).length;
  }

  const insights = detectGraphInsights(company, snapshot, documentIntelligences, activities);
  const avgEdgeStrength =
    edges.length === 0
      ? 0
      : Math.round(edges.reduce((s, e) => s + e.strength, 0) / edges.length);

  const criticalCount = insights.filter((i) => i.severity === "critical").length;

  return {
    companyId: company.CompanyID,
    companyName: company.Title,
    nodes,
    edges,
    dependencies,
    insights,
    summary:
      criticalCount > 0
        ? `${nodes.length} nodes · ${edges.length} connections · ${criticalCount} critical graph signal${criticalCount === 1 ? "" : "s"}`
        : `${nodes.length} nodes · ${edges.length} connections · network ${avgEdgeStrength >= 60 ? "strong" : "developing"}`,
    stats: {
      contactCount: company.contacts.length,
      opportunityCount: snapshot.pipelines.length,
      activityCount: snapshot.activities.length,
      documentCount: snapshot.documents.length,
      materialCount: snapshot.materials.length,
      edgeCount: edges.length,
      avgEdgeStrength,
    },
  };
}

export function getGraphInsightExplanation(type: GraphRiskType): string {
  const explanations: Record<GraphRiskType, string> = {
    single_contact: "Relationship depends on one person — high key-person risk",
    missing_stakeholders: "Insufficient contacts for active commercial engagement",
    missing_documents: "Required knowledge assets missing from the network",
    weak_coverage: "Low contact diversity limits relationship resilience",
    relationship_gap: "Entity exists without connecting activity trail",
    knowledge_risk: "Documents in the graph carry health or compliance risk",
  };
  return explanations[type];
}
