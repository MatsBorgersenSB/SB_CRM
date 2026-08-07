import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { Project } from "@/types/project";
import type { SmartDocCategory, SmartDocLibraryRecord, SmartDocOrigin } from "@/types/smartdoc-library";
import {
  normalizeSmartDocOrigin,
  SMARTDOC_ORIGIN_LABELS,
} from "@/types/smartdoc-library";
import { deal360Href, documentHref, contact360Href } from "@/types/relationship-navigation";
import { formatRelativeTime } from "@/lib/relative-time";

export type WorkspaceDocumentsScope = "company" | "contact" | "opportunity";

export type WorkspaceDocumentsContext = {
  scope: WorkspaceDocumentsScope;
  companyId?: string;
  companyName?: string;
  contactId?: string;
  contactName?: string;
  dealId?: string;
  dealName?: string;
  pipelineIds: string[];
};

export type WorkspaceDocumentRow = {
  id: string;
  name: string;
  docType: string;
  docCategory: string;
  origin: SmartDocOrigin;
  originLabel: string;
  counterparty?: string;
  version: string;
  status: string;
  statusKind: "in_set" | "library" | "activity_link";
  relatedObjectLabel: string;
  relatedObjectHref?: string;
  modifiedLabel: string;
  modifiedAt: string;
  href: string;
};

export type WorkspaceDocumentSortKey =
  | "name"
  | "docType"
  | "version"
  | "status"
  | "relatedObjectLabel"
  | "modifiedAt";

export type WorkspaceCreateDocumentPreset = {
  label: string;
  category: SmartDocCategory;
  type: string;
};

export const WORKSPACE_CREATE_DOCUMENT_PRESETS: WorkspaceCreateDocumentPreset[] = [
  { label: "Price Indication", category: "Commercial", type: "Price Indication" },
  { label: "Budget Quotation", category: "Commercial", type: "Budget Quotation" },
  { label: "Formal Quotation", category: "Commercial", type: "Formal Quotation" },
  { label: "Technical Datasheet", category: "Technical", type: "Technical Datasheet" },
  { label: "Meeting Notes", category: "Operational", type: "Meeting Notes" },
  { label: "Commercial Terms", category: "Commercial", type: "Terms Schedule" },
  { label: "Custom Document", category: "General", type: "Unclassified Document" },
];

