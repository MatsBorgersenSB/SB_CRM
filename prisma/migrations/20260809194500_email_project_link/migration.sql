-- Link synced mail to Project Workspace Light (JSON project store; no FK).
ALTER TABLE "email_message_records" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
ALTER TABLE "email_message_records" ADD COLUMN IF NOT EXISTS "projectName" TEXT;

CREATE INDEX IF NOT EXISTS "email_message_records_projectId_idx"
  ON "email_message_records"("projectId");
