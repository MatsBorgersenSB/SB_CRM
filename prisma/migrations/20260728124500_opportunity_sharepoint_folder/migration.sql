-- AlterTable
ALTER TABLE "opportunity_registry" ADD COLUMN IF NOT EXISTS "sharepointFolderId" TEXT;
ALTER TABLE "opportunity_registry" ADD COLUMN IF NOT EXISTS "sharepointFolderUrl" TEXT;
ALTER TABLE "opportunity_registry" ADD COLUMN IF NOT EXISTS "sharepointFolderPath" TEXT;
