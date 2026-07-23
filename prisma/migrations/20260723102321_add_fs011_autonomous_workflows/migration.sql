-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('active', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('pending_approval', 'approved', 'executed', 'dismissed', 'failed');

-- CreateTable
CREATE TABLE "workflow_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "conditions" JSONB,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_executions" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "companyId" TEXT,
    "actionType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'pending_approval',
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflow_rules_triggerType_idx" ON "workflow_rules"("triggerType");

-- CreateIndex
CREATE INDEX "workflow_rules_status_idx" ON "workflow_rules"("status");

-- CreateIndex
CREATE INDEX "workflow_executions_ruleId_idx" ON "workflow_executions"("ruleId");

-- CreateIndex
CREATE INDEX "workflow_executions_opportunityId_idx" ON "workflow_executions"("opportunityId");

-- CreateIndex
CREATE INDEX "workflow_executions_companyId_idx" ON "workflow_executions"("companyId");

-- CreateIndex
CREATE INDEX "workflow_executions_status_idx" ON "workflow_executions"("status");

-- CreateIndex
CREATE INDEX "workflow_executions_createdAt_idx" ON "workflow_executions"("createdAt");

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "workflow_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunity_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
