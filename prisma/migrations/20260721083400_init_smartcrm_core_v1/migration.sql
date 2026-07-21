-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('m365_graph', 'google_workspace', 'hubspot', 'salesforce');

-- AlterTable
ALTER TABLE "contact_registry" ADD COLUMN IF NOT EXISTS "m365GraphId" TEXT,
ADD COLUMN IF NOT EXISTS "m365ImmutableId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "external_integrations" (
    "id" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL DEFAULT 'm365_graph',
    "tenantId" TEXT,
    "userObjectId" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "deltaSyncToken" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "contact_registry_m365GraphId_key" ON "contact_registry"("m365GraphId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "contact_registry_m365ImmutableId_key" ON "contact_registry"("m365ImmutableId");
