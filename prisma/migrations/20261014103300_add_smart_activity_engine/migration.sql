-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('MEETING', 'TEAMS_MEETING', 'PHONE_CALL', 'EMAIL_FOLLOW_UP', 'SITE_VISIT', 'COMMERCIAL_REVIEW', 'TASK', 'NOTE', 'TRADESHOW', 'SEMINAR');

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "activityType" "ActivityType" NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isAiProposed" BOOLEAN NOT NULL DEFAULT false,
    "aiContext" JSONB,
    "companyId" TEXT,
    "opportunityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activities_companyId_idx" ON "activities"("companyId");

-- CreateIndex
CREATE INDEX "activities_opportunityId_idx" ON "activities"("opportunityId");

-- CreateIndex
CREATE INDEX "activities_activityType_idx" ON "activities"("activityType");

-- CreateIndex
CREATE INDEX "activities_startDate_idx" ON "activities"("startDate");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunity_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
