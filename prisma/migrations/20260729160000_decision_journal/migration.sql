-- CreateTable
CREATE TABLE IF NOT EXISTS "decision_journal" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "opportunityId" TEXT,
    "decisionText" TEXT NOT NULL,
    "rationale" TEXT,
    "stakeholderName" TEXT,
    "category" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "sourceSnippet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_journal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "decision_journal_companyId_idx" ON "decision_journal"("companyId");
CREATE INDEX IF NOT EXISTS "decision_journal_opportunityId_idx" ON "decision_journal"("opportunityId");
CREATE INDEX IF NOT EXISTS "decision_journal_createdAt_idx" ON "decision_journal"("createdAt");
CREATE INDEX IF NOT EXISTS "decision_journal_category_idx" ON "decision_journal"("category");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'decision_journal_companyId_fkey'
  ) THEN
    ALTER TABLE "decision_journal"
      ADD CONSTRAINT "decision_journal_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "company_registry"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'decision_journal_opportunityId_fkey'
  ) THEN
    ALTER TABLE "decision_journal"
      ADD CONSTRAINT "decision_journal_opportunityId_fkey"
      FOREIGN KEY ("opportunityId") REFERENCES "opportunity_registry"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
