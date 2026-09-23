-- Confirmed / dismissed document-backed knowledge on the company (user decisions).
ALTER TABLE "company_registry" ADD COLUMN IF NOT EXISTS "documentKnowledge" JSONB;
