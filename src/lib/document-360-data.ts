import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { BusinessImpactLevel, SmartDocRecord } from "@/types/smartdoc";
import { document360Href, smartDocDisplayName } from "@/types/smartdoc";
import type { CommercialPackage } from "@/types/commercial-package";
import { findDocumentSetForFile } from "@/lib/document-set-engine";
import { resolveDocumentSetStatus, documentSet360Href, documentSetTypeLabel } from "@/types/document-set";
import type { SmartDocLibraryRecord } from "@/types/smartdoc-library";
import {
  computeDocumentIntelligence,
  computeMissingDocumentsForCompany,
  computeMissingDocumentsForDeal,
  type DocumentIntelligence,
  type MissingDocumentsReport,
} from "@/lib/document-intelligence-engine";
import { buildDealDocumentContext } from "@/lib/deal-document-context";
import {
  parseSmartDocIdentity,
  resolveCategoryLabel,
  sharePointVersionLabel,
  suggestDocumentName,
  suggestDocumentNames,
} from "@/lib/smartdoc-identity";
import { SMARTDOC_CATEGORIES, type SmartDocCategory } from "@/types/smartdoc-library";
import { buildSmartDocRegistry } from "@/lib/smartdoc-registry";
import {
  getActivitiesReferencingDocument,
  getLinkedCompaniesForDocument,
  getLinkedContactsForDocument,
  getLinkedPipelineForDocument,
  getMaterialLinksForDocument,
} from "@/lib/smartdoc-registry";

export type Document360Header = {
  displayName: string;
  fileName: string;
  docCategory: string;
  docCategoryLabel: string;
  docType: string;
  documentId: string;
  currentVersion: string;
  revision: string;
  healthScore: number;
  healthStatus: DocumentIntelligence["healthStatus"];
  reviewStatus: DocumentIntelligence["reviewStatus"];
  approvalStatus: DocumentIntelligence["approvalStatus"];
  businessImpactLevel: BusinessImpactLevel;
  ownerLabel: string | null;
  nextBestAction: DocumentIntelligence["nextBestAction"];
};

export type Document360BusinessContext = {
  plNumber: string;
  dealName: string;
  clientName: string;
  commercialStage: string;
};

export type Document360SmartDocsMeta = {
  suggestedName: string;
  suggestedNameStatus: "accepted" | "alternative" | "custom";
  suggestedNameStatusLabel: string;
  createdAt: string;
  uploadedBy: string;
};

export type Document360RelatedItem = {
  id: string;
  name: string;
  href: string;
  meta?: string;
};

export type Document360RelatedGroup = {
  id: string;
  label: string;
  documents: Document360RelatedItem[];
};

export type Document360SetMember = {
  name: string;
  fileName: string;
  role: string;
  isCurrent: boolean;
  href: string | null;
};

export type Document360DocumentSet = {
  documentSetId: string;
  packageId: string;
  href: string;
  title: string;
  kindLabel: string;
  status: string;
  members: Document360SetMember[];
};

export type SharePointVersionEntry = {
  version: string;
  modifiedAt: string;
  modifiedBy: string;
  label: string;
  isCurrent: boolean;
};

export type Document360Snapshot = {
  document: SmartDocRecord;
  libraryRecord: SmartDocLibraryRecord | null;
  header: Document360Header;
  businessContext: Document360BusinessContext;
  identityBreakdown: ReturnType<typeof parseSmartDocIdentity>;
  smartDocsMeta: Document360SmartDocsMeta;
  relatedGroups: Document360RelatedGroup[];
  documentSet: Document360DocumentSet | null;
  memberOf: string | null;
  memberOfHref: string | null;
  sharePointVersions: SharePointVersionEntry[];
  intelligence: DocumentIntelligence;
  companies: Company[];
  contacts: ReturnType<typeof getLinkedContactsForDocument>;
  pipeline: PipelineRow | undefined;
  activities: Activity[];
  materials: ReturnType<typeof getMaterialLinksForDocument>;
  missingReports: MissingDocumentsReport[];
};

function resolveCategoryLabelSafe(category: string): string {
  if (SMARTDOC_CATEGORIES.includes(category as SmartDocCategory)) {
    return resolveCategoryLabel(category as SmartDocCategory);
  }
  return category;
}

