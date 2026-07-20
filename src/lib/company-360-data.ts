import type { Company } from "@/types/company";
import type { Activity } from "@/types/activity";
import type { PipelineRow } from "@/types/pipeline";
import { formatCompanyLocation } from "@/types/company";
import { formatDealValue } from "@/types/pipeline";
import { sumPipelineValue } from "@/lib/impact-context";
import type { InventoryDb } from "@/lib/inventory-data";
import { getActivitiesForCompany, isFollowUpOpen, isFollowUpOverdue } from "@/lib/activity-utils";
import { getCompanySmartDocs, getLinkedPipelines } from "@/lib/company-utils";
import {
  buildCompanyRelationshipSummary,
  type CompanyRelationshipSummary,
} from "@/lib/relationship-intelligence";
import type { RelationshipHealthReport, RelationshipHealthStatus, RelationshipTrend, RecommendedAction } from "@/lib/relationship-health-engine";
import { daysBetween } from "@/lib/relative-time";
import type { RelationshipIntelligenceExtensions } from "@/types/company-360";
import type { CompanyType } from "@/types/company-type";
import {
  formatCompanyTypesLabel,
  normalizeCompanyTypes,
} from "@/lib/company-classification";

export type Company360Header = {
  companyName: string;
  companyTypes: CompanyType[];
  companyTypesLabel: string;
  industry: Company["Industry"];
  status: Company["Status"];
  healthScore: number;
  healthStatus: RelationshipHealthStatus;
  trend: RelationshipTrend;
  lastContactLabel: string;
  openActions: number;
  openOpportunities: number;
  location: string;
  accountOwner: string | null;
  recommendedAction: RecommendedAction;
};

export type Company360MaterialTrack = {
  dealId: string;
  dealName: string;
  feedstock: string;
  capacityKgH: number;
  status: PipelineRow["status"];
  companyRole: PipelineRow["companyRole"];
  utilizationLabel?: string;
  telemetryLabel?: string;
};

export type Company360RiskSignal = {
  id: string;
  label: string;
  severity: "critical" | "warning" | "info";
  detail: string;
  /** Why should I care? — required for all primary UI surfaces */
  impact: string[];
};

export type Company360IntelligenceView = {
  healthScore: number;
  healthStatus: RelationshipHealthStatus;
  trend: RelationshipTrend;
  healthReport: RelationshipHealthReport;
  riskSignals: Company360RiskSignal[];
  suggestedActions: string[];
  recommendedAction: RecommendedAction;
  extensions: RelationshipIntelligenceExtensions;
};

export type Company360Snapshot = {
  company: Company;
  header: Company360Header;
  summary: CompanyRelationshipSummary;
  activities: Activity[];
  openActions: Activity[];
  pipelines: PipelineRow[];
  documents: PipelineRow[];
  materials: Company360MaterialTrack[];
  intelligence: Company360IntelligenceView;
};

const STALLED_DAYS = 21;
const COLD_CONTACT_DAYS = 45;

function parseActivityDate(value: string): Date {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(normalized);
}

function buildRiskSignals(
  company: Company,
  summary: CompanyRelationshipSummary,
  activities: Activity[],
  pipelines: PipelineRow[],
): Company360RiskSignal[] {
  const signals: Company360RiskSignal[] = [];
  const linkedPipelines = getLinkedPipelines(company, pipelines);
  const pipelineValue = sumPipelineValue(linkedPipelines);
  const pipelineExposure =
    linkedPipelines.length > 0
      ? `${pipelineValue} across ${linkedPipelines.length} opportunit${linkedPipelines.length === 1 ? "y" : "ies"}`
      : "No active pipeline value";

  const overdue = activities.filter(
    (a) =>
      getActivitiesForCompany([a], company).length > 0 && isFollowUpOverdue(a),
  );

  if (overdue.length > 0) {
    signals.push({
      id: "overdue-actions",
      label: "Overdue follow-ups",
      severity: "critical",
      detail: `${overdue.length} open action${overdue.length === 1 ? "" : "s"} past due`,
      impact: [
        "Commitments overdue erode trust and delay deal progress",
        pipelineExposure !== "No active pipeline value"
          ? `${pipelineExposure} depends on timely follow-through`
          : "Relationship momentum at risk without resolution",
      ],
    });
  }

  const openActions = activities.filter(
    (a) =>
      getActivitiesForCompany([a], company).length > 0 && isFollowUpOpen(a),
  );

  if (openActions.length > 0 && overdue.length === 0) {
    signals.push({
      id: "open-actions",
      label: "Open commitments",
      severity: "warning",
      detail: `${openActions.length} action${openActions.length === 1 ? "" : "s"} awaiting completion`,
      impact: [
        "Open commitments block next steps in the relationship",
        pipelineExposure !== "No active pipeline value"
          ? `Unresolved actions may stall ${pipelineExposure}`
          : "Completion required before momentum can build",
      ],
    });
  }

  for (const dealId of company.pipelineIds) {
    const deal = pipelines.find((p) => p.id === dealId);
    if (!deal || ["Live Production", "Scheduled Maintenance"].includes(deal.status)) {
      continue;
    }

    const lastDealActivity = activities
      .filter((a) => a.Deal?.Title === dealId)
      .sort(
        (a, b) =>
          parseActivityDate(b.ActivityDate).getTime() -
          parseActivityDate(a.ActivityDate).getTime(),
      )[0];

    if (!lastDealActivity || daysBetween(lastDealActivity.ActivityDate) >= STALLED_DAYS) {
      const dealValue = formatDealValue(deal.currency, deal.salesValue);
      signals.push({
        id: `stalled-${dealId}`,
        label: "Stalled opportunity",
        severity: "warning",
        detail: `${deal.assetName} — no activity in ${STALLED_DAYS}+ days`,
        impact: [
          `${dealValue} at risk of slipping without re-engagement`,
          `${deal.status} stage deal may lose momentum to competitors`,
        ],
      });
    }
  }

  if (summary.lastContactAt) {
    const days = daysBetween(summary.lastContactAt);
    if (days >= COLD_CONTACT_DAYS) {
      signals.push({
        id: "cold-contact",
        label: "Relationship cooling",
        severity: days >= 60 ? "critical" : "warning",
        detail: `Last contact ${summary.lastContactLabel}`,
        impact: [
          `${days} days without contact weakens executive alignment`,
          pipelineExposure !== "No active pipeline value"
            ? `${pipelineExposure} exposed without active engagement`
            : "Competitors may fill the silence",
        ],
      });
    }
  } else if (company.contacts.length > 0 || company.pipelineIds.length > 0) {
    signals.push({
      id: "no-contact",
      label: "No recorded contact",
      severity: "info",
      detail: "Start building the relationship timeline",
      impact: [
        "Without interaction history, health scores and recommendations stay limited",
        pipelineExposure !== "No active pipeline value"
          ? `${pipelineExposure} lacks relationship context for decisions`
          : "First contact needed to establish trust",
      ],
    });
  }

  return signals.slice(0, 6);
}

