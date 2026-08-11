-- Persist Opportunity Understanding answers on Prisma-backed deals.
ALTER TABLE "opportunity_registry" ADD COLUMN IF NOT EXISTS "understanding" JSONB;
