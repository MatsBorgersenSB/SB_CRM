-- Activities become the single store: a human-readable sequence (ACT-n) and
-- the full record (owner, next action, decisions, commitments, risks, links).
ALTER TABLE "activities"
  ADD COLUMN "seq" SERIAL NOT NULL,
  ADD COLUMN "details" JSONB;

CREATE UNIQUE INDEX "activities_seq_key" ON "activities"("seq");