function resolveSuggestedNameStatus(
  actualName: string,
  plNumber: string,
  dealName: string,
  clientName: string,
  docType: string,
): Pick<Document360SmartDocsMeta, "suggestedName" | "suggestedNameStatus" | "suggestedNameStatusLabel"> {
  const suggestions = suggestDocumentNames(plNumber, dealName, clientName, docType);
  const trimmed = actualName.trim();

  if (trimmed === suggestions.primary.trim()) {
    return {
      suggestedName: suggestions.primary,
      suggestedNameStatus: "accepted",
      suggestedNameStatusLabel: "SmartDocs primary suggestion accepted",
    };
  }

  if (suggestions.alternatives.some((name) => name.trim() === trimmed)) {
    return {
      suggestedName: suggestions.primary,
      suggestedNameStatus: "alternative",
      suggestedNameStatusLabel: "SmartDocs alternative selected",
    };
  }

  return {
    suggestedName: suggestions.primary,
    suggestedNameStatus: "custom",
    suggestedNameStatusLabel: "Custom document name",
  };
}

function findLibraryRecord(
  document: SmartDocRecord,
  library: SmartDocLibraryRecord[],
): SmartDocLibraryRecord | null {
  return (
    library.find(
      (record) =>
        record.SmartDocID === document.id ||
        record.FileLeafRef === document.fileName ||
        (document.pipelineId && record.DealId === document.pipelineId && record.FileLeafRef === document.fileName),
    ) ?? null
  );
}

function buildRelatedGroups(
  document: SmartDocRecord,
  libraryRecord: SmartDocLibraryRecord | null,
  library: SmartDocLibraryRecord[],
  documentSet: Document360DocumentSet | null,
): Document360RelatedGroup[] {
  const groups: Document360RelatedGroup[] = [];
  const currentId = libraryRecord?.SmartDocID ?? document.id;

  if (libraryRecord) {
    const sameDeal = library
      .filter((record) => record.DealId === libraryRecord.DealId && record.SmartDocID !== currentId)
      .map((record) => ({
        id: record.SmartDocID,
        name: record.DocumentName,
        href: document360Href(record.SmartDocID),
        meta: `${resolveCategoryLabel(record.DocCategory)} · ${record.DocType}`,
      }));

    if (sameDeal.length > 0) {
      groups.push({ id: "deal", label: "Same deal", documents: sameDeal });
    }

    const sameCategory = library
      .filter(
        (record) =>
          record.DealId === libraryRecord.DealId &&
          record.DocCategory === libraryRecord.DocCategory &&
          record.SmartDocID !== currentId,
      )
      .map((record) => ({
        id: record.SmartDocID,
        name: record.DocumentName,
        href: document360Href(record.SmartDocID),
        meta: record.DocType,
      }));

    if (sameCategory.length > 0) {
      groups.push({ id: "category", label: "Same category", documents: sameCategory });
    }
  }

  if (documentSet) {
    const setDocs = documentSet.members
      .filter((member) => !member.isCurrent)
      .map((member) => ({
        id: member.fileName,
        name: member.name,
        href: member.href ?? "#",
        meta: member.role,
      }));

    if (setDocs.length > 0) {
      groups.push({ id: "set", label: "Same document set", documents: setDocs });
    }
  }

  return groups;
}

function findDocumentSet(
  fileName: string,
  dealId: string | null,
  packages: CommercialPackage[],
  library: SmartDocLibraryRecord[],
  libraryRecord: SmartDocLibraryRecord | null,
): Document360DocumentSet | null {
  const pkg = findDocumentSetForFile(fileName, dealId, packages, libraryRecord);
  if (!pkg) return null;

  return {
    documentSetId: pkg.DocumentSetID,
    packageId: pkg.PackageID,
    href: documentSet360Href(pkg.DocumentSetID),
    title: pkg.title,
    kindLabel: documentSetTypeLabel(pkg.kind),
    status: resolveDocumentSetStatus(pkg),
    members: pkg.members.map((member) => {
      const libraryMatch = library.find((record) => record.FileLeafRef === member.fileName);
      return {
        name: smartDocDisplayName(member.fileName),
        fileName: member.fileName,
        role: member.role,
        isCurrent: member.fileName === fileName,
        href: libraryMatch ? document360Href(libraryMatch.SmartDocID) : null,
      };
    }),
  };
}

function buildSharePointVersions(
  libraryRecord: SmartDocLibraryRecord | null,
  revision: string,
): SharePointVersionEntry[] {
  const createdAt = libraryRecord?.CreatedAt ?? new Date().toISOString();
  const currentVersion = sharePointVersionLabel(revision);
  const revisionNumber = Number(revision);
  const versions: SharePointVersionEntry[] = [];

  if (Number.isFinite(revisionNumber) && revisionNumber > 1) {
    for (let index = 1; index < revisionNumber; index += 1) {
      const date = new Date(createdAt);
      date.setDate(date.getDate() - (revisionNumber - index) * 7);
      versions.push({
        version: `${index}.0`,
        modifiedAt: date.toISOString(),
        modifiedBy: "SharePoint",
        label: index === 1 ? "Initial upload" : `Version ${index}.0`,
        isCurrent: false,
      });
    }
  }

  versions.push({
    version: currentVersion,
    modifiedAt: createdAt,
    modifiedBy: libraryRecord ? "SmartCRM · SharePoint sync" : "SharePoint",
    label: "Current version",
    isCurrent: true,
  });

  return versions.reverse();
}

