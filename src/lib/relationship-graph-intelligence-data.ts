import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { company360Href } from "@/types/company-360";
import { smartDocHref, smartDocFromPipeline } from "@/types/smartdoc";
import { getContactDisplayName } from "@/types/contact";
import { buildCompany360Snapshot } from "@/lib/company-360-data";
import { buildCompanyRelationshipGraph } from "@/lib/relationship-graph-engine";
import { computeDocumentIntelligence } from "@/lib/document-intelligence-engine";
import { buildSmartDocRegistry } from "@/lib/smartdoc-registry";
import type { InventoryDb } from "@/lib/inventory-data";
import { defaultInventory } from "@/lib/inventory-data";
import { getActivitiesForCompany } from "@/lib/activity-utils";

export type GraphNetworkRankItem = {
  id: string;
  label: string;
  subtitle: string;
  metric: number;
  metricLabel: string;
  href: string;
};

export type RelationshipGraphIntelligenceOverview = {
  totalNetworks: number;
  totalConnections: number;
  avgNetworkSize: number;
  companiesWithGaps: number;
};

export type RelationshipGraphIntelligenceSnapshot = {
  generatedAt: string;
  overview: RelationshipGraphIntelligenceOverview;
  mostConnectedCompanies: GraphNetworkRankItem[];
  mostInfluentialContacts: GraphNetworkRankItem[];
  mostCriticalDocuments: GraphNetworkRankItem[];
  largestNetworks: GraphNetworkRankItem[];
};

function emptyInventory(): InventoryDb {
  return defaultInventory;
}

export function buildRelationshipGraphIntelligence(
  companies: Company[],
  pipelines: PipelineRow[],
  activities: Activity[],
): RelationshipGraphIntelligenceSnapshot {
  const contactInfluence = new Map<string, { name: string; company: string; count: number }>();
  const documentCriticality: GraphNetworkRankItem[] = [];
  const networkSizes: GraphNetworkRankItem[] = [];
  let totalConnections = 0;
  let companiesWithGaps = 0;

  const allDocs = buildSmartDocRegistry(pipelines, activities);

  for (const company of companies) {
    const companyActivities = getActivitiesForCompany(activities, company);
    const snapshot = buildCompany360Snapshot(
      company,
      pipelines.filter((p) => company.pipelineIds.includes(p.id)),
      companyActivities,
      emptyInventory(),
    );

    const docIntel = snapshot.documents
      .map((doc) => {
        const record = smartDocFromPipeline(doc);
        if (!record) return null;
        return computeDocumentIntelligence(record, pipelines, companies, activities);
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);

    const graph = buildCompanyRelationshipGraph(company, snapshot, docIntel, companyActivities);

    totalConnections += graph.stats.edgeCount;
    if (graph.insights.some((i) => i.type === "relationship_gap")) {
      companiesWithGaps += 1;
    }

    networkSizes.push({
      id: company.CompanyID,
      label: company.Title,
      subtitle: `${graph.stats.contactCount} contacts · ${graph.stats.opportunityCount} deals`,
      metric: graph.stats.edgeCount,
      metricLabel: "connections",
      href: company360Href(company.CompanyID),
    });

    for (const contact of company.contacts) {
      const name = getContactDisplayName(contact);
      const count = companyActivities.filter(
        (a) => a.Contact?.Title === name || a.Contact?.Title?.includes(contact.FirstName),
      ).length;
      const key = contact.ContactID;
      const existing = contactInfluence.get(key);
      if (!existing || count > existing.count) {
        contactInfluence.set(key, { name, company: company.Title, count });
      }
    }
  }

  for (const doc of allDocs) {
    const intel = computeDocumentIntelligence(doc, pipelines, companies, activities);
    const criticalScore =
      (intel.insights.businessImpactLevel === "Critical" ? 40 : 0) +
      (intel.insights.businessImpactLevel === "High" ? 25 : 0) +
      (100 - intel.healthScore) +
      intel.risks.length * 10;

    if (criticalScore >= 30) {
      documentCriticality.push({
        id: doc.id,
        label: doc.displayName,
        subtitle: `${intel.insights.businessImpactLevel} impact · ${intel.healthStatus}`,
        metric: criticalScore,
        metricLabel: "criticality",
        href: smartDocHref(doc.id),
      });
    }
  }

  const mostConnectedCompanies = [...networkSizes]
    .sort((a, b) => b.metric - a.metric)
    .slice(0, 8);

  const mostInfluentialContacts = [...contactInfluence.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((c, i) => ({
      id: `contact-${i}-${c.name}`,
      label: c.name,
      subtitle: c.company,
      metric: c.count,
      metricLabel: "activities",
      href: "/contacts",
    }));

  const mostCriticalDocuments = [...documentCriticality]
    .sort((a, b) => b.metric - a.metric)
    .slice(0, 8);

  const largestNetworks = [...networkSizes]
    .sort((a, b) => b.metric - a.metric)
    .slice(0, 8);

  return {
    generatedAt: new Date().toISOString(),
    overview: {
      totalNetworks: companies.length,
      totalConnections,
      avgNetworkSize:
        companies.length === 0 ? 0 : Math.round(totalConnections / companies.length),
      companiesWithGaps,
    },
    mostConnectedCompanies,
    mostInfluentialContacts,
    mostCriticalDocuments,
    largestNetworks,
  };
}
