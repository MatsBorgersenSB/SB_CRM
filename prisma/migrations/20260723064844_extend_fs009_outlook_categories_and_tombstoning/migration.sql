-- AlterTable
ALTER TABLE "email_message_records" ADD COLUMN "m365CategoryName" TEXT;

-- AlterTable
ALTER TABLE "email_message_records" ADD COLUMN "isDeletedInSource" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "email_message_records" ADD COLUMN "deletedAtInSource" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "email_message_records_isDeletedInSource_idx" ON "email_message_records"("isDeletedInSource");
