-- CreateEnum
CREATE TYPE "MeetingProvider" AS ENUM ('m365_graph', 'google_workspace', 'manual');


-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('pending_review', 'processed', 'ignored');


-- CreateEnum
CREATE TYPE "CommitmentState" AS ENUM ('proposed', 'confirmed', 'completed', 'dismissed');


-- CreateEnum
CREATE TYPE "MeetingResponseStatus" AS ENUM ('accepted', 'declined', 'tentative', 'none');


-- CreateTable
CREATE TABLE "meeting_records" (
    "id" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "provider" "MeetingProvider" NOT NULL DEFAULT 'm365_graph',
    "subject" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "webLink" TEXT,
    "organizerEmail" TEXT NOT NULL,
    "aiSummary" TEXT,
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'pending_review',
    "opportunityId" TEXT,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_records_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "meeting_participant_records" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "contactId" TEXT,
    "companyId" TEXT,
    "isExternal" BOOLEAN NOT NULL DEFAULT true,
    "responseStatus" "MeetingResponseStatus" NOT NULL DEFAULT 'none',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_participant_records_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "meeting_commitment_records" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "CommitmentState" NOT NULL DEFAULT 'proposed',
    "confirmedByUserId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_commitment_records_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE INDEX "meeting_records_opportunityId_idx" ON "meeting_records"("opportunityId");


-- CreateIndex
CREATE INDEX "meeting_records_companyId_idx" ON "meeting_records"("companyId");


-- CreateIndex
CREATE INDEX "meeting_records_startTime_idx" ON "meeting_records"("startTime");


-- CreateIndex
CREATE INDEX "meeting_records_syncStatus_idx" ON "meeting_records"("syncStatus");


-- CreateIndex
CREATE UNIQUE INDEX "meeting_records_provider_externalEventId_key" ON "meeting_records"("provider", "externalEventId");


-- CreateIndex
CREATE INDEX "meeting_participant_records_contactId_idx" ON "meeting_participant_records"("contactId");


-- CreateIndex
CREATE INDEX "meeting_participant_records_email_idx" ON "meeting_participant_records"("email");


-- CreateIndex
CREATE UNIQUE INDEX "meeting_participant_records_meetingId_email_key" ON "meeting_participant_records"("meetingId", "email");


-- CreateIndex
CREATE INDEX "meeting_commitment_records_meetingId_idx" ON "meeting_commitment_records"("meetingId");


-- CreateIndex
CREATE INDEX "meeting_commitment_records_status_idx" ON "meeting_commitment_records"("status");


-- CreateIndex
CREATE INDEX "meeting_commitment_records_ownerEmail_idx" ON "meeting_commitment_records"("ownerEmail");


-- AddForeignKey
ALTER TABLE "meeting_records" ADD CONSTRAINT "meeting_records_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunity_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "meeting_records" ADD CONSTRAINT "meeting_records_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "meeting_participant_records" ADD CONSTRAINT "meeting_participant_records_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meeting_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "meeting_participant_records" ADD CONSTRAINT "meeting_participant_records_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "meeting_commitment_records" ADD CONSTRAINT "meeting_commitment_records_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meeting_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

