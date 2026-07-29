-- AlterTable
ALTER TABLE "company_registry" ADD COLUMN IF NOT EXISTS "countryCode" TEXT;
ALTER TABLE "company_registry" ADD COLUMN IF NOT EXISTS "continent" TEXT;
