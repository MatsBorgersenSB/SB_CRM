import { findCompanyForDeal } from "@/lib/opportunity-intelligence-engine";
import type { CommercialPackage } from "@/types/commercial-package";
import { COMMERCIAL_PACKAGE_KIND_LABELS } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { SmartDocLibraryRecord } from "@/types/smartdoc-library";
import {
  DOCUMENT_SET_KIND_PREFIX,
  documentSet360Href,
  documentSetTypeLabel,
  resolveDocumentSetStatus,
  type DocumentSet,
  type DocumentSetStatus,
} from "@/types/document-set";
import { document360Href } from "@/types/smartdoc";
import { smartDocDisplayName } from "@/types/smartdoc";

const PACKAGE_PRIORITY: CommercialPackage["kind"][] = [
  "execution",
  "commercial_baseline",
  "transmission",
  "formal_quotation",
  "budget_quotation",
  "price_indication",
];

export type DocumentSetMemberView = {
  role: string;
  documentName: string;
  fileName: string;
  smartDocId: string | null;
  href: string | null;
  present: boolean;
};

export type DocumentSetCompleteness = {
  score: number;
  label: string;
  assigned: number;
  total: number;
};

export type DocumentSet360Snapshot = {
  documentSet: DocumentSet;
  members: DocumentSetMemberView[];
  completeness: DocumentSetCompleteness;
  relatedDocuments: Array<{
    id: string;
    name: string;
    href: string;
    meta: string;
  }>;
  pipeline: PipelineRow | undefined;
};

