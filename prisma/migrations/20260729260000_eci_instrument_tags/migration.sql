-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "EciInstrumentType" AS ENUM ('TEMPERATURE', 'PRESSURE', 'GAS_ANALYZER', 'VALVE_ACTUATOR', 'LEVEL_SENSOR', 'FLOW_METER', 'SAFETY_SWITCH');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "EciIoType" AS ENUM ('DIGITAL_INPUT', 'DIGITAL_OUTPUT', 'ANALOG_INPUT', 'ANALOG_OUTPUT', 'MODBUS_RS485', 'PROFINET');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "eci_instrument_tags" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "tagNumber" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "instrumentType" "EciInstrumentType" NOT NULL,
    "ioType" "EciIoType" NOT NULL,
    "exRating" TEXT,
    "isCalibrated" BOOLEAN NOT NULL DEFAULT false,
    "loopChecked" BOOLEAN NOT NULL DEFAULT false,
    "locationZone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eci_instrument_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "eci_instrument_tags_projectId_idx" ON "eci_instrument_tags"("projectId");
CREATE INDEX IF NOT EXISTS "eci_instrument_tags_instrumentType_idx" ON "eci_instrument_tags"("instrumentType");
CREATE INDEX IF NOT EXISTS "eci_instrument_tags_isCalibrated_idx" ON "eci_instrument_tags"("isCalibrated");
CREATE INDEX IF NOT EXISTS "eci_instrument_tags_loopChecked_idx" ON "eci_instrument_tags"("loopChecked");
CREATE UNIQUE INDEX IF NOT EXISTS "eci_instrument_tags_projectId_tagNumber_key" ON "eci_instrument_tags"("projectId", "tagNumber");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'eci_instrument_tags_projectId_fkey'
  ) THEN
    ALTER TABLE "eci_instrument_tags"
      ADD CONSTRAINT "eci_instrument_tags_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "execution_projects"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
