-- Convert company types from enum[] to text[] for multi-select presets.
-- Keep legacy enum labels readable; app layer canonicalizes on read/write.

ALTER TABLE "company_registry"
  ALTER COLUMN "types" DROP DEFAULT;

ALTER TABLE "company_registry"
  ALTER COLUMN "types" TYPE TEXT[]
  USING (
    CASE
      WHEN "types" IS NULL THEN ARRAY[]::TEXT[]
      ELSE ARRAY(
        SELECT CASE e::text
          WHEN 'customer' THEN 'Prospect'
          WHEN 'customer' THEN 'Customer'
          WHEN 'partner' THEN 'Partner'
          WHEN 'competitor' THEN 'Competitor'
          WHEN 'supplier' THEN 'Supplier / Vendor'
          WHEN 'internal' THEN 'Internal Company'
          WHEN 'other' THEN 'Prospect'
          ELSE initcap(e::text)
        END
        FROM unnest("types") AS e
      )
    END
  );

ALTER TABLE "company_registry"
  ALTER COLUMN "types" SET DEFAULT ARRAY['Prospect']::TEXT[];

ALTER TABLE "company_registry"
  ADD COLUMN IF NOT EXISTS "companyType" TEXT;

-- Drop unused enum if no longer referenced
DROP TYPE IF EXISTS "CompanyType";
