/**
 * SharePoint Choice field values — stored/displayed as exact list choice strings.
 */
import type { SharePointPerson } from "@/types/company";

export type CompanyRole =
  | "Technology Buyer"
  | "Feedstock Supplier"
  | "Off-take Partner"
  | "Infrastructure Partner";

export const COMPANY_ROLES: CompanyRole[] = [
  "Technology Buyer",
  "Feedstock Supplier",
  "Off-take Partner",
  "Infrastructure Partner",
];

export type PipelineStatus =
  | "Prospecting"
  | "Feedstock Analysis"
  | "Contract Negotiation"
  | "Won"
  | "Reactor Manufacturing"
  | "Site Installation"
  | "Commissioning Phase"
  | "Live Production"
  | "Scheduled Maintenance";

export const PIPELINE_STATUSES: PipelineStatus[] = [
  "Prospecting",
  "Feedstock Analysis",
  "Contract Negotiation",
  "Won",
  "Reactor Manufacturing",
  "Site Installation",
  "Commissioning Phase",
  "Live Production",
  "Scheduled Maintenance",
];

export type PipelineLifecycleStage = "sales" | "delivery" | "production";

const SALES_STATUSES: PipelineStatus[] = [
  "Prospecting",
  "Feedstock Analysis",
  "Contract Negotiation",
  "Won",
];

const DELIVERY_STATUSES: PipelineStatus[] = [
  "Reactor Manufacturing",
  "Site Installation",
  "Commissioning Phase",
];

const PRODUCTION_STATUSES: PipelineStatus[] = [
  "Live Production",
  "Scheduled Maintenance",
];

export function getLifecycleStage(status: PipelineStatus): PipelineLifecycleStage {
  if (SALES_STATUSES.includes(status)) return "sales";
  if (DELIVERY_STATUSES.includes(status)) return "delivery";
  return "production";
}

export type PipelineCurrency = "EUR" | "USD" | "NOK" | string;

export type SmartDocsDocument = {
  ClientLookup: string;
  DocCategory: string;
  DocType: string;
  Revision: string;
  FileLeafRef: string;
};

export type PipelineTeamMember = {
  contactId: string;
  projectRole: string;
};

/**
 * SharePoint list item row — `id` is the stable list item identifier (e.g. PL-1042).
 */
export type PipelineRow = {
  id: string;
  /**
   * Public opportunity code (e.g. PL-1007).
   * Used in UI and SmartDoc IDs; may equal `id` for legacy JSON seed rows.
   */
  code?: string | null;
  assetName: string;
  companyRole: CompanyRole;
  targetFeedstock: string;
  reactorDesignCapacity: number;
  currentMilestone: string;
  status: PipelineStatus;
  salesValue: number;
  currency: PipelineCurrency;
  probability: number;
  /** ISO date (YYYY-MM-DD) — expected commercial close. */
  expectedCloseDate?: string;
  /** Opportunity owner — falls back to account owner when unset. */
  opportunityOwner?: SharePointPerson | null;
  /**
   * Standard Bio offerings in scope (systems, products, services).
   * Required for SmartAssist to understand what we are selling.
   */
  offeringIds?: string[];
  /** User-captured opportunity understanding — source of truth for gaps. */
  understanding?: import("@/types/opportunity-understanding").OpportunityUnderstandingCapture;
  ClientLookup?: string;
  DocCategory?: string;
  DocType?: string;
  Revision?: string;
  FileLeafRef?: string;
  team?: PipelineTeamMember[];
  /** SharePoint Online opportunity document folder (from Prisma registry provision). */
  sharepointFolderId?: string | null;
  sharepointFolderUrl?: string | null;
  sharepointFolderPath?: string | null;
};

export type EditablePipelineField =
  | "assetName"
  | "reactorDesignCapacity"
  | "salesValue"
  | "probability"
  | "targetFeedstock"
  | "currentMilestone"
  | "status";