function formatModifiedDate(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function relatedObjectForDeal(
  dealId: string,
  pipelines: PipelineRow[],
  companies: Company[],
): { label: string; href?: string } {
  const deal = pipelines.find((row) => row.id === dealId);
  const company = companies.find((row) => row.pipelineIds.includes(dealId));

  if (deal && company) {
    return {
      label: `${deal.assetName} · ${company.Title}`,
      href: deal360Href(deal.id),
    };
  }

  if (deal) {
    return { label: deal.assetName, href: deal360Href(deal.id) };
  }

  return { label: dealId };
}

export function buildWorkspaceDocumentRows(
  library: SmartDocLibraryRecord[],
  context: WorkspaceDocumentsContext,
  pipelines: PipelineRow[],
  companies: Company[],
  activities: Activity[] = [],
): WorkspaceDocumentRow[] {
  const pipelineSet = new Set(context.pipelineIds);
  const rows: WorkspaceDocumentRow[] = [];

  for (const record of library) {
    if (!pipelineSet.has(record.DealId)) continue;

    const related = relatedObjectForDeal(record.DealId, pipelines, companies);

    const origin = normalizeSmartDocOrigin(record.Origin);
    rows.push({
      id: record.SmartDocID,
      name: record.DocumentName || record.FileLeafRef,
      docType: record.DocType,
      docCategory: record.DocCategory,
      origin,
      originLabel: SMARTDOC_ORIGIN_LABELS[origin],
      counterparty: record.Counterparty,
      version: record.Revision ? `Rev ${record.Revision}` : "—",
      status: record.DocumentSetID ? `In ${record.DocumentSetID}` : "Library",
      statusKind: record.DocumentSetID ? "in_set" : "library",
      relatedObjectLabel: related.label,
      relatedObjectHref: related.href,
      modifiedLabel: formatModifiedDate(record.CreatedAt),
      modifiedAt: record.CreatedAt,
      href: documentHref(record.SmartDocID),
    });
  }

  if (context.scope === "contact" && context.contactId) {
    const seen = new Set(rows.map((row) => row.id));

    for (const activity of activities) {
      const matchesContact =
        activity.Contact?.Title === context.contactId ||
        activity.Contact?.Title === context.contactName;
      if (!matchesContact) continue;

      for (const linked of activity.LinkedDocuments ?? []) {
        const dealId = linked.DealId;
        if (dealId && !pipelineSet.has(dealId)) continue;

        const id = linked.DealId ?? `activity-${activity.ActivityID}-${linked.Title}`;
        if (seen.has(id)) continue;
        seen.add(id);

        const related = dealId
          ? relatedObjectForDeal(dealId, pipelines, companies)
          : { label: context.contactName ?? "Contact" };

        rows.push({
          id,
          name: linked.Title,
          docType: linked.DocCategory ?? "Linked",
          docCategory: linked.DocCategory ?? "General",
          origin: "unknown",
          originLabel: SMARTDOC_ORIGIN_LABELS.unknown,
          version: linked.Revision ? `Rev ${linked.Revision}` : "—",
          status: "Activity link",
          statusKind: "activity_link",
          relatedObjectLabel: `${context.contactName ?? "Contact"} · ${context.companyName ?? "Company"}`,
          relatedObjectHref: context.contactId
            ? contact360Href(context.contactId, context.companyId)
            : undefined,
          modifiedLabel: formatRelativeTime(activity.ActivityDate),
          modifiedAt: activity.ActivityDate,
          href: dealId ? documentHref(dealId) : `/activities/${activity.ActivityID}`,
        });
      }
    }
  }

  return rows.sort(
    (a, b) => new Date(b.modifiedAt || 0).getTime() - new Date(a.modifiedAt || 0).getTime(),
  );
}

export function workspaceDocumentsLinkSummary(context: WorkspaceDocumentsContext): string {
  switch (context.scope) {
    case "company":
      return `Documents are linked to ${context.companyName ?? "this company"}.`;
    case "contact":
      return `Documents are linked to ${context.contactName ?? "this contact"} and ${context.companyName ?? "company"}.`;
    case "opportunity":
      return `Documents are linked to ${context.dealName ?? "this opportunity"} and ${context.companyName ?? "company"}.`;
    default:
      return "Documents use SmartDocs identity, classification, and version management.";
  }
}

export function defaultTargetDealId(
  context: WorkspaceDocumentsContext,
  pipelines: PipelineRow[],
): string | null {
  if (context.dealId) return context.dealId;

  const active = context.pipelineIds
    .map((id) => pipelines.find((deal) => deal.id === id))
    .filter((deal): deal is PipelineRow => Boolean(deal))
    .filter(
      (deal) => deal.status !== "Live Production" && deal.status !== "Scheduled Maintenance",
    );

  return active[0]?.id ?? context.pipelineIds[0] ?? null;
}

export function workspaceDocumentsContextFromCompany(
  company: Company,
): WorkspaceDocumentsContext {
  return {
    scope: "company",
    companyId: company.CompanyID,
    companyName: company.Title,
    pipelineIds: company.pipelineIds,
  };
}

export function workspaceDocumentsContextFromContact(
  contactId: string,
  contactName: string,
  company: Company,
  pipelineIds: string[],
): WorkspaceDocumentsContext {
  return {
    scope: "contact",
    contactId,
    contactName,
    companyId: company.CompanyID,
    companyName: company.Title,
    pipelineIds,
  };
}

export function workspaceDocumentsContextFromOpportunity(
  pipeline: PipelineRow,
  company?: Company,
): WorkspaceDocumentsContext {
  return {
    scope: "opportunity",
    dealId: pipeline.id,
    dealName: pipeline.assetName,
    companyId: company?.CompanyID,
    companyName: company?.Title,
    pipelineIds: [pipeline.id],
  };
}

/** Project workspace — uses linked opportunity or company document scope. */
export function workspaceDocumentsContextFromProject(
  project: Project,
  pipeline?: PipelineRow,
  company?: Company,
): WorkspaceDocumentsContext {
  if (pipeline) {
    return workspaceDocumentsContextFromOpportunity(pipeline, company);
  }

  if (company) {
    return workspaceDocumentsContextFromCompany(company);
  }

  return {
    scope: "opportunity",
    dealId: project.id,
    dealName: project.name,
    pipelineIds: [],
  };
}
