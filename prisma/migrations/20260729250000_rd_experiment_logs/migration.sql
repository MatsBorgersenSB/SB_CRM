-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "IpFilingStatus" AS ENUM ('NONE', 'PROVISIONAL_FILED', 'PATENT_GRANTED', 'TRADE_SECRET');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "rd_experiment_logs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "experimentTitle" TEXT NOT NULL,
    "trlStage" INTEGER NOT NULL,
    "feedstockType" TEXT,
    "reactorTempCelsius" DOUBLE PRECISION,
    "residenceTimeMinutes" DOUBLE PRECISION,
    "yieldPercentage" DOUBLE PRECISION,
    "ipFilingStatus" "IpFilingStatus" NOT NULL DEFAULT 'NONE',
    "keyFindings" TEXT NOT NULL,
    "loggedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rd_experiment_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rd_experiment_logs_projectId_idx" ON "rd_experiment_logs"("projectId");
CREATE INDEX IF NOT EXISTS "rd_experiment_logs_trlStage_idx" ON "rd_experiment_logs"("trlStage");
CREATE INDEX IF NOT EXISTS "rd_experiment_logs_createdAt_idx" ON "rd_experiment_logs"("createdAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rd_experiment_logs_projectId_fkey'
  ) THEN
    ALTER TABLE "rd_experiment_logs"
      ADD CONSTRAINT "rd_experiment_logs_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "execution_projects"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
