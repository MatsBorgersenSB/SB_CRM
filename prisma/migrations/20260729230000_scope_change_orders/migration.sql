-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ScopeChangeStatus" AS ENUM ('PROPOSED', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "project_scope_changes" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "decisionJournalId" TEXT,
    "changeTitle" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "costImpactEur" DOUBLE PRECISION NOT NULL,
    "scheduleImpactDays" INTEGER NOT NULL,
    "status" "ScopeChangeStatus" NOT NULL DEFAULT 'PROPOSED',
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_scope_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_scope_changes_projectId_idx" ON "project_scope_changes"("projectId");
CREATE INDEX IF NOT EXISTS "project_scope_changes_decisionJournalId_idx" ON "project_scope_changes"("decisionJournalId");
CREATE INDEX IF NOT EXISTS "project_scope_changes_status_idx" ON "project_scope_changes"("status");
CREATE INDEX IF NOT EXISTS "project_scope_changes_createdAt_idx" ON "project_scope_changes"("createdAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_scope_changes_projectId_fkey'
  ) THEN
    ALTER TABLE "project_scope_changes"
      ADD CONSTRAINT "project_scope_changes_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "execution_projects"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_scope_changes_decisionJournalId_fkey'
  ) THEN
    ALTER TABLE "project_scope_changes"
      ADD CONSTRAINT "project_scope_changes_decisionJournalId_fkey"
      FOREIGN KEY ("decisionJournalId") REFERENCES "decision_journal"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
