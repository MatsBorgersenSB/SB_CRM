import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { Contact } from "@/types/contact";
import { getContactDisplayName } from "@/types/contact";
import type { InventoryDb } from "@/lib/inventory-data";
import { buildRelationshipMemory } from "@/lib/relationship-memory";
import { formatRelativeTime } from "@/lib/relative-time";
import { buildAttentionItems } from "@/lib/smart-attention-engine";
import { resolveAttentionActions } from "@/lib/attention-action-resolver";
import { formatCompanyLocation } from "@/types/company";
import {
  companyTypeSearchKeywords,
  formatCompanyTypesWithEmoji,
  normalizeCompanyTypes,
} from "@/lib/company-classification";
import type { CommercialPackage } from "@/types/commercial-package";
import {
  COMMERCIAL_PACKAGE_KIND_LABELS,
  isQuotationKind,
} from "@/types/commercial-package";
import type { PipelineRow } from "@/types/pipeline";
import { formatDealValue } from "@/types/pipeline";
import type { RawMaterial } from "@/types/raw-material";
import type { SearchIndexItem } from "@/types/universal-search";
import type { StoredResearchReport } from "@/types/research-report";
import { company360Href } from "@/types/company-360";
import { smartDocHref } from "@/types/smartdoc";
import {
  commercialPackageHref,
  contact360Href,
  deal360Href,
  documentSetHref,
} from "@/types/relationship-navigation";

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

function parseActivityDate(value: string): Date {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(normalized);
}

function sortActivitiesNewest(activities: Activity[]): Activity[] {
  return [...activities].sort(
    (a, b) =>
      parseActivityDate(b.ActivityDate).getTime() -
      parseActivityDate(a.ActivityDate).getTime(),
  );
}

function formatLastActivity(activity: Activity | undefined, fallback = "No activity recorded"): {
  label: string;
  at: string;
} {
  if (!activity) return { label: fallback, at: "" };
  return {
    label: `${activity.ActivityType} · ${formatRelativeTime(activity.ActivityDate)}`,
    at: activity.ActivityDate,
  };
}

function lastForCompany(title: string, activities: Activity[]) {
  return formatLastActivity(
    sortActivitiesNewest(activities).find((a) => a.Company?.Title === title),
  );
}

function lastForContact(contact: Contact, company: Company, activities: Activity[]) {
  const contactName = getContactDisplayName(contact);
  const match = sortActivitiesNewest(activities).find((a) => {
    if (a.Contact?.Title === contact.ContactID) return true;
    if (a.Contact?.Title === contactName) return true;
    if (a.Contact?.Title === contact.Title) return true;
    return false;
  });
  return formatLastActivity(match);
}

function lastForDeal(dealId: string, activities: Activity[]) {
  return formatLastActivity(
    sortActivitiesNewest(activities).find((a) => a.Deal?.Title === dealId),
  );
}

function item(
  partial: Omit<SearchIndexItem, "searchText"> & { keywords?: string[] },
): SearchIndexItem {
  const searchText = normalize(
    [
      partial.name,
      partial.typeLabel,
      partial.contextPreview,
      partial.lastActivityLabel,
      ...(partial.keywords ?? []),
    ].join(" "),
  );
  const { keywords: _keywords, ...rest } = partial;
  return { ...rest, searchText };
}

function findCompanyForDeal(dealId: string, companies: Company[]): Company | undefined {
  return companies.find((c) => c.pipelineIds.includes(dealId));
}

function isOpenOpportunity(deal: PipelineRow | undefined): boolean {
  return Boolean(
    deal && deal.status !== "Live Production" && deal.status !== "Scheduled Maintenance",
  );
}

function companyPipelineMeta(company: Company, pipelines: PipelineRow[]) {
  const openDeals = company.pipelineIds
    .map((id) => pipelines.find((deal) => deal.id === id))
    .filter(isOpenOpportunity);
  const pipelineValue = openDeals.reduce((sum, deal) => sum + (deal?.salesValue ?? 0), 0);
  const currency = openDeals.find((deal) => deal?.currency)?.currency ?? "EUR";

  return {
    openOpportunities: openDeals.length,
    pipelineValueLabel:
      openDeals.length > 0 ? formatDealValue(currency, pipelineValue) : "—",
  };
}

