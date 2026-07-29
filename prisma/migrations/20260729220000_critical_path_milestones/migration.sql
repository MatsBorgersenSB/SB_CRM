-- AlterTable
ALTER TABLE "execution_project_milestones"
  ADD COLUMN IF NOT EXISTS "estimatedLeadDays" INTEGER,
  ADD COLUMN IF NOT EXISTS "isCriticalPath" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "vendorName" TEXT,
  ADD COLUMN IF NOT EXISTS "targetDeliveryDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "execution_project_milestones_isCriticalPath_idx"
  ON "execution_project_milestones"("isCriticalPath");
