-- FS-006: company-owned SmartDocs — optional DocumentRecord.companyId
ALTER TABLE "document_records" ADD COLUMN IF NOT EXISTS "companyId" TEXT;

CREATE INDEX IF NOT EXISTS "document_records_companyId_idx" ON "document_records"("companyId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'document_records_companyId_fkey'
  ) THEN
    ALTER TABLE "document_records"
      ADD CONSTRAINT "document_records_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "company_registry"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
