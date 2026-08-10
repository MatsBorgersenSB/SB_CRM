-- CRM Co-Pilot: durable dismiss-with-reason suppressions
CREATE TABLE IF NOT EXISTS "copilot_dismissals" (
    "id" TEXT NOT NULL,
    "suggestionKey" TEXT NOT NULL,
    "proposalId" TEXT,
    "companyId" TEXT,
    "actionKind" TEXT,
    "note" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL DEFAULT 'anonymous',
    "userDisplayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "copilot_dismissals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "copilot_dismissals_suggestionKey_userEmail_key"
  ON "copilot_dismissals"("suggestionKey", "userEmail");

CREATE INDEX IF NOT EXISTS "copilot_dismissals_suggestionKey_idx"
  ON "copilot_dismissals"("suggestionKey");

CREATE INDEX IF NOT EXISTS "copilot_dismissals_userEmail_idx"
  ON "copilot_dismissals"("userEmail");

CREATE INDEX IF NOT EXISTS "copilot_dismissals_companyId_idx"
  ON "copilot_dismissals"("companyId");
