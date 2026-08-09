-- FS-009: keep user-purged private / irrelevant mail from re-ingesting on Graph delta.
CREATE TABLE IF NOT EXISTS "email_ingest_exclusions" (
    "id" TEXT NOT NULL,
    "externalMessageId" TEXT,
    "conversationId" TEXT,
    "reason" TEXT DEFAULT 'user_purge',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_ingest_exclusions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_ingest_exclusions_externalMessageId_key"
  ON "email_ingest_exclusions"("externalMessageId");

CREATE INDEX IF NOT EXISTS "email_ingest_exclusions_conversationId_idx"
  ON "email_ingest_exclusions"("conversationId");
