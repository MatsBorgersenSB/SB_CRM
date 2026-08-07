import "server-only";

import { getPrisma } from "@/lib/prisma";
import { getGraphAccessToken } from "@/lib/m365/get-graph-access-token";
import {
  ensureOpportunitySharePointFolder,
  uploadFileToSharePointFolder,
} from "@/lib/m365/graph-client";
import { linkOpportunitySharePointFolder } from "@/lib/m365/provision-opportunity-folder";
import {
  createSmartDocLibraryRecord,
  resolvePipelineForSmartDocs,
} from "@/lib/pipeline-db";
import { isGraphTransport } from "@/services/sharepoint/config/environment";
import type {
  CreateSmartDocInput,
  SmartDocLibraryRecord,
} from "@/types/smartdoc-library";

export type ImportedOpportunitySmartDoc = {
  libraryRecord: SmartDocLibraryRecord;
  documentRecordId: string | null;
  sharepointWebUrl: string | null;
};

/**
 * Create SmartDoc library metadata and, when a file is provided + Graph is on,
 * push the binary into the opportunity SharePoint folder (document SoT).
 */
export async function importOpportunitySmartDoc(input: {
  dealId: string;
  metadata: CreateSmartDocInput;
  file?: {
    bytes: Buffer;
    mimeType: string | null;
    originalFileName: string;
  };
}): Promise<ImportedOpportunitySmartDoc> {
  const pipeline = await resolvePipelineForSmartDocs(input.dealId);
  if (!pipeline) {
    throw new Error(`Pipeline not found: ${input.dealId}`);
  }

  const metadata: CreateSmartDocInput = {
    ...input.metadata,
    originalFileName:
      input.metadata.originalFileName ??
      input.file?.originalFileName ??
      undefined,
  };

  const libraryRecord = await createSmartDocLibraryRecord(pipeline.id, metadata);

  if (!input.file?.bytes?.length) {
    return {
      libraryRecord,
      documentRecordId: null,
      sharepointWebUrl: null,
    };
  }

  const fileName =
    libraryRecord.FileLeafRef?.trim() ||
    input.file.originalFileName ||
    libraryRecord.DocumentName;

  let sharepointItemId: string | null = null;
  let sharepointWebUrl: string | null = null;
  let contentBase64: string | null = input.file.bytes.toString("base64");

  if (isGraphTransport()) {
    const siteId = process.env.SHAREPOINT_SITE_ID?.trim();
    if (siteId) {
      try {
        const prisma = getPrisma();
        const opportunity = await prisma.opportunity.findUnique({
          where: { id: pipeline.id },
          select: {
            id: true,
            name: true,
            sharepointFolderId: true,
            company: { select: { name: true } },
          },
        });

        if (opportunity) {
          const accessToken = await getGraphAccessToken();
          let folderId = opportunity.sharepointFolderId;

          if (!folderId) {
            const folder = await ensureOpportunitySharePointFolder(
              accessToken,
              siteId,
              opportunity.company?.name ||
                pipeline.ClientLookup ||
                "General Clients",
              opportunity.name || pipeline.assetName,
            );
            await linkOpportunitySharePointFolder(opportunity.id, folder);
            folderId = folder.folderId;
          }

          const uploaded = await uploadFileToSharePointFolder({
            accessToken,
            siteId,
            folderId,
            fileName,
            contentType: input.file.mimeType || "application/octet-stream",
            bytes: input.file.bytes,
          });

          sharepointItemId = uploaded.itemId;
          sharepointWebUrl = uploaded.webUrl;
          contentBase64 = null;
        }
      } catch (error) {
        console.warn(
          "[SmartDocs import] SharePoint upload failed — keeping library record:",
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  try {
    const prisma = getPrisma();
    const document = await prisma.documentRecord.create({
      data: {
        name: fileName,
        mimeType: input.file.mimeType,
        sizeBytes: input.file.bytes.length,
        source: "upload",
        contentBase64,
        sharepointItemId,
        sharepointWebUrl,
        opportunityId: pipeline.id,
      },
    });

    return {
      libraryRecord,
      documentRecordId: document.id,
      sharepointWebUrl: document.sharepointWebUrl,
    };
  } catch (error) {
    console.warn(
      "[SmartDocs import] DocumentRecord create failed:",
      error instanceof Error ? error.message : error,
    );
    return {
      libraryRecord,
      documentRecordId: null,
      sharepointWebUrl,
    };
  }
}
