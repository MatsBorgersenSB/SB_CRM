-- Outlook deep link for synced mail (Open in Outlook).
ALTER TABLE "email_message_records" ADD COLUMN IF NOT EXISTS "webLink" TEXT;