export function buildDocument360Snapshot(
  document: SmartDocRecord,
  pipelines: PipelineRow[],
  companies: Company[],
  activities: Activity[],
  library: SmartDocLibraryRecord[] = [],
  commercialPackages: CommercialPackage[] = [],
): Document360Snapshot {
  const intelligence = computeDocumentIntelligence(
    document,
    pipelines,
    companies,
    activities,
  );
  const pipeline = getLinkedPipelineForDocument(document, pipelines);
  const linkedCompanies = getLinkedCompaniesForDocument(document, companies, pipelines);
  const contacts = getLinkedContactsForDocument(document, linkedCompanies, activities);
  const docActivities = getActivitiesReferencingDocument(document, activities);
  const materials = getMaterialLinksForDocument(document, pipeline);
  const libraryRecord = findLibraryRecord(document, library);

  const dealContext = pipeline
    ? buildDealDocumentContext(pipeline, companies, commercialPackages)
    : {
        plNumber: libraryRecord?.PlNumber ?? document.clientLookup,
        clientName: libraryRecord?.ClientName ?? document.clientLookup,
        dealId: libraryRecord?.DealId ?? document.pipelineId ?? document.clientLookup,
        dealName: libraryRecord?.DealName ?? document.clientLookup,
        commercialStage: libraryRecord?.CommercialStage ?? "—",
        createdAt: libraryRecord?.CreatedAt ?? new Date().toISOString(),
      };

  const businessContext: Document360BusinessContext = {
    plNumber: dealContext.plNumber,
    dealName: dealContext.dealName,
    clientName: dealContext.clientName,
    commercialStage: dealContext.commercialStage,
  };

  const documentId = libraryRecord?.SmartDocID ?? document.id;
  const identityBreakdown = parseSmartDocIdentity(documentId);
  const docCategory = libraryRecord?.DocCategory ?? document.docCategory;
  const docType = libraryRecord?.DocType ?? document.docType;
  const displayName = libraryRecord?.DocumentName ?? document.displayName;
  const revision = libraryRecord?.Revision ?? document.revision;

  const smartDocsMeta: Document360SmartDocsMeta = {
    ...resolveSuggestedNameStatus(
      displayName,
      businessContext.plNumber,
      businessContext.dealName,
      businessContext.clientName,
      docType,
    ),
    createdAt: libraryRecord?.CreatedAt ?? new Date().toISOString(),
    uploadedBy: "SmartCRM",
  };

  const documentSet = findDocumentSet(
    document.fileName,
    document.pipelineId,
    commercialPackages,
    library,
    libraryRecord,
  );

  const relatedGroups = buildRelatedGroups(document, libraryRecord, library, documentSet);
  const sharePointVersions = buildSharePointVersions(libraryRecord, revision);

  const allDocs = buildSmartDocRegistry(pipelines, activities, library);
  const missingReports = [
    ...linkedCompanies.map((c) =>
      computeMissingDocumentsForCompany(c, pipelines, allDocs),
    ),
    ...(pipeline ? [computeMissingDocumentsForDeal(pipeline, allDocs)] : []),
  ].filter((r) => r.missingCount > 0);

  const header: Document360Header = {
    displayName,
    fileName: document.fileName,
    docCategory,
    docCategoryLabel: resolveCategoryLabelSafe(docCategory),
    docType,
    documentId,
    currentVersion: sharePointVersionLabel(revision),
    revision,
    healthScore: intelligence.healthScore,
    healthStatus: intelligence.healthStatus,
    reviewStatus: intelligence.reviewStatus,
    approvalStatus: intelligence.approvalStatus,
    businessImpactLevel: intelligence.insights.businessImpactLevel,
    ownerLabel: intelligence.ownerLabel,
    nextBestAction: intelligence.nextBestAction,
  };

  return {
    document,
    libraryRecord,
    header,
    businessContext,
    identityBreakdown,
    smartDocsMeta,
    relatedGroups,
    documentSet,
    memberOf: libraryRecord?.DocumentSetID ?? documentSet?.documentSetId ?? null,
    memberOfHref:
      libraryRecord?.DocumentSetID || documentSet?.documentSetId
        ? documentSet360Href(libraryRecord?.DocumentSetID ?? documentSet!.documentSetId)
        : null,
    sharePointVersions,
    intelligence,
    companies: linkedCompanies,
    contacts,
    pipeline,
    activities: docActivities,
    materials,
    missingReports,
  };
}
