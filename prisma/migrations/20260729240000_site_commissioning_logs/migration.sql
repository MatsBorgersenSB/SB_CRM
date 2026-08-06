-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CommissioningPhase" AS ENUM ('COLD_COMMISSIONING', 'HOT_COMMISSIONING', 'SYNGAS_TESTING', 'PERFORMANCE_RUN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "commissioning_logs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phase" "CommissioningPhase" NOT NULL,
    "safetyCheckPassed" BOOLEAN NOT NULL DEFAULT false,
    "atexZoningVerified" BOOLEAN NOT NULL DEFAULT false,
    "logTitle" TEXT NOT NULL,
    "operationalNotes" TEXT,
    "issuesEncountered" TEXT,
    "loggedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commissioning_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "commissioning_logs_projectId_idx" ON "commissioning_logs"("projectId");
CREATE INDEX IF NOT EXISTS "commissioning_logs_phase_idx" ON "commissioning_logs"("phase");
CREATE INDEX IF NOT EXISTS "commissioning_logs_createdAt_idx" ON "commissioning_logs"("createdAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'commissioning_logs_projectId_fkey'
  ) THEN
    ALTER TABLE "commissioning_logs"
      ADD CONSTRAINT "commissioning_logs_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "execution_projects"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
