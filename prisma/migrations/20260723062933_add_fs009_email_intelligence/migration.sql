-- CreateEnum
CREATE TYPE "SentimentGrade" AS ENUM ('positive', 'neutral', 'cautious', 'negative');

-- CreateTable
CREATE TABLE "email_message_records" (
    "id" TEXT NOT NULL,
    "externalMessageId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "contactId" TEXT,
    "subject" TEXT NOT NULL,
    "bodyPreview" TEXT,
    "senderEmail" TEXT NOT NULL,
    "recipientEmails" TEXT[] NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "sentiment" "SentimentGrade" NOT NULL DEFAULT 'neutral',
    "isOutbound" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_message_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_message_records_externalMessageId_key" ON "email_message_records"("externalMessageId");

-- CreateIndex
CREATE INDEX "email_message_records_conversationId_idx" ON "email_message_records"("conversationId");

-- CreateIndex
CREATE INDEX "email_message_records_opportunityId_idx" ON "email_message_records"("opportunityId");

-- CreateIndex
CREATE INDEX "email_message_records_contactId_idx" ON "email_message_records"("contactId");

-- CreateIndex
CREATE INDEX "email_message_records_sentAt_idx" ON "email_message_records"("sentAt");

-- CreateIndex
CREATE INDEX "email_message_records_senderEmail_idx" ON "email_message_records"("senderEmail");

-- AddForeignKey
ALTER TABLE "email_message_records" ADD CONSTRAINT "email_message_records_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunity_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_message_records" ADD CONSTRAINT "email_message_records_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
