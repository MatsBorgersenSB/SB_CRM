-- Persist public company tracking codes (CO-1001, …) for stable routing.
ALTER TABLE "company_registry" ADD COLUMN IF NOT EXISTS "code" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "company_registry_code_key" ON "company_registry"("code");
CREATE INDEX IF NOT EXISTS "company_registry_code_idx" ON "company_registry"("code");

-- Backfill sequential codes for existing rows missing code.
WITH numbered AS (
  SELECT id, (1000 + ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, id ASC))::text AS seq
  FROM "company_registry"
  WHERE "code" IS NULL OR BTRIM("code") = ''
)
UPDATE "company_registry" AS c
SET "code" = 'CO-' || numbered.seq
FROM numbered
WHERE c.id = numbered.id;
