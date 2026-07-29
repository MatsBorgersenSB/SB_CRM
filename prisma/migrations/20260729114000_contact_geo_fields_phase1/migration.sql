-- Contact geo enrichment (Phase 1)
ALTER TABLE "contact_registry"
  ADD COLUMN IF NOT EXISTS "streetAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "postalCode" TEXT,
  ADD COLUMN IF NOT EXISTS "stateRegion" TEXT,
  ADD COLUMN IF NOT EXISTS "countryCode" TEXT,
  ADD COLUMN IF NOT EXISTS "continent" TEXT;

