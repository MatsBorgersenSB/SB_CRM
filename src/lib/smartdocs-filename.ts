import type { SmartDocsDocument } from "@/types/pipeline";
import {
  resolveCategoryCode,
  resolveTypeCode,
} from "@/lib/smartdoc-identity";
import type { SmartDocCategory } from "@/types/smartdoc-library";

/** Legacy: PL-1001_Commercial-Order Confirmation.01 name.pdf */
const LEGACY_SMARTDOCS_FILENAME_PATTERN =
  /^([A-Z]{2}-\d{4})_([^-]+)-(.+?)\.(\d{2})\s+(.+)\.([^.]+)$/;

/**
 * Identity with display name:
 * PL-1001-S-ORC-0001.pdf
 * PL-1001-S-ORC-0001 Order Confirmation.pdf
 */
const IDENTITY_SMARTDOCS_FILENAME_PATTERN =
  /^(PL-\d{4})-([A-Z])-([A-Z]{3})-(\d{4})(?:\s+.+)?\.([^.]+)$/i;

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

function cleanDocumentName(value: string): string {
  const lastDot = value.lastIndexOf(".");
  const baseName = lastDot >= 0 ? value.slice(0, lastDot) : value;

  return baseName
    .replace(/[~#%*{}\\:<>?/|"]/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function extractExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot >= 0 ? fileName.slice(lastDot + 1).toLowerCase() : "pdf";
}

/**
 * SharePoint file name:
 * PL-1001-S-ORC-0001 Order Confirmation.pdf
 */
export function buildIdentitySmartDocsFileLeafRef(input: {
  documentId: string;
  documentName?: string | null;
  originalFileName?: string | null;
}): string {
  const extension = extractExtension(
    input.originalFileName?.trim() ||
      (input.documentName?.trim() ? `${input.documentName.trim()}.pdf` : "document.pdf"),
  );
  const title =
    cleanDocumentName(input.documentName?.trim() || "") ||
    cleanDocumentName(input.originalFileName?.trim() || "") ||
    "Document";

  return `${input.documentId} ${title}.${extension}`;
}

/**
 * SharePoint file name uses SmartDoc identity codes + display name:
 * PL-1001-S-ORC-0001 Order Confirmation.pdf
 */
export function buildSmartDocsFilename(
  clientLookup: string,
  docCategory: string,
  docType: string,
  sequenceOrRevision: string,
  originalFileName: string,
  documentName?: string,
): SmartDocsDocument {
  const categoryCode = resolveCategoryCode(
    (docCategory as SmartDocCategory) || "General",
  );
  const typeCode = resolveTypeCode(docType);
  const sequence = sequenceOrRevision.replace(/\D/g, "").padStart(4, "0").slice(-4);
  const documentId = `${clientLookup}-${categoryCode}-${typeCode}-${sequence}`;

  return {
    ClientLookup: clientLookup,
    DocCategory: docCategory,
    DocType: docType,
    Revision: sequence.slice(-2) || "01",
    FileLeafRef: buildIdentitySmartDocsFileLeafRef({
      documentId,
      documentName,
      originalFileName,
    }),
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
