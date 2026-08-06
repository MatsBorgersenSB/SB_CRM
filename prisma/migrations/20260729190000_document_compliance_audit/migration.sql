-- CreateTable
CREATE TABLE IF NOT EXISTS "document_compliance_audits" (
    "id" TEXT NOT NULL,
    "smartDocId" TEXT,
    "documentRecordId" TEXT,
    "opportunityId" TEXT,
    "companyId" TEXT,
    "documentType" TEXT,
    "overallRiskScore" TEXT NOT NULL,
    "findings" JSONB NOT NULL,
    "rawTextHash" TEXT,
    "sourceSnippet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_compliance_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "document_compliance_audits_smartDocId_idx" ON "document_compliance_audits"("smartDocId");
CREATE INDEX IF NOT EXISTS "document_compliance_audits_documentRecordId_idx" ON "document_compliance_audits"("documentRecordId");
CREATE INDEX IF NOT EXISTS "document_compliance_audits_opportunityId_idx" ON "document_compliance_audits"("opportunityId");
CREATE INDEX IF NOT EXISTS "document_compliance_audits_companyId_idx" ON "document_compliance_audits"("companyId");
CREATE INDEX IF NOT EXISTS "document_compliance_audits_overallRiskScore_idx" ON "document_compliance_audits"("overallRiskScore");
CREATE INDEX IF NOT EXISTS "document_compliance_audits_createdAt_idx" ON "document_compliance_audits"("createdAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'document_compliance_audits_documentRecordId_fkey'
  ) THEN
    ALTER TABLE "document_compliance_audits"
      ADD CONSTRAINT "document_compliance_audits_documentRecordId_fkey"
      FOREIGN KEY ("documentRecordId") REFERENCES "document_records"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'document_compliance_audits_opportunityId_fkey'
  ) THEN
    ALTER TABLE "document_compliance_audits"
      ADD CONSTRAINT "document_compliance_audits_opportunityId_fkey"
      FOREIGN KEY ("opportunityId") REFERENCES "opportunity_registry"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'document_compliance_audits_companyId_fkey'
  ) THEN
    ALTER TABLE "document_compliance_audits"
      ADD CONSTRAINT "document_compliance_audits_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "company_registry"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
