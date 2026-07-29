-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "QualityInspectionType" AS ENUM ('FAT_FACTORY_TEST', 'SAT_SITE_TEST', 'ISO_QUALITY_AUDIT', 'SAFETY_CHECK');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "QualityInspectionStatus" AS ENUM ('PASSED', 'FAILED_NCR', 'PENDING_REMEDIATION');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "quality_inspections" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "inspectionType" "QualityInspectionType" NOT NULL,
    "status" "QualityInspectionStatus" NOT NULL,
    "title" TEXT NOT NULL,
    "ncrDescription" TEXT,
    "remediationPlan" TEXT,
    "inspectorName" TEXT,
    "signedOffAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "quality_inspections_projectId_idx" ON "quality_inspections"("projectId");
CREATE INDEX IF NOT EXISTS "quality_inspections_milestoneId_idx" ON "quality_inspections"("milestoneId");
CREATE INDEX IF NOT EXISTS "quality_inspections_inspectionType_idx" ON "quality_inspections"("inspectionType");
CREATE INDEX IF NOT EXISTS "quality_inspections_status_idx" ON "quality_inspections"("status");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quality_inspections_projectId_fkey'
  ) THEN
    ALTER TABLE "quality_inspections"
      ADD CONSTRAINT "quality_inspections_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "execution_projects"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quality_inspections_milestoneId_fkey'
  ) THEN
    ALTER TABLE "quality_inspections"
      ADD CONSTRAINT "quality_inspections_milestoneId_fkey"
      FOREIGN KEY ("milestoneId") REFERENCES "execution_project_milestones"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
