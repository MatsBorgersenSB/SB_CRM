-- FS-018 Phase 4 foundation: durable Teams channel bindings
CREATE TABLE IF NOT EXISTS "teams_channel_bindings" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "companyId" TEXT,
    "projectId" TEXT,
    "boundBy" TEXT,
    "boundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_channel_bindings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "teams_channel_bindings_teamId_channelId_key"
  ON "teams_channel_bindings"("teamId", "channelId");

CREATE INDEX IF NOT EXISTS "teams_channel_bindings_companyId_idx"
  ON "teams_channel_bindings"("companyId");

CREATE INDEX IF NOT EXISTS "teams_channel_bindings_projectId_idx"
  ON "teams_channel_bindings"("projectId");
