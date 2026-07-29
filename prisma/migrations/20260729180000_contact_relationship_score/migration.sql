-- AlterTable
ALTER TABLE "contact_registry" ADD COLUMN IF NOT EXISTS "relationshipScore" INTEGER;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contact_registry_buyingRole_idx" ON "contact_registry"("buyingRole");
