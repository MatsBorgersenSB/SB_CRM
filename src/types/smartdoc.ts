import type { LinkedDocument } from "@/types/activity";
import type { PipelineRow } from "@/types/pipeline";

export type SmartDocReviewStatus = "Current" | "Due" | "Overdue" | "Unknown";

export type SmartDocApprovalStatus = "Approved" | "Pending" | "Not Required" | "Missing";

export type DocumentHealthStatus =
  | "Strategic"
  | "Strong"
  | "Healthy"
  | "Weak"
  | "At Risk";

export type DocumentRiskType =
  | "expiring_certificate"
  | "missing_owner"
  | "missing_review"
  | "outdated_specification"
  | "critical_opportunity_dependency";

export type MissingDocumentStatus = "present" | "missing" | "critical_missing";

export type SmartDocRecord = {
  id: string;
  fileName: string;
  displayName: string;
  docCategory: string;
  docType: string;
  revision: string;
  clientLookup: string;
  pipelineId: string | null;
  source: "pipeline" | "activity";
};

export function smartDocDisplayName(fileName: string): string {
  const match = fileName.match(/\.(\d{2})\s+(.+)\.([^.]+)$/);
  if (match) return match[2]!;
  return fileName.replace(/_/g, " ");
}

export function smartDocFromLibraryRecord(
  record: import("@/types/smartdoc-library").SmartDocLibraryRecord,
): SmartDocRecord {
  return {
    id: record.SmartDocID,
    fileName: record.FileLeafRef,
    displayName: record.DocumentName,
    docCategory: record.DocCategory,
    docType: record.DocType,
    revision: record.Revision,
    clientLookup: record.PlNumber,
    pipelineId: record.DealId,
    source: "pipeline",
  };
}

export function smartDocFromPipeline(pipeline: PipelineRow): SmartDocRecord | null {
  if (!pipeline.FileLeafRef) return null;
  return {
    id: pipeline.id,
    fileName: pipeline.FileLeafRef,
    displayName: smartDocDisplayName(pipeline.FileLeafRef),
    docCategory: pipeline.DocCategory ?? "General",
    docType: pipeline.DocType ?? "Document",
    revision: pipeline.Revision ?? "01",
    clientLookup: pipeline.ClientLookup ?? pipeline.id,
    pipelineId: pipeline.id,
    source: "pipeline",
  };
}

export function smartDocFromLinkedDocument(
  linked: LinkedDocument,
  fallbackId: string,
): SmartDocRecord {
  const fileName = linked.Title;
  return {
    id: fallbackId,
    fileName,
    displayName: smartDocDisplayName(fileName),
    docCategory: linked.DocCategory ?? "General",
    docType: linked.Title.split(/[-_.]/).pop() ?? "Document",
    revision: linked.Revision ?? "01",
    clientLookup: linked.DealId ?? fallbackId,
    pipelineId: linked.DealId ?? null,
    source: "activity",
  };
}

export type BusinessImpactLevel = "Low" | "Medium" | "High" | "Critical";

export type SmartDocTimelineEventKind =
  | "creation"
  | "review"
  | "update"
  | "approval"
  | "reference";

export type SmartDocTimelineEvent = {
  id: string;
  kind: SmartDocTimelineEventKind;
  label: string;
  detail: string;
  occurredAt: string;
  activityId?: string;
};

export const DOCUMENT_360_TABS = ["overview", "linked", "intelligence"] as const;

export type Document360Tab = (typeof DOCUMENT_360_TABS)[number];

/** Legacy tab ids from Document 360 v1 — mapped to the 3-tab workspace. */
const DOCUMENT_360_TAB_ALIASES: Record<string, Document360Tab> = {
  relationships: "linked",
  activities: "linked",
  opportunities: "linked",
  materials: "linked",
  history: "intelligence",
};

export type Document360TabDefinition = {
  id: Document360Tab;
  label: string;
  description: string;
};

export const DOCUMENT_360_TAB_DEFINITIONS: Document360TabDefinition[] = [
  {
    id: "overview",
    label: "Overview",
    description: "What is this document and why does it matter?",
  },
  {
    id: "linked",
    label: "Linked",
    description: "Companies, contacts, deals, activities, and materials.",
  },
  {
    id: "intelligence",
    label: "Intelligence",
    description: "Health, risks, timeline, and required actions.",
  },
];

export const DOCUMENT_360_TAB_LABELS: Record<Document360Tab, string> = {
  overview: "Overview",
  linked: "Linked",
  intelligence: "Intelligence",
};

export function isDocument360Tab(value: string): value is Document360Tab {
  return (DOCUMENT_360_TABS as readonly string[]).includes(value);
}

export function resolveDocument360Tab(value: string | null | undefined): Document360Tab {
  if (!value) return "overview";
  if (isDocument360Tab(value)) return value;
  return DOCUMENT_360_TAB_ALIASES[value] ?? "overview";
}

export function smartDocHref(documentId: string): string {
  return `/documents/${encodeURIComponent(documentId)}`;
}

export function document360Href(documentId: string, tab?: Document360Tab): string {
  if (!tab || tab === "overview") return smartDocHref(documentId);
  return `${smartDocHref(documentId)}?tab=${tab}`;
}

export const BUSINESS_IMPACT_STYLES: Record<BusinessImpactLevel, string> = {
  Low: "border-carbon-blue/15 bg-carbon-blue/[0.03] text-carbon-blue/60",
  Medium: "border-sky-500/25 bg-sky-500/8 text-sky-700",
  High: "border-upcycle-orange/30 bg-upcycle-orange/8 text-upcycle-orange",
  Critical: "border-red-500/30 bg-red-500/8 text-red-700",
};

export const DOCUMENT_HEALTH_STYLES: Record<DocumentHealthStatus, string> = {
  Strategic: "border-violet-500/35 bg-violet-500/10 text-violet-700",
  Strong: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  Healthy: "border-sky-500/30 bg-sky-500/10 text-sky-700",
  Weak: "border-upcycle-orange/30 bg-upcycle-orange/10 text-upcycle-orange",
  "At Risk": "border-red-500/30 bg-red-500/10 text-red-700",
};

export const MISSING_DOC_ICONS: Record<MissingDocumentStatus, string> = {
  present: "✅",
  missing: "⚠",
  critical_missing: "❌",
};