function buildSuggestedActions(
  company: Company,
  summary: CompanyRelationshipSummary,
  activities: Activity[],
): string[] {
  const actions: string[] = [];

  const overdue = activities.filter(
    (a) =>
      getActivitiesForCompany([a], company).length > 0 && isFollowUpOverdue(a),
  );

  if (overdue[0]) {
    actions.push(`Complete overdue action: ${overdue[0].NextAction || overdue[0].Subject}`);
  }

  if (summary.lastContactAt && daysBetween(summary.lastContactAt) >= COLD_CONTACT_DAYS) {
    actions.push(`Schedule a check-in with ${company.Title}`);
  }

  if (company.contacts.length === 0) {
    actions.push("Add a primary contact to strengthen this relationship");
  }

  if (summary.activeDeals === 0 && company.pipelineIds.length === 0) {
    actions.push("Explore a new opportunity with this company");
  }

  if (actions.length === 0) {
    actions.push("Record today's interaction to keep the timeline current");
  }

  return actions.slice(0, 4);
}

function buildMaterialTracks(
  company: Company,
  pipelines: PipelineRow[],
  inventory: InventoryDb,
): Company360MaterialTrack[] {
  const linked = getLinkedPipelines(company, pipelines);

  return linked.map((deal) => {
    const inventoryRow = inventory.ledger.find(
      (row) =>
        row.materialType.toLowerCase() === deal.targetFeedstock.toLowerCase() ||
        deal.targetFeedstock.toLowerCase().includes(row.materialType.toLowerCase()),
    );

    return {
      dealId: deal.id,
      dealName: deal.assetName,
      feedstock: deal.targetFeedstock,
      capacityKgH: deal.reactorDesignCapacity,
      status: deal.status,
      companyRole: deal.companyRole,
      utilizationLabel: inventoryRow
        ? `${inventoryRow.capacityUtilization}% utilized`
        : undefined,
      telemetryLabel: inventoryRow?.currentTelemetry,
    };
  });
}

export function buildCompany360Snapshot(
  company: Company,
  pipelines: PipelineRow[],
  activities: Activity[],
  inventory: InventoryDb,
): Company360Snapshot {
  const summary = buildCompanyRelationshipSummary(company, activities, pipelines);
  const companyActivities = getActivitiesForCompany(activities, company);
  const openActions = companyActivities.filter(isFollowUpOpen);
  const linkedPipelines = getLinkedPipelines(company, pipelines);
  const documents = getCompanySmartDocs(company, pipelines);
  const materials = buildMaterialTracks(company, pipelines, inventory);
  const riskSignals = buildRiskSignals(company, summary, activities, pipelines);
  const recommendedAction = summary.healthReport.recommendedAction;
  const extensions: RelationshipIntelligenceExtensions = {
    healthScore: summary.healthScore,
    nextBestAction: recommendedAction,
    recommendedAction,
  };

  const intelligence: Company360IntelligenceView = {
    healthScore: summary.healthScore,
    healthStatus: summary.healthStatus,
    trend: summary.trend,
    healthReport: summary.healthReport,
    riskSignals,
    suggestedActions: buildSuggestedActions(company, summary, activities),
    recommendedAction,
    extensions,
  };

  const companyTypes = normalizeCompanyTypes(company);

  const header: Company360Header = {
    companyName: company.Title,
    companyTypes,
    companyTypesLabel: formatCompanyTypesLabel(companyTypes),
    industry: company.Industry,
    status: company.Status,
    healthScore: summary.healthScore,
    healthStatus: summary.healthStatus,
    trend: summary.trend,
    lastContactLabel: summary.lastContactLabel,
    openActions: summary.openActions,
    openOpportunities: summary.activeDeals,
    location: formatCompanyLocation(company),
    accountOwner: company.AccountOwner?.Title ?? null,
    recommendedAction,
  };

  return {
    company,
    header,
    summary,
    activities: companyActivities,
    openActions,
    pipelines: linkedPipelines,
    documents,
    materials,
    intelligence,
  };
}
