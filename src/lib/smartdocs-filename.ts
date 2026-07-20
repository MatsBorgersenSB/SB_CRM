import type { SmartDocsDocument } from "@/types/pipeline";

const SMARTDOCS_FILENAME_PATTERN =
  /^([A-Z]{2}-\d{4})_([^-]+)-(.+?)\.(\d{2})\s+(.+)\.([^.]+)$/;

export function parseSmartDocsFilename(
  fileName: string,
): SmartDocsDocument | null {
  const match = fileName.match(SMARTDOCS_FILENAME_PATTERN);
  if (!match) return null;

  const [, ClientLookup, DocCategory, DocType, Revision] = match;

  return {
    ClientLookup,
    DocCategory,
    DocType,
    Revision,
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
  return lastDot >= 0 ? fileName.slice(lastDot + 1) : "pdf";
}

export function buildSmartDocsFilename(
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
