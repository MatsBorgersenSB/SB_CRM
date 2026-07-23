import { getPrisma } from "@/lib/prisma";
import type { M365AttachmentMeta } from "@/lib/m365-client";

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
    hasContent: Boolean(record.contentBase64),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/**
 * Upsert a DocumentRecord (SmartDocs) linked to Opportunity + EmailMessage.
 * source defaults to "m365_email".
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

  const record = existing
    ? await prisma.documentRecord.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.documentRecord.create({ data });

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
