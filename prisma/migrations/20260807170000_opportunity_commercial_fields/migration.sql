-- AlterTable
ALTER TABLE "opportunity_registry" ADD COLUMN IF NOT EXISTS "companyRole" TEXT;

-- AlterTable
ALTER TABLE "opportunity_registry" ADD COLUMN IF NOT EXISTS "offeringIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
