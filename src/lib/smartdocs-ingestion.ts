import { getPrisma } from "@/lib/prisma";
import type { M365AttachmentMeta } from "@/lib/m365-client";
import { getGraphAccessToken } from "@/lib/m365/get-graph-access-token";
import {
  ensureOpportunitySharePointFolder,
  uploadFileToSharePointFolder,
} from "@/lib/m365/graph-client";
import { linkOpportunitySharePointFolder } from "@/lib/m365/provision-opportunity-folder";
import { isGraphTransport } from "@/services/sharepoint/config/environment";

export type IngestedSmartDoc = {
  id: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
  source: string;
  externalAttachmentId: string | null;
  opportunityId: string | null;
  emailMessageId: string | null;
  hasContent: boolean;
  sharepointItemId: string | null;
  sharepointWebUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

function toDto(record: {
  id: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
  source: string;
  externalAttachmentId: string | null;
  opportunityId: string | null;
  emailMessageId: string | null;
  contentBase64: string | null;
  sharepointItemId: string | null;
  sharepointWebUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}): IngestedSmartDoc {
  return {
    id: record.id,
    name: record.name,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    source: record.source,
    externalAttachmentId: record.externalAttachmentId,
    opportunityId: record.opportunityId,
    emailMessageId: record.emailMessageId,
    hasContent: Boolean(record.contentBase64) || Boolean(record.sharepointWebUrl),
    sharepointItemId: record.sharepointItemId,
    sharepointWebUrl: record.sharepointWebUrl,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/**
 * When SharePoint Graph transport is enabled, file the attachment into the
 * opportunity folder and clear the Postgres blob (SharePoint is SoT).
 */
async function fileAttachmentToSharePoint(input: {
  opportunityId: string;
  documentId: string;
  fileName: string;
  mimeType: string | null;
  contentBase64: string | null;
}): Promise<{ sharepointItemId: string; sharepointWebUrl: string } | null> {
  if (!isGraphTransport() || !input.contentBase64) return null;

  const siteId = process.env.SHAREPOINT_SITE_ID?.trim();
  if (!siteId) return null;

  const prisma = getPrisma();
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: input.opportunityId },
    select: {
      id: true,
      name: true,
      sharepointFolderId: true,
      sharepointFolderUrl: true,
      sharepointFolderPath: true,
      company: { select: { name: true } },
    },
  });
  if (!opportunity) return null;

  try {
    const accessToken = await getGraphAccessToken();
    let folderId = opportunity.sharepointFolderId;

    if (!folderId) {
      const folder = await ensureOpportunitySharePointFolder(
        accessToken,
        siteId,
        opportunity.company?.name || "General Clients",
        opportunity.name || "Untitled opportunity",
      );
      await linkOpportunitySharePointFolder(opportunity.id, folder);
      folderId = folder.folderId;
    }

    const bytes = Buffer.from(input.contentBase64, "base64");
    const uploaded = await uploadFileToSharePointFolder({
      accessToken,
      siteId,
      folderId,
      fileName: input.fileName,
      contentType: input.mimeType || "application/octet-stream",
      bytes,
    });

    await prisma.documentRecord.update({
      where: { id: input.documentId },
      data: {
        sharepointItemId: uploaded.itemId,
        sharepointWebUrl: uploaded.webUrl,
        // SharePoint is the document backend — drop local blob after success.
        contentBase64: null,
      },
    });

    return {
      sharepointItemId: uploaded.itemId,
      sharepointWebUrl: uploaded.webUrl,
    };
  } catch (error) {
    console.warn("[SmartDocs SharePoint file skipped]", error);
    return null;
  }
}

/**
 * Upsert a DocumentRecord (SmartDocs) linked to Opportunity + EmailMessage.
 * source defaults to "m365_email". When Graph SharePoint is configured, files
 * into the opportunity folder and treats SharePoint as document SoT.
 */
export async function ingestEmailAttachmentToSmartDocs(input: {
  opportunityId: string;
  emailMessageId: string;
  attachment: Pick<
    M365AttachmentMeta,
    "id" | "name" | "contentType" | "size" | "contentBytes"
  >;
}): Promise<IngestedSmartDoc> {
  const prisma = getPrisma();

  const data = {
    name: input.attachment.name,
    mimeType: input.attachment.contentType || null,
    sizeBytes: input.attachment.size ?? null,
    source: "m365_email",
    externalAttachmentId: input.attachment.id,
    contentBase64: input.attachment.contentBytes ?? null,
    opportunityId: input.opportunityId,
    emailMessageId: input.emailMessageId,
  };

  const existing = await prisma.documentRecord.findFirst({
    where: {
      emailMessageId: input.emailMessageId,
      externalAttachmentId: input.attachment.id,
    },
  });

  let record = existing
    ? await prisma.documentRecord.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.documentRecord.create({ data });

  const filed = await fileAttachmentToSharePoint({
    opportunityId: input.opportunityId,
    documentId: record.id,
    fileName: record.name,
    mimeType: record.mimeType,
    contentBase64: record.contentBase64,
  });

  if (filed) {
    record = await prisma.documentRecord.findUniqueOrThrow({
      where: { id: record.id },
    });
  }

  return toDto(record);
}

export async function listDocumentsForEmailMessage(
  emailMessageId: string,
): Promise<IngestedSmartDoc[]> {
  const prisma = getPrisma();
  const records = await prisma.documentRecord.findMany({
    where: { emailMessageId },
    orderBy: { name: "asc" },
  });
  return records.map(toDto);
}

export async function getDocumentRecordById(id: string) {
  const prisma = getPrisma();
  return prisma.documentRecord.findUnique({ where: { id } });
}
