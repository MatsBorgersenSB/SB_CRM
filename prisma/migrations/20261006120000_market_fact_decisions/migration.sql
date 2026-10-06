-- Decisions on sector market facts. Card text stays in application code.
CREATE TABLE IF NOT EXISTS "market_fact_decisions" (
  "factId" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "market_fact_decisions_pkey" PRIMARY KEY ("factId")
);
