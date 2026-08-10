import { buildDealDocumentContext } from "@/lib/deal-document-context";
import {
  buildDocumentIdentity,
} from "@/lib/smartdoc-identity";
import { buildIdentitySmartDocsFileLeafRef } from "@/lib/smartdocs-filename";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type {
  CompanyDocumentContext,
  CreateSmartDocInput,
  SmartDocLibraryRecord,
} from "@/types/smartdoc-library";
import { companyDocumentsSharePointPath } from "@/types/smartdoc-library";

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

  const ownerCompany =
    companies.find((row) => row.pipelineIds.includes(pipeline.id)) ??
    companies.find(
      (row) =>
        row.Title.trim().toLowerCase() === context.clientName.trim().toLowerCase(),
    );

  return {
    SmartDocID: identity.documentId,
    DealId: pipeline.id,
    OwnerCompanyId: ownerCompany?.CompanyID,
    Ownership: "opportunity",
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
    LinkedDealId: input.LinkedDealId?.trim() || null,
    LinkedProjectId: input.LinkedProjectId?.trim() || null,
  };
}

/**
 * Company-owned SmartDoc — no DealId required (FS-006).
 * e.g. CO-1009-S-SUQ-0001 Dorset Quotation.pdf
 */
export function buildCompanySmartDocLibraryRecord(
  context: CompanyDocumentContext,
  existing: SmartDocLibraryRecord[],
  input: CreateSmartDocInput,
): Omit<SmartDocLibraryRecord, "id"> {
  const originalFileName = input.originalFileName ?? `${input.DocumentName}.pdf`;
  const existingIds = existing.map((record) => record.SmartDocID);
  const identity = buildDocumentIdentity(
    context.companyCode,
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
    origin === "external"
      ? input.Counterparty?.trim() || context.companyName
      : undefined;

  const folderPath =
    context.sharePointFolderPath ||
    companyDocumentsSharePointPath(context.companyName);

  return {
    SmartDocID: identity.documentId,
    DealId: null,
    OwnerCompanyId: context.companyId,
    Ownership: "company",
    PlNumber: context.companyCode,
    ClientName: context.companyName,
    DealName: "",
    CommercialStage: "",
    CreatedAt: context.createdAt,
    DocCategory: input.DocCategory,
    DocType: input.DocType,
    DocumentName: input.DocumentName.trim(),
    Revision: "01",
    FileLeafRef: fileLeafRef,
    Origin: origin,
    Counterparty: counterparty,
    SharePointFolderPath: folderPath,
    LinkedDealId: input.LinkedDealId?.trim() || null,
    LinkedProjectId: input.LinkedProjectId?.trim() || null,
  };
}

export function buildCompanyDocumentContext(
  company: Company,
  now = new Date().toISOString(),
): CompanyDocumentContext {
  const companyCode =
    (company.code?.trim() && /^CO-[A-Z0-9]+$/i.test(company.code.trim())
      ? company.code.trim().toUpperCase()
      : null) ||
    (company.CompanyID.trim() && /^CO-[A-Z0-9]+$/i.test(company.CompanyID.trim())
      ? company.CompanyID.trim().toUpperCase()
      : null);

  if (!companyCode) {
    throw new Error(
      `Company ${company.Title} is missing a CO-… code required for company SmartDocs`,
    );
  }

  return {
    companyId: company.CompanyID,
    companyCode,
    companyName: company.Title,
    sharePointFolderPath: companyDocumentsSharePointPath(company.Title),
    createdAt: now,
  };
}
