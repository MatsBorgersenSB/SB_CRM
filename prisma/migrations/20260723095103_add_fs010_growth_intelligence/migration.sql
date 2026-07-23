-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('upsell', 'cross_sell', 'renewal_risk', 'churn_risk');

-- CreateEnum
CREATE TYPE "SignalStatus" AS ENUM ('detected', 'reviewing', 'actioned', 'dismissed');

-- CreateTable
CREATE TABLE "account_health_records" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "healthScore" INTEGER NOT NULL,
    "engagementScore" INTEGER NOT NULL,
    "sentimentScore" INTEGER NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_health_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expansion_signals" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "type" "SignalType" NOT NULL,
    "status" "SignalStatus" NOT NULL DEFAULT 'detected',
    "title" TEXT NOT NULL,
    "observation" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "expectedOutcome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expansion_signals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_health_records_companyId_idx" ON "account_health_records"("companyId");

-- CreateIndex
CREATE INDEX "account_health_records_calculatedAt_idx" ON "account_health_records"("calculatedAt");

-- CreateIndex
CREATE INDEX "account_health_records_healthScore_idx" ON "account_health_records"("healthScore");

-- CreateIndex
CREATE INDEX "expansion_signals_companyId_idx" ON "expansion_signals"("companyId");

-- CreateIndex
CREATE INDEX "expansion_signals_opportunityId_idx" ON "expansion_signals"("opportunityId");

-- CreateIndex
CREATE INDEX "expansion_signals_type_idx" ON "expansion_signals"("type");

-- CreateIndex
CREATE INDEX "expansion_signals_status_idx" ON "expansion_signals"("status");

-- CreateIndex
CREATE INDEX "expansion_signals_createdAt_idx" ON "expansion_signals"("createdAt");

-- AddForeignKey
ALTER TABLE "account_health_records" ADD CONSTRAINT "account_health_records_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expansion_signals" ADD CONSTRAINT "expansion_signals_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expansion_signals" ADD CONSTRAINT "expansion_signals_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunity_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