export const EDITABLE_FIELDS: EditablePipelineField[] = [
  "assetName",
  "reactorDesignCapacity",
  "salesValue",
  "probability",
  "targetFeedstock",
  "currentMilestone",
  "status",
];

export const COLUMN_KEYS = [
  "id",
  "assetName",
  "companyRole",
  "reactorDesignCapacity",
  "salesValue",
  "probability",
  "status",
] as const;

export type ColumnKey = (typeof COLUMN_KEYS)[number];

const CURRENCY_PREFIX: Record<string, string> = {
  EUR: "€",
  USD: "$",
};

export function formatReactorCapacity(capacity: number): string {
  return `${capacity.toLocaleString("en-US")} kg/h`;
}

export function formatDealValue(
  currency: PipelineCurrency,
  salesValue: number,
): string {
  const formatted = salesValue.toLocaleString("en-US");
  const prefix = CURRENCY_PREFIX[currency];

  if (prefix) {
    return `${prefix}${formatted}`;
  }

  if (currency === "NOK") {
    return `${formatted} kr`;
  }

  return `${currency} ${formatted}`;
}

/** @deprecated Use formatDealValue */
export const formatProjectValue = formatDealValue;

export function formatProbability(probability: number): string {
  return `${probability}%`;
}

/** Prefer public PL-#### code for display and SmartDoc identity. */
export function opportunityPublicCode(pipeline: Pick<PipelineRow, "id" | "code">): string {
  const code = pipeline.code?.trim();
  if (code && /^PL-[A-Z0-9]+$/i.test(code)) return code.toUpperCase();
  if (/^PL-[A-Z0-9]+$/i.test(pipeline.id.trim())) return pipeline.id.trim().toUpperCase();
  return pipeline.id;
}

export function parseReactorCapacityInput(value: string): number {
  const normalized = value.replace(/[^\d.]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

export function parseSalesValueInput(value: string): number {
  const normalized = value.replace(/[^\d.]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

export function parseProbabilityInput(value: string): number {
  const normalized = value.replace(/[^\d.]/g, "");
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, Math.round(parsed)));
}

export function parseEditableNumericField(
  field: EditablePipelineField,
  rawValue: string,
): number {
  if (field === "reactorDesignCapacity") return parseReactorCapacityInput(rawValue);
  if (field === "salesValue") return parseSalesValueInput(rawValue);
  return parseProbabilityInput(rawValue);
}

export function isNumericEditableField(
  field: EditablePipelineField,
): field is "reactorDesignCapacity" | "salesValue" | "probability" {
  return (
    field === "reactorDesignCapacity" ||
    field === "salesValue" ||
    field === "probability"
  );
}

export function getEditableCellValue(
  row: PipelineRow,
  field: EditablePipelineField,
): string {
  if (field === "reactorDesignCapacity") return String(row.reactorDesignCapacity);
  if (field === "salesValue") return String(row.salesValue);
  if (field === "probability") return String(row.probability);
  if (field === "status") return row.status;
  return row[field];
}

export function getEditableCellDisplayValue(
  row: PipelineRow,
  field: EditablePipelineField,
): string {
  if (field === "reactorDesignCapacity") {
    return formatReactorCapacity(row.reactorDesignCapacity);
  }
  if (field === "salesValue") {
    return formatDealValue(row.currency, row.salesValue);
  }
  if (field === "probability") {
    return formatProbability(row.probability);
  }
  if (field === "status") {
    return row.status;
  }
  return row[field];
}

/** Normalizes inline edits into a Graph/REST-ready PATCH body fragment. */
export function buildSharePointPatch(
  field: EditablePipelineField,
  rawValue: string,
): Partial<Pick<PipelineRow, EditablePipelineField>> {
  if (field === "status") {
    const trimmed = rawValue.trim() as PipelineStatus;
    if (!PIPELINE_STATUSES.includes(trimmed)) {
      return {};
    }
    return { status: trimmed };
  }
  if (isNumericEditableField(field)) {
    return { [field]: parseEditableNumericField(field, rawValue) };
  }
  return { [field]: rawValue.trim() };
}
