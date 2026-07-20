import { buildDealDocumentContext } from "@/lib/deal-document-context";
import { buildSmartDocsFilename } from "@/lib/smartdocs-filename";
import { buildDocumentIdentity } from "@/lib/smartdoc-identity";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type {
  CreateSmartDocInput,
  SmartDocLibraryRecord,
} from "@/types/smartdoc-library";

export function buildSmartDocLibraryRecord(
  pipeline: PipelineRow,
  companies: Company[],
  packages: CommercialPackage[],
  existing: SmartDocLibraryRecord[],
  input: CreateSmartDocInput,
): Omit<SmartDocLibraryRecord, "id"> {
  const context = buildDealDocumentContext(pipeline, companies, packages);
  const originalFileName = input.originalFileName ?? `${input.DocumentName}.pdf`;
  const fileLeafRef = buildSmartDocsFilename(
    context.plNumber,
    input.DocCategory,
    input.DocType,
    "01",
    originalFileName,
  );

  const existingIds = existing.map((record) => record.SmartDocID);
  const identity = buildDocumentIdentity(
    context.plNumber,
    input.DocCategory,
    input.DocType,
    existingIds,
  );

  return {
    SmartDocID: identity.documentId,
    DealId: pipeline.id,
    PlNumber: context.plNumber,
    ClientName: context.clientName,
    DealName: context.dealName,
    CommercialStage: context.commercialStage,
    CreatedAt: context.createdAt,
    DocCategory: input.DocCategory,
    DocType: input.DocType,
    DocumentName: input.DocumentName.trim(),
    Revision: "01",
    FileLeafRef: fileLeafRef.FileLeafRef,
  };
}
