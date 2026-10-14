-- SmartAssist "Ask" explorations: every answer becomes reusable knowledge.
CREATE TABLE "smartassist_explorations" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "askedBy" TEXT NOT NULL,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "smartassist_explorations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "smartassist_explorations_subject_idx" ON "smartassist_explorations"("subject");
CREATE INDEX "smartassist_explorations_createdAt_idx" ON "smartassist_explorations"("createdAt");
