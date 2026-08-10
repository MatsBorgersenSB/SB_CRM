import { parseSmartDocsFilename } from "@/lib/smartdocs-filename";
import { inferCommercialStage } from "@/lib/deal-document-context";
import { buildDocumentIdentity, suggestDocumentName } from "@/lib/smartdoc-identity";
import { assignDocumentSetToLibrary, findDocumentSetForFile } from "@/lib/document-set-engine";
import { findCompanyForDeal } from "@/lib/opportunity-intelligence-engine";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { CommercialPackage } from "@/types/commercial-package";
import type { SmartDocLibraryRecord } from "@/types/smartdoc-library";

function seedFromPipeline(
  pipeline: PipelineRow,
  companies: Company[],
  packages: CommercialPackage[],
  id: number,
  existingIds: string[],
): SmartDocLibraryRecord | null {
  if (!pipeline.FileLeafRef?.trim()) return null;

  const parsed = parseSmartDocsFilename(pipeline.FileLeafRef);
  const company = findCompanyForDeal(pipeline.id, companies);
  const context = inferCommercialStage(pipeline, packages);
  const docCategory = (parsed?.DocCategory ??
    pipeline.DocCategory ??
    "General") as SmartDocLibraryRecord["DocCategory"];
  const docType = parsed?.DocType ?? pipeline.DocType ?? "Unclassified Document";
  const identity = buildDocumentIdentity(
    pipeline.id,
    docCategory,
    docType,
    existingIds,
  );

  const pkg = findDocumentSetForFile(pipeline.FileLeafRef, pipeline.id, packages, null);

  return {
    id,
    SmartDocID: identity.documentId,
    DealId: pipeline.id,
    OwnerCompanyId: company?.CompanyID,
    Ownership: "opportunity",
    PlNumber: pipeline.id,
    ClientName: company?.Title ?? pipeline.ClientLookup ?? pipeline.id,
    DealName: pipeline.assetName,
    CommercialStage: context,
    CreatedAt: "2026-01-15T10:00:00+01:00",
    DocCategory: docCategory,
    DocType: docType,
    DocumentName: suggestDocumentName(pipeline.assetName, docType),
    Revision: parsed?.Revision ?? pipeline.Revision ?? "01",
    FileLeafRef: pipeline.FileLeafRef,
    DocumentSetID: pkg?.DocumentSetID,
  };
}

export function buildDefaultSmartDocsLibrary(
  pipelines: PipelineRow[],
  companies: Company[],
  packages: CommercialPackage[],
): SmartDocLibraryRecord[] {
  const records: SmartDocLibraryRecord[] = [];
  const existingIds: string[] = [];
  let id = 1;

  for (const pipeline of pipelines) {
    const record = seedFromPipeline(pipeline, companies, packages, id, existingIds);
    if (record) {
      records.push(record);
      existingIds.push(record.SmartDocID);
      id += 1;
    }
  }

  for (const pkg of packages) {
    for (const member of pkg.members) {
      if (records.some((record) => record.FileLeafRef === member.fileName)) continue;

      const pipeline = pipelines.find((row) => row.id === pkg.DealId);
      if (!pipeline) continue;

      const parsed = parseSmartDocsFilename(member.fileName);
      const company = findCompanyForDeal(pipeline.id, companies);
      const docCategory = (member.DocCategory ??
        parsed?.DocCategory ??
        "Commercial") as SmartDocLibraryRecord["DocCategory"];
      const docType = parsed?.DocType ?? member.role;
      const identity = buildDocumentIdentity(
        pipeline.id,
        docCategory,
        docType,
        existingIds,
      );

      records.push({
        id,
        SmartDocID: identity.documentId,
        DealId: pipeline.id,
        OwnerCompanyId: company?.CompanyID,
        Ownership: "opportunity",
        PlNumber: pipeline.id,
        ClientName: company?.Title ?? pipeline.id,
        DealName: pipeline.assetName,
        CommercialStage: inferCommercialStage(pipeline, packages),
        CreatedAt: pkg.CreatedAt ?? pkg.sentAt ?? pkg.acceptedAt ?? "2026-02-01T10:00:00+01:00",
        DocCategory: docCategory,
        DocType: docType,
        DocumentName: suggestDocumentName(pipeline.assetName, docType),
        Revision: member.Revision ?? parsed?.Revision ?? "01",
        FileLeafRef: member.fileName,
        DocumentSetID: pkg.DocumentSetID,
      });
      existingIds.push(identity.documentId);
      id += 1;
    }
  }

  return assignDocumentSetToLibrary(records, packages);
}
