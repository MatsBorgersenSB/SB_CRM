-- Thermal Tender Ingestion Engine (pyrolysis + torrefaction)
CREATE TABLE IF NOT EXISTS "thermal_tenders" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authorityName" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "publicationDate" TIMESTAMP(3) NOT NULL,
    "submissionDeadline" TIMESTAMP(3) NOT NULL,
    "estimatedBudget" DOUBLE PRECISION,
    "sectorTag" TEXT NOT NULL,
    "technologyType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "rawUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "classifierConfidence" INTEGER,
    "promotedCompanyId" TEXT,
    "promotedOpportunityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "thermal_tenders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "thermal_tenders_externalId_key" ON "thermal_tenders"("externalId");
CREATE INDEX IF NOT EXISTS "thermal_tenders_status_publicationDate_idx" ON "thermal_tenders"("status", "publicationDate");
CREATE INDEX IF NOT EXISTS "thermal_tenders_submissionDeadline_idx" ON "thermal_tenders"("submissionDeadline");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'thermal_tenders_promotedCompanyId_fkey'
  ) THEN
    ALTER TABLE "thermal_tenders"
      ADD CONSTRAINT "thermal_tenders_promotedCompanyId_fkey"
      FOREIGN KEY ("promotedCompanyId") REFERENCES "company_registry"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'thermal_tenders_promotedOpportunityId_fkey'
  ) THEN
    ALTER TABLE "thermal_tenders"
      ADD CONSTRAINT "thermal_tenders_promotedOpportunityId_fkey"
      FOREIGN KEY ("promotedOpportunityId") REFERENCES "opportunity_registry"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
