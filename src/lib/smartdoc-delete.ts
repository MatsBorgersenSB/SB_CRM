import "server-only";

import { getGraphAccessToken } from "@/lib/m365/get-graph-access-token";
import { deleteSharePointDriveItem } from "@/lib/m365/graph-client";
import {
  deleteSmartDocLibraryRecord,
  findSmartDocLibraryRecord,
} from "@/lib/pipeline-db";
import { getPrisma } from "@/lib/prisma";
import { isGraphTransport } from "@/services/sharepoint/config/environment";
import type { SmartDocLibraryRecord } from "@/types/smartdoc-library";

export type DeletedSmartDoc = {
  documentId: string;
  libraryRecord: SmartDocLibraryRecord | null;
  prismaDeleted: number;
  sharePointDeleted: number;
};

function nameMatchesIdentity(name: string, identity: string): boolean {
  const file = name.trim();
  const key = identity.trim();
  if (!file || !key) return false;
  return file === key || file.startsWith(`${key} `) || file.startsWith(`${key}.`);
}

async function findPrismaDocumentRecords(
  documentId: string,
  libraryRecord: SmartDocLibraryRecord | null,
) {
  const prisma = getPrisma();
  const byId = await prisma.documentRecord.findUnique({
    where: { id: documentId },
  });
  if (byId) return [byId];

  const names = [
    libraryRecord?.FileLeafRef,
    libraryRecord?.SmartDocID,
    documentId,
  ].filter((value): value is string => Boolean(value?.trim()));

  const uniqueNames = [...new Set(names.map((value) => value.trim()))];
  if (uniqueNames.length === 0) return [];

  const records = await prisma.documentRecord.findMany({
    where: {
      OR: uniqueNames.flatMap((name) => [
        { name },
        { name: { startsWith: `${name} ` } },
        { name: { startsWith: `${name}.` } },
      ]),
    },
  });

  if (libraryRecord?.SharePointWebUrl?.trim()) {
    const byUrl = await prisma.documentRecord.findMany({
      where: { sharepointWebUrl: libraryRecord.SharePointWebUrl.trim() },
    });
    const seen = new Set(records.map((row) => row.id));
    for (const row of byUrl) {
      if (!seen.has(row.id)) records.push(row);
    }
  }

  return records.filter((row) => {
    if (row.id === documentId) return true;
    if (libraryRecord?.FileLeafRef && row.name === libraryRecord.FileLeafRef) {
      return true;
    }
    return uniqueNames.some((name) => nameMatchesIdentity(row.name, name));
  });
}

/**
 * Remove a mistaken SmartDoc: SharePoint file, Prisma document row, library metadata.
 */
export async function deleteSmartDoc(documentId: string): Promise<DeletedSmartDoc> {
  const key = documentId.trim();
  if (!key) {
    throw new Error("Document id is required");
  }

  const libraryRecord = await findSmartDocLibraryRecord(key);
  let prismaRecords: Awaited<ReturnType<typeof findPrismaDocumentRecords>> = [];
  try {
    prismaRecords = await findPrismaDocumentRecords(key, libraryRecord);
  } catch (error) {
    console.warn(
      "[SmartDocs delete] Prisma lookup failed:",
      error instanceof Error ? error.message : error,
    );
  }

  if (!libraryRecord && prismaRecords.length === 0) {
    const error = new Error(`SmartDoc not found: ${key}`);
    (error as Error & { status?: number }).status = 404;
    throw error;
  }

  let sharePointDeleted = 0;
  const siteId = process.env.SHAREPOINT_SITE_ID?.trim();
  if (isGraphTransport() && siteId) {
    const itemIds = [
      ...new Set(
        prismaRecords
          .map((row) => row.sharepointItemId?.trim())
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (itemIds.length > 0) {
      try {
        const accessToken = await getGraphAccessToken();
        for (const itemId of itemIds) {
          await deleteSharePointDriveItem({ accessToken, siteId, itemId });
          sharePointDeleted += 1;
        }
      } catch (error) {
        console.warn(
          "[SmartDocs delete] SharePoint file was not removed:",
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  const prisma = getPrisma();
  let prismaDeleted = 0;
  for (const row of prismaRecords) {
    try {
      await prisma.documentRecord.delete({ where: { id: row.id } });
      prismaDeleted += 1;
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: string }).code)
          : "";
      if (code !== "P2025") throw error;
    }
  }

  const libraryKeys = [
    libraryRecord?.SmartDocID,
    libraryRecord?.FileLeafRef,
    key,
    ...prismaRecords.map((row) => row.name),
    ...prismaRecords.map((row) => {
      const match = row.name.match(
        /^((?:PL|CO|PRJ)-[A-Z0-9]+-[A-Z]-[A-Z]{3}-\d{4})/i,
      );
      return match?.[1];
    }),
  ].filter((value): value is string => Boolean(value?.trim()));

  let removedLibrary = libraryRecord;
  for (const libraryKey of [...new Set(libraryKeys)]) {
    const removed = await deleteSmartDocLibraryRecord(libraryKey);
    if (removed) removedLibrary = removed;
  }

  return {
    documentId: removedLibrary?.SmartDocID ?? key,
    libraryRecord: removedLibrary,
    prismaDeleted,
    sharePointDeleted,
  };
}
