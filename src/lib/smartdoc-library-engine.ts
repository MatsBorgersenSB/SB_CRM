import { buildDealDocumentContext } from "@/lib/deal-document-context";
import { buildDocumentIdentity } from "@/lib/smartdoc-identity";
import { buildIdentitySmartDocsFileLeafRef } from "@/lib/smartdocs-filename";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type {
  CreateSmartDocInput,
  SmartDocLibraryRecord,
} from "@/types/smartdoc-library";

/**
 * SharePoint file name = SmartDoc identity + display name + extension
 * e.g. PL-1001-S-ORC-0001 Order Confirmation.pdf
 */
export function buildSmartDocLibraryRecord(
  pipeline: PipelineRow,
  companies: Company[],
  packages: CommercialPackage[],
  existing: SmartDocLibraryRecord[],
  input: CreateSmartDocInput,
): Omit<SmartDocLibraryRecord, "id"> {
  const context = buildDealDocumentContext(pipeline, companies, packages);
  const originalFileName = input.originalFileName ?? `${input.DocumentName}.pdf`;

  const existingIds = existing.map((record) => record.SmartDocID);
  const identity = buildDocumentIdentity(
    context.plNumber,
    input.DocCategory,
    input.DocType,
    existingIds,
  );

  const fileLeafRef = buildIdentitySmartDocsFileLeafRef({
    documentId: identity.documentId,
    documentName: input.DocumentName,
    originalFileName,
  });

  const origin = input.Origin ?? "unknown";
  const counterparty =
    origin === "external" ? input.Counterparty?.trim() || undefined : undefined;

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
    FileLeafRef: fileLeafRef,
    Origin: origin,
    Counterparty: counterparty,
  };
}
