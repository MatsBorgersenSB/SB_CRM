-- Dynamic sector tags on companies. Empty by default — presets live in the app layer.
ALTER TABLE "company_registry"
  ADD COLUMN IF NOT EXISTS "sectors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
