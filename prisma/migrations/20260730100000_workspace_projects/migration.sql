-- CreateTable
CREATE TABLE IF NOT EXISTS "workspace_projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "workspace_projects_name_idx" ON "workspace_projects"("name");
CREATE INDEX IF NOT EXISTS "workspace_projects_updatedAt_idx" ON "workspace_projects"("updatedAt");
