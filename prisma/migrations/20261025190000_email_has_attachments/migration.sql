-- Outlook "has attachments" flag captured at ingest (null = unknown). Additive only.
ALTER TABLE "email_message_records"
  ADD COLUMN "hasAttachments" BOOLEAN;
