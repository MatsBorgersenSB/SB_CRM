-- AlterTable
ALTER TABLE "opportunity_registry" ADD COLUMN IF NOT EXISTS "code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "opportunity_registry_code_key" ON "opportunity_registry"("code");
