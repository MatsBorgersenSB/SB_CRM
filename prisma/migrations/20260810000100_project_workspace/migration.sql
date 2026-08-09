-- Durable Project Workspace Light store (replaces ephemeral /tmp JSON on Vercel).
CREATE TABLE IF NOT EXISTS "project_workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'customer',
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_workspace_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "project_workspace_kind_idx" ON "project_workspace"("kind");
CREATE INDEX IF NOT EXISTS "project_workspace_name_idx" ON "project_workspace"("name");