function buildCompanyItems(
  companies: Company[],
  pipelines: PipelineRow[],
  activities: Activity[],
  attentionCountByCompany: Map<string, number>,
): SearchIndexItem[] {
  return companies.map((company) => {
    const last = lastForCompany(company.Title, activities);
    const pipeline = companyPipelineMeta(company, pipelines);
    const companyTypes = normalizeCompanyTypes(company);

    return item({
      id: `company-${company.CompanyID}`,
      entityType: "company",
      name: company.Title,
      typeLabel: formatCompanyTypesWithEmoji(companyTypes),
      contextPreview: `${company.Status} · ${formatCompanyLocation(company)}`,
      lastActivityLabel: last.label,
      lastActivityAt: last.at,
      href: company360Href(company.CompanyID),
      keywords: [
        company.CompanyID,
        company.Domain,
        company.Phone,
        company.Industry,
        ...(company.Sectors ?? []),
        ...companyTypeSearchKeywords(companyTypes),
      ],
      smartMeta: {
        locationLabel: formatCompanyLocation(company),
        openOpportunities: pipeline.openOpportunities,
        pipelineValueLabel: pipeline.pipelineValueLabel,
        contactCount: company.contacts.length,
        attentionCount: attentionCountByCompany.get(company.CompanyID) ?? 0,
        companyId: company.CompanyID,
        companyName: company.Title,
      },
    });
  });
}

function buildContactItems(companies: Company[], activities: Activity[]): SearchIndexItem[] {
  const results: SearchIndexItem[] = [];

  for (const company of companies) {
    for (const contact of company.contacts) {
      results.push(buildContactItem(contact, company, activities));
    }
  }

  return results;
}

function buildContactItem(
  contact: Contact,
  company: Company,
  activities: Activity[],
): SearchIndexItem {
  const displayName = getContactDisplayName(contact);
  const last = lastForContact(contact, company, activities);

  return item({
    id: `contact-${contact.ContactID}`,
    entityType: "contact",
    name: displayName,
    typeLabel: contact.Role,
    contextPreview: `${company.Title} · ${contact.JobTitle || contact.Status}`,
    lastActivityLabel: last.label,
    lastActivityAt: last.at,
    href: contact360Href(contact.ContactID, company.CompanyID),
    keywords: [
      contact.ContactID,
      contact.Email,
      contact.Phone,
      contact.Mobile,
      company.Title,
    ],
    smartMeta: {
      companyId: company.CompanyID,
      companyName: company.Title,
    },
  });
}

function buildDealItems(
  pipelines: PipelineRow[],
  companies: Company[],
  activities: Activity[],
): SearchIndexItem[] {
  return pipelines.map((deal) => {
    const company = findCompanyForDeal(deal.id, companies);
    const last = lastForDeal(deal.id, activities);

    return item({
      id: `deal-${deal.id}`,
      entityType: "deal",
      name: deal.assetName,
      typeLabel: deal.status,
      contextPreview: `${deal.id} · ${company?.Title ?? deal.companyRole} · ${formatDealValue(deal.currency, deal.salesValue)}`,
      lastActivityLabel: last.label,
      lastActivityAt: last.at,
      href: deal360Href(deal.id),
      keywords: [
        deal.id,
        deal.targetFeedstock,
        deal.currentMilestone,
        company?.Title ?? "",
      ],
      smartMeta: company
        ? {
            companyId: company.CompanyID,
            companyName: company.Title,
          }
        : undefined,
    });
  });
}

