-- Contact intelligence extensions
ALTER TABLE "contact_registry"
  ADD COLUMN IF NOT EXISTS "buyingRole" TEXT,
  ADD COLUMN IF NOT EXISTS "sentiment" TEXT,
  ADD COLUMN IF NOT EXISTS "influenceLevel" TEXT,
  ADD COLUMN IF NOT EXISTS "reportsToId" TEXT,
  ADD COLUMN IF NOT EXISTS "city" TEXT,
  ADD COLUMN IF NOT EXISTS "country" TEXT,
  ADD COLUMN IF NOT EXISTS "timezone" TEXT,
  ADD COLUMN IF NOT EXISTS "isTimezoneOverridden" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "engagementCadence" TEXT,
  ADD COLUMN IF NOT EXISTS "backgroundNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "preferredLanguage" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contact_registry_reportsToId_fkey'
  ) THEN
    ALTER TABLE "contact_registry"
      ADD CONSTRAINT "contact_registry_reportsToId_fkey"
      FOREIGN KEY ("reportsToId")
      REFERENCES "contact_registry"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "contact_registry_reportsToId_idx"
  ON "contact_registry" ("reportsToId");
