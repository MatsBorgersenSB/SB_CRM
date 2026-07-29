-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ExecutionProjectType" AS ENUM ('TURNKEY_PLANT', 'SINGLE_MACHINERY', 'INTERNAL_RD');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProjectHealthStatus" AS ENUM ('ON_TRACK', 'AT_RISK', 'DELAYED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "execution_projects" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "projectType" "ExecutionProjectType" NOT NULL,
    "currentStage" TEXT NOT NULL,
    "trlLevel" INTEGER,
    "companyId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "healthStatus" "ProjectHealthStatus" NOT NULL DEFAULT 'ON_TRACK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "execution_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "execution_project_milestones" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "execution_project_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "execution_projects_companyId_idx" ON "execution_projects"("companyId");
CREATE INDEX IF NOT EXISTS "execution_projects_opportunityId_idx" ON "execution_projects"("opportunityId");
CREATE INDEX IF NOT EXISTS "execution_projects_projectType_idx" ON "execution_projects"("projectType");
CREATE INDEX IF NOT EXISTS "execution_projects_healthStatus_idx" ON "execution_projects"("healthStatus");
CREATE INDEX IF NOT EXISTS "execution_project_milestones_projectId_idx" ON "execution_project_milestones"("projectId");
CREATE INDEX IF NOT EXISTS "execution_project_milestones_stage_idx" ON "execution_project_milestones"("stage");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'execution_projects_companyId_fkey'
  ) THEN
    ALTER TABLE "execution_projects"
      ADD CONSTRAINT "execution_projects_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "company_registry"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'execution_projects_opportunityId_fkey'
  ) THEN
    ALTER TABLE "execution_projects"
      ADD CONSTRAINT "execution_projects_opportunityId_fkey"
      FOREIGN KEY ("opportunityId") REFERENCES "opportunity_registry"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'execution_project_milestones_projectId_fkey'
  ) THEN
    ALTER TABLE "execution_project_milestones"
      ADD CONSTRAINT "execution_project_milestones_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "execution_projects"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
