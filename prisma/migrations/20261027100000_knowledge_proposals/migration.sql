-- FS-021: AI-proposed knowledge awaiting user review. Additive only.
CREATE TABLE "knowledge_proposals" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "sourceKind" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceLabel" TEXT NOT NULL,
    "ownerHint" TEXT,
    "dueHint" TEXT,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "editedStatement" TEXT,
    "meetingId" TEXT,
    "opportunityId" TEXT,
    "companyId" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_proposals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "knowledge_proposals_meetingId_status_idx" ON "knowledge_proposals"("meetingId", "status");
CREATE INDEX "knowledge_proposals_opportunityId_status_idx" ON "knowledge_proposals"("opportunityId", "status");
CREATE INDEX "knowledge_proposals_companyId_status_idx" ON "knowledge_proposals"("companyId", "status");