export function generateDocumentSetId(
  kind: CommercialPackage["kind"],
  existingSets: Array<{ DocumentSetID?: string }>,
): string {
  const prefix = DOCUMENT_SET_KIND_PREFIX[kind];
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  let max = 0;

  for (const record of existingSets) {
    const match = record.DocumentSetID?.match(pattern);
    if (match) max = Math.max(max, Number(match[1]));
  }

  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

export type { DocumentSetStatus };

export function commercialPackageToDocumentSet(
  pkg: CommercialPackage,
  companies: Company[],
  pipelines: PipelineRow[],
  completenessScore?: number,
): DocumentSet {
  const pipeline = pipelines.find((row) => row.id === pkg.DealId);
  const company = findCompanyForDeal(pkg.DealId, companies);
  const documentSetStatus = resolveDocumentSetStatus(pkg, completenessScore);

  return {
    id: pkg.id,
    documentSetId: pkg.DocumentSetID ?? pkg.PackageID,
    packageId: pkg.PackageID,
    dealId: pkg.DealId,
    clientName: company?.Title ?? pkg.ClientName ?? pkg.DealId,
    dealName: pipeline?.assetName ?? pkg.DealId,
    type: pkg.kind,
    typeLabel: documentSetTypeLabel(pkg.kind),
    documentSetStatus,
    title: pkg.title,
    createdAt: pkg.CreatedAt ?? pkg.sentAt ?? pkg.acceptedAt ?? "2026-01-15T10:00:00+01:00",
    createdBy: pkg.CreatedBy ?? "SmartCRM",
    members: pkg.members,
    summary: pkg.summary,
  };
}

export function buildDocumentSets(
  packages: CommercialPackage[],
  companies: Company[],
  pipelines: PipelineRow[],
): DocumentSet[] {
  const byPackageId = new Map(packages.map((pkg) => [pkg.PackageID, pkg]));

  return packages.map((pkg) => {
    const set = commercialPackageToDocumentSet(pkg, companies, pipelines);
    if (pkg.parentPackageId) {
      const parent = byPackageId.get(pkg.parentPackageId);
      set.parentDocumentSetId = parent?.DocumentSetID ?? pkg.parentPackageId;
    }
    return set;
  });
}

export function findDocumentSetById(
  setId: string,
  packages: CommercialPackage[],
  companies: Company[],
  pipelines: PipelineRow[],
): DocumentSet | null {
  const pkg = packages.find(
    (record) =>
      record.DocumentSetID === setId ||
      record.PackageID === setId ||
      String(record.id) === setId,
  );
  if (!pkg) return null;

  const sets = buildDocumentSets(packages, companies, pipelines);
  return sets.find((set) => set.documentSetId === pkg.DocumentSetID || set.packageId === pkg.PackageID) ?? null;
}

export function findDocumentSetForFile(
  fileName: string,
  dealId: string | null,
  packages: CommercialPackage[],
  libraryRecord: SmartDocLibraryRecord | null,
): CommercialPackage | null {
  if (libraryRecord?.DocumentSetID) {
    const byAssignment = packages.find(
      (pkg) => pkg.DocumentSetID === libraryRecord.DocumentSetID,
    );
    if (byAssignment) return byAssignment;
  }

  const candidates = packages.filter((pkg) => {
    if (dealId && pkg.DealId !== dealId) return false;
    return pkg.members.some(
      (member) => member.fileName === fileName || member.Title === fileName,
    );
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const aPriority = PACKAGE_PRIORITY.indexOf(a.kind);
    const bPriority = PACKAGE_PRIORITY.indexOf(b.kind);
    return aPriority - bPriority;
  });

  return candidates[0]!;
}

export function assignDocumentSetToLibrary(
  library: SmartDocLibraryRecord[],
  packages: CommercialPackage[],
): SmartDocLibraryRecord[] {
  return library.map((record) => {
    if (record.DocumentSetID) return record;

    const pkg = findDocumentSetForFile(
      record.FileLeafRef,
      record.DealId ?? "",
      packages,
      record,
    );

    if (!pkg?.DocumentSetID) return record;

    return { ...record, DocumentSetID: pkg.DocumentSetID };
  });
}

export function computeDocumentSetCompleteness(
  members: DocumentSetMemberView[],
): DocumentSetCompleteness {
  const total = members.length;
  const assigned = members.filter((member) => member.present).length;
  const score = total === 0 ? 0 : Math.round((assigned / total) * 100);

  let label = "Incomplete";
  if (score === 100) label = "Complete";
  else if (score >= 75) label = "Nearly complete";
  else if (score >= 50) label = "Partially complete";

  return { score, label, assigned, total };
}

export function buildDocumentSet360Snapshot(
  documentSet: DocumentSet,
  library: SmartDocLibraryRecord[],
  packages: CommercialPackage[],
  pipelines: PipelineRow[],
): DocumentSet360Snapshot {
  const pipeline = pipelines.find((row) => row.id === documentSet.dealId);

  const members: DocumentSetMemberView[] = documentSet.members.map((member) => {
    const libraryMatch = library.find(
      (record) => record.FileLeafRef === member.fileName,
    );

    return {
      role: member.role,
      documentName: libraryMatch?.DocumentName ?? smartDocDisplayName(member.fileName),
      fileName: member.fileName,
      smartDocId: libraryMatch?.SmartDocID ?? null,
      href: libraryMatch ? document360Href(libraryMatch.SmartDocID) : null,
      present: Boolean(libraryMatch),
    };
  });

  const completeness = computeDocumentSetCompleteness(members);

  const pkg = packages.find(
    (p) =>
      p.DocumentSetID === documentSet.documentSetId ||
      p.PackageID === documentSet.packageId,
  );
  const enrichedSet: DocumentSet = pkg
    ? {
        ...documentSet,
        documentSetStatus: resolveDocumentSetStatus(pkg, completeness.score),
      }
    : documentSet;

  const sameDealLibrary = library.filter(
    (record) =>
      record.DealId === enrichedSet.dealId &&
      !members.some((member) => member.smartDocId === record.SmartDocID),
  );

  const relatedDocuments = sameDealLibrary.slice(0, 6).map((record) => ({
    id: record.SmartDocID,
    name: record.DocumentName,
    href: document360Href(record.SmartDocID),
    meta: `${record.DocCategory} · ${record.DocType}`,
  }));

  return {
    documentSet: enrichedSet,
    members,
    completeness,
    relatedDocuments,
    pipeline,
  };
}

export function resolveMemberOfLabel(documentSet: DocumentSet | null): string | null {
  if (!documentSet) return null;
  return documentSet.documentSetId;
}
