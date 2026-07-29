-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AtexZone" AS ENUM ('ZONE_0', 'ZONE_1', 'ZONE_2', 'SAFE_AREA');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "atex_interlocks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "loopName" TEXT NOT NULL,
    "atexZone" "AtexZone" NOT NULL,
    "causeDescription" TEXT NOT NULL,
    "effectDescription" TEXT NOT NULL,
    "isDryTested" BOOLEAN NOT NULL DEFAULT false,
    "isWetTested" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "atex_interlocks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "plc_releases" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "plcTargetName" TEXT NOT NULL,
    "codeVersion" TEXT NOT NULL,
    "backupChecksum" TEXT,
    "notes" TEXT,
    "totalLoopsCount" INTEGER NOT NULL DEFAULT 0,
    "verifiedLoopsCount" INTEGER NOT NULL DEFAULT 0,
    "deployedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plc_releases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "atex_interlocks_projectId_idx" ON "atex_interlocks"("projectId");
CREATE INDEX IF NOT EXISTS "atex_interlocks_atexZone_idx" ON "atex_interlocks"("atexZone");
CREATE INDEX IF NOT EXISTS "atex_interlocks_isDryTested_idx" ON "atex_interlocks"("isDryTested");
CREATE INDEX IF NOT EXISTS "plc_releases_projectId_idx" ON "plc_releases"("projectId");
CREATE INDEX IF NOT EXISTS "plc_releases_createdAt_idx" ON "plc_releases"("createdAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'atex_interlocks_projectId_fkey'
  ) THEN
    ALTER TABLE "atex_interlocks"
      ADD CONSTRAINT "atex_interlocks_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "execution_projects"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plc_releases_projectId_fkey'
  ) THEN
    ALTER TABLE "plc_releases"
      ADD CONSTRAINT "plc_releases_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "execution_projects"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
