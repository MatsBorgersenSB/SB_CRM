-- Correspondence control: per-mail attachment ledger, file fingerprint, preserved original (.eml).
-- Additive only — no data is changed or removed.
ALTER TABLE "email_message_records"
  ADD COLUMN "attachmentSyncStatus" TEXT,
  ADD COLUMN "attachmentsExpected" INTEGER,
  ADD COLUMN "attachmentsFiled" INTEGER,
  ADD COLUMN "attachmentsSkipped" JSONB,
  ADD COLUMN "attachmentSyncedAt" TIMESTAMP(3),
  ADD COLUMN "originalMimeStored" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "document_records"
  ADD COLUMN "contentSha256" TEXT;

CREATE INDEX "document_records_contentSha256_idx" ON "document_records"("contentSha256");
