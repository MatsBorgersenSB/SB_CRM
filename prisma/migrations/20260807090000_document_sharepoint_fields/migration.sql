-- SharePoint Online as SmartDoc document backend (item id + web URL)
ALTER TABLE "document_records" ADD COLUMN IF NOT EXISTS "sharepointItemId" TEXT;
ALTER TABLE "document_records" ADD COLUMN IF NOT EXISTS "sharepointWebUrl" TEXT;

CREATE INDEX IF NOT EXISTS "document_records_sharepointItemId_idx" ON "document_records"("sharepointItemId");
