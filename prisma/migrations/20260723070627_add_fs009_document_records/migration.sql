-- CreateTable
CREATE TABLE "document_records" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'm365_email',
    "externalAttachmentId" TEXT,
    "contentBase64" TEXT,
    "opportunityId" TEXT,
    "emailMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_records_opportunityId_idx" ON "document_records"("opportunityId");

-- CreateIndex
CREATE INDEX "document_records_emailMessageId_idx" ON "document_records"("emailMessageId");

-- CreateIndex
CREATE INDEX "document_records_source_idx" ON "document_records"("source");

-- CreateIndex
CREATE UNIQUE INDEX "document_records_emailMessageId_externalAttachmentId_key" ON "document_records"("emailMessageId", "externalAttachmentId");

-- AddForeignKey
ALTER TABLE "document_records" ADD CONSTRAINT "document_records_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunity_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_records" ADD CONSTRAINT "document_records_emailMessageId_fkey" FOREIGN KEY ("emailMessageId") REFERENCES "email_message_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
