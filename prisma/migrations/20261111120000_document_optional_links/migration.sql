-- FS-006 Phase 2: optional opportunity/project links without changing SmartDoc ownership.
ALTER TABLE "document_records" ADD COLUMN IF NOT EXISTS "linkedOpportunityId" TEXT;
ALTER TABLE "document_records" ADD COLUMN IF NOT EXISTS "linkedProjectId" TEXT;

CREATE INDEX IF NOT EXISTS "document_records_linkedOpportunityId_idx" ON "document_records"("linkedOpportunityId");
CREATE INDEX IF NOT EXISTS "document_records_linkedProjectId_idx" ON "document_records"("linkedProjectId");