function buildActivityItems(activities: Activity[]): SearchIndexItem[] {
  return activities.map((activity) => {
    const memory = buildRelationshipMemory(activity);

    return item({
      id: `activity-${activity.ActivityID}`,
      entityType: "activity",
      name: activity.Subject,
      typeLabel: activity.ActivityType,
      contextPreview: [
        memory.summary,
        activity.Company?.Title,
        memory.whatHappensNext ? `Next: ${memory.whatHappensNext}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      lastActivityLabel: formatRelativeTime(activity.ActivityDate),
      lastActivityAt: activity.ActivityDate,
      href: `/activities/${activity.ActivityID}`,
      keywords: [
        activity.ActivityID,
        activity.ActivityDescription,
        ...(activity.KeyDecisions ?? []),
        ...(activity.Risks ?? []),
      ],
      smartMeta: activity.Company?.Title
        ? { companyName: activity.Company.Title }
        : undefined,
    });
  });
}

function buildNoteItems(activities: Activity[]): SearchIndexItem[] {
  const results: SearchIndexItem[] = [];

  for (const activity of activities) {
    const notes = [
      ...(activity.KeyDecisions ?? []),
      activity.ActivityDescription?.trim(),
    ].filter(Boolean) as string[];

    notes.forEach((note, index) => {
      if (note.length < 12) return;
      results.push(
        item({
          id: `note-${activity.ActivityID}-${index}`,
          entityType: "note",
          name: note.slice(0, 72) + (note.length > 72 ? "…" : ""),
          typeLabel: "Note",
          contextPreview: `${activity.Subject} · ${activity.Company?.Title ?? "—"}`,
          lastActivityLabel: formatRelativeTime(activity.ActivityDate),
          lastActivityAt: activity.ActivityDate,
          href: `/activities/${activity.ActivityID}`,
          keywords: [activity.ActivityID, activity.Subject, note],
          smartMeta: activity.Company?.Title
            ? { companyName: activity.Company.Title }
            : undefined,
        }),
      );
    });
  }

  return results;
}

function buildDocumentItems(
  pipelines: PipelineRow[],
  companies: Company[],
  activities: Activity[],
): SearchIndexItem[] {
  const results: SearchIndexItem[] = [];

  for (const pipeline of pipelines) {
    if (!pipeline.FileLeafRef) continue;

    const company = findCompanyForDeal(pipeline.id, companies);
    const dealLast = lastForDeal(pipeline.id, activities);
    const companyLast = company
      ? lastForCompany(company.Title, activities)
      : { label: "No activity recorded", at: "" };

    const last =
      !dealLast.at
        ? companyLast
        : !companyLast.at
          ? dealLast
          : parseActivityDate(dealLast.at) >= parseActivityDate(companyLast.at)
            ? dealLast
            : companyLast;

    results.push(
      item({
        id: `document-${pipeline.id}-${pipeline.FileLeafRef}`,
        entityType: "document",
        name: pipeline.FileLeafRef,
        typeLabel: pipeline.DocCategory || "SmartDoc",
        contextPreview: [
          pipeline.DocType,
          pipeline.Revision ? `Rev ${pipeline.Revision}` : "",
          pipeline.id,
          company?.Title,
        ]
          .filter(Boolean)
          .join(" · "),
        lastActivityLabel: last.label,
        lastActivityAt: last.at,
        href: smartDocHref(pipeline.id),
        keywords: [
          pipeline.id,
          pipeline.ClientLookup ?? "",
          pipeline.DocCategory ?? "",
          pipeline.DocType ?? "",
        ],
        smartMeta: company
          ? { companyId: company.CompanyID, companyName: company.Title }
          : undefined,
      }),
    );
  }

  return results;
}

function buildDocumentSetItems(packages: CommercialPackage[], companies: Company[]): SearchIndexItem[] {
  const seen = new Set<string>();
  const results: SearchIndexItem[] = [];

  for (const pkg of packages) {
    if (!pkg.DocumentSetID || seen.has(pkg.DocumentSetID)) continue;
    if (!isQuotationKind(pkg.kind) && pkg.kind !== "execution") continue;
    seen.add(pkg.DocumentSetID);

    const company = companies.find((record) =>
      record.pipelineIds.includes(pkg.DealId),
    );

    results.push(
      item({
        id: `document-set-${pkg.DocumentSetID}`,
        entityType: "document_set",
        name: pkg.DocumentSetID,
        typeLabel: COMMERCIAL_PACKAGE_KIND_LABELS[pkg.kind],
        contextPreview: `${pkg.title} · ${pkg.DealId} · ${company?.Title ?? pkg.ClientName ?? ""}`,
        lastActivityLabel: pkg.sentAt ? `Sent ${formatRelativeTime(pkg.sentAt)}` : "Draft",
        lastActivityAt: pkg.sentAt ?? pkg.CreatedAt ?? "",
        href: documentSetHref(pkg.DocumentSetID),
        keywords: [pkg.PackageID, pkg.DealId, pkg.title, pkg.ClientName ?? ""],
        smartMeta: company
          ? { companyId: company.CompanyID, companyName: company.Title }
          : undefined,
      }),
    );
  }

  return results;
}

function buildTransmissionItems(packages: CommercialPackage[], companies: Company[]): SearchIndexItem[] {
  return packages
    .filter((pkg) => pkg.kind === "transmission" || pkg.kind === "commercial_baseline")
    .map((pkg) => {
      const company = companies.find((record) =>
        record.pipelineIds.includes(pkg.DealId),
      );

      return item({
        id: `transmission-${pkg.PackageID}`,
        entityType: "transmission",
        name: pkg.title || pkg.PackageID,
        typeLabel: COMMERCIAL_PACKAGE_KIND_LABELS[pkg.kind],
        contextPreview: `${pkg.DocumentSetID} · ${pkg.DealId} · ${pkg.recipient ?? company?.Title ?? ""}`,
        lastActivityLabel: pkg.sentAt
          ? `Sent ${formatRelativeTime(pkg.sentAt)}`
          : pkg.acceptedAt
            ? `Accepted ${formatRelativeTime(pkg.acceptedAt)}`
            : pkg.status,
        lastActivityAt: pkg.sentAt ?? pkg.acceptedAt ?? pkg.CreatedAt ?? "",
        href: commercialPackageHref(pkg),
        keywords: [pkg.PackageID, pkg.DocumentSetID, pkg.DealId, pkg.recipient ?? ""],
        smartMeta: company
          ? { companyId: company.CompanyID, companyName: company.Title }
          : undefined,
      });
    });
}

function buildAttentionItemsIndex(
  companies: Company[],
  pipelines: PipelineRow[],
  activities: Activity[],
  commercialPackages: CommercialPackage[],
): { items: SearchIndexItem[]; countByCompany: Map<string, number> } {
  const attention = buildAttentionItems({
    companies,
    pipelines,
    activities,
    commercialPackages,
  });

  const countByCompany = new Map<string, number>();

  const items = attention.map((record) => {
    if (record.companyId) {
      countByCompany.set(record.companyId, (countByCompany.get(record.companyId) ?? 0) + 1);
    }

    return item({
      id: `attention-${record.id}`,
      entityType: "attention",
      name: record.sourceObjectName,
      typeLabel: record.objectType,
      contextPreview: record.recommendation,
      lastActivityLabel: record.suggestedAiAction,
      lastActivityAt: record.dueDate ?? "",
      href: record.href,
      keywords: [record.ruleId, record.companyName ?? "", record.suggestedAiAction],
      attentionItemId: record.id,
      actions: resolveAttentionActions(record),
      smartMeta: record.companyId
        ? {
            companyId: record.companyId,
            companyName: record.companyName,
            attentionCount: 1,
          }
        : undefined,
    });
  });

  return { items, countByCompany };
}

function buildRawMaterialItems(materials: RawMaterial[]): SearchIndexItem[] {
  return materials.map((material) =>
    item({
      id: `raw-${material.MaterialID}`,
      entityType: "raw_material",
      name: material.Title,
      typeLabel: material.MaterialType,
      contextPreview: `${material.Location} · ${material.CapacityUtilization}% utilized · ${material.CriticalStatus}`,
      lastActivityLabel: `Telemetry · ${material.CurrentTelemetry}`,
      lastActivityAt: "",
      href: "/inventory",
      keywords: [material.MaterialID, material.CurrentTelemetry, material.FlowVelocity],
    }),
  );
}

function ledgerToRawMaterial(
  row: InventoryDb["ledger"][number],
  index: number,
): RawMaterial {
  return {
    id: index + 1,
    MaterialID: `RM-${1000 + index}`,
    Title: row.materialType,
    Location: row.location,
    MaterialType: row.materialType,
    CapacityUtilization: row.capacityUtilization,
    CurrentTelemetry: row.currentTelemetry,
    FlowVelocity: row.flowVelocity,
    CriticalStatus: row.criticalStatus,
  };
}

function buildResearchReportItems(reports: StoredResearchReport[]): SearchIndexItem[] {
  return reports.map((report) =>
    item({
      id: `research-${report.reportId}`,
      entityType: "document",
      name: report.title,
      typeLabel: report.typeLabel,
      contextPreview: `${report.subject} · ${report.priority} priority · Rev ${report.revision}`,
      lastActivityLabel: `Generated · ${new Date(report.generatedAt).toLocaleDateString("en-GB")}`,
      lastActivityAt: report.generatedAt,
      href: `/knowledge?report=${encodeURIComponent(report.reportId)}`,
      keywords: [
        report.reportId,
        report.typeLabel,
        report.subject,
        report.docType,
        report.docCategory,
        report.metadata.companyName ?? "",
        report.metadata.dealId ?? "",
        report.searchableText,
      ],
      smartMeta: report.metadata.companyId
        ? {
            companyId: report.metadata.companyId,
            companyName: report.metadata.companyName,
          }
        : undefined,
    }),
  );
}

export function buildUniversalSearchIndex(
  companies: Company[],
  pipelines: PipelineRow[],
  activities: Activity[],
  inventory: InventoryDb,
  commercialPackages: CommercialPackage[] = [],
  researchReports: StoredResearchReport[] = [],
): SearchIndexItem[] {
  const materials = inventory.ledger.map(ledgerToRawMaterial);
  const { items: attentionItems, countByCompany } = buildAttentionItemsIndex(
    companies,
    pipelines,
    activities,
    commercialPackages,
  );

  return [
    ...buildCompanyItems(companies, pipelines, activities, countByCompany),
    ...buildContactItems(companies, activities),
    ...buildDealItems(pipelines, companies, activities),
    ...buildDocumentItems(pipelines, companies, activities),
    ...buildDocumentSetItems(commercialPackages, companies),
    ...buildTransmissionItems(commercialPackages, companies),
    ...attentionItems,
    ...buildActivityItems(activities),
    ...buildNoteItems(activities),
    ...buildRawMaterialItems(materials),
    ...buildResearchReportItems(researchReports),
  ];
}
