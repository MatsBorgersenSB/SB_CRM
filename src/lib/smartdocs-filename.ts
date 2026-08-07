import type { SmartDocsDocument } from "@/types/pipeline";
import {
  resolveCategoryCode,
  resolveTypeCode,
} from "@/lib/smartdoc-identity";
import type { SmartDocCategory } from "@/types/smartdoc-library";

/** Legacy: PL-1001_Commercial-Order Confirmation.01 name.pdf */
const LEGACY_SMARTDOCS_FILENAME_PATTERN =
  /^([A-Z]{2}-\d{4})_([^-]+)-(.+?)\.(\d{2})\s+(.+)\.([^.]+)$/;

/** Identity: PL-1001-S-ORC-0001.pdf */
const IDENTITY_SMARTDOCS_FILENAME_PATTERN =
  /^(PL-\d{4})-([A-Z])-([A-Z]{3})-(\d{4})\.([^.]+)$/i;

export function parseSmartDocsFilename(
  fileName: string,
): SmartDocsDocument | null {
  const identity = fileName.match(IDENTITY_SMARTDOCS_FILENAME_PATTERN);
  if (identity) {
    const [, ClientLookup] = identity;
    return {
      ClientLookup: ClientLookup!,
      DocCategory: "",
      DocType: "",
      Revision: "01",
      FileLeafRef: fileName,
    };
  }

  const match = fileName.match(LEGACY_SMARTDOCS_FILENAME_PATTERN);
  if (!match) return null;

  const [, ClientLookup, DocCategory, DocType, Revision] = match;

  return {
    ClientLookup: ClientLookup!,
    DocCategory: DocCategory!,
    DocType: DocType!,
    Revision: Revision!,
    FileLeafRef: fileName,
  };
}

function cleanDocumentName(originalFileName: string): string {
  const lastDot = originalFileName.lastIndexOf(".");
  const baseName =
    lastDot >= 0 ? originalFileName.slice(0, lastDot) : originalFileName;

  return baseName.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function extractExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot >= 0 ? fileName.slice(lastDot + 1).toLowerCase() : "pdf";
}

/**
 * SharePoint file name uses SmartDoc identity codes:
 * PL-1001-S-ORC-0001.pdf
 *
 * `sequenceOrRevision` should be the 4-digit identity sequence (e.g. "0001").
 */
export function buildSmartDocsFilename(
  clientLookup: string,
  docCategory: string,
  docType: string,
  sequenceOrRevision: string,
  originalFileName: string,
): SmartDocsDocument {
  const categoryCode = resolveCategoryCode(
    (docCategory as SmartDocCategory) || "General",
  );
  const typeCode = resolveTypeCode(docType);
  const sequence = sequenceOrRevision.replace(/\D/g, "").padStart(4, "0").slice(-4);
  const extension = extractExtension(originalFileName);
  const documentId = `${clientLookup}-${categoryCode}-${typeCode}-${sequence}`;

  return {
    ClientLookup: clientLookup,
    DocCategory: docCategory,
    DocType: docType,
    Revision: sequence.slice(-2) || "01",
    FileLeafRef: `${documentId}.${extension}`,
  };
}

/** Legacy long labels — kept for older files already in SharePoint. */
export function buildLegacySmartDocsFilename(
  clientLookup: string,
  docCategory: string,
  docType: string,
  revision: string,
  originalFileName: string,
): SmartDocsDocument {
  const documentName = cleanDocumentName(originalFileName);
  const extension = extractExtension(originalFileName);

  return {
    ClientLookup: clientLookup,
    DocCategory: docCategory,
    DocType: docType,
    Revision: revision,
    FileLeafRef: `${clientLookup}_${docCategory}-${docType}.${revision} ${documentName}.${extension}`,
  };
}

export function toSmartDocsDocument(
  record: Partial<SmartDocsDocument>,
): SmartDocsDocument | null {
  if (
    !record.ClientLookup ||
    !record.DocCategory ||
    !record.DocType ||
    !record.Revision ||
    !record.FileLeafRef
  ) {
    return null;
  }

  return {
    ClientLookup: record.ClientLookup,
    DocCategory: record.DocCategory,
    DocType: record.DocType,
    Revision: record.Revision,
    FileLeafRef: record.FileLeafRef,
  };
}
