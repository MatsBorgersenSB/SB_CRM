-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "CompanySize" AS ENUM ('micro', 'small', 'medium', 'large', 'unknown');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "RelationshipStatus" AS ENUM ('suggested', 'confirmed', 'active', 'archived');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('reports_to', 'manages', 'colleague', 'advisor', 'consultant', 'supplier', 'customer', 'partner', 'investor', 'decision_influencer', 'technical_influencer', 'other');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('open', 'on_hold', 'closed_won', 'closed_lost', 'archived');

-- CreateEnum
CREATE TYPE "OpportunityStage" AS ENUM ('prospecting', 'qualification', 'discovery', 'proposal', 'negotiation', 'commitment', 'closed_won', 'closed_lost');

-- CreateEnum
CREATE TYPE "InfluenceLevel" AS ENUM ('high', 'medium', 'low', 'unknown');

-- CreateEnum
CREATE TYPE "SentimentStance" AS ENUM ('champion', 'positive', 'neutral', 'blocker', 'unknown');

-- CreateEnum
CREATE TYPE "AuthorityClass" AS ENUM ('economic_buyer', 'technical_decision_maker', 'commercial_decision_maker', 'executive_sponsor');

-- CreateEnum
CREATE TYPE "VerificationState" AS ENUM ('known', 'assumed_unconfirmed', 'unknown');

-- CreateEnum
CREATE TYPE "MeetingProvider" AS ENUM ('m365_graph', 'google_workspace', 'manual');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('pending_review', 'processed', 'ignored');

-- CreateEnum
CREATE TYPE "CommitmentState" AS ENUM ('proposed', 'confirmed', 'completed', 'dismissed');

-- CreateEnum
CREATE TYPE "MeetingResponseStatus" AS ENUM ('accepted', 'declined', 'tentative', 'none');

-- CreateEnum
CREATE TYPE "SentimentGrade" AS ENUM ('positive', 'neutral', 'cautious', 'negative');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('m365_graph', 'google_workspace', 'hubspot', 'salesforce');

-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('upsell', 'cross_sell', 'renewal_risk', 'churn_risk');

-- CreateEnum
CREATE TYPE "SignalStatus" AS ENUM ('detected', 'reviewing', 'actioned', 'dismissed');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('active', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('pending_approval', 'approved', 'executed', 'dismissed', 'failed');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'REP');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'ALERT', 'APPROVAL', 'DEAL_WIN');

-- CreateTable
CREATE TABLE "company_registry" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "alternativeNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "organizationNumber" TEXT,
    "vatNumber" TEXT,
    "website" TEXT,
    "industry" TEXT,
    "size" "CompanySize" NOT NULL DEFAULT 'unknown',
    "types" TEXT[] DEFAULT ARRAY['Prospect']::TEXT[],
    "companyType" TEXT,
    "status" "CompanyStatus" NOT NULL DEFAULT 'active',
    "ownerId" TEXT,
    "parentCompanyId" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "stateRegion" TEXT,
    "country" TEXT,
    "countryCode" TEXT,
    "continent" TEXT,
    "emails" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "phoneNumbers" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_notes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_registry" (
    "id" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "fullName" TEXT,
    "jobTitle" TEXT,
    "preferredContactMethod" TEXT,
    "linkedInUrl" TEXT,
    "buyingRole" TEXT,
    "sentiment" TEXT,
    "influenceLevel" TEXT,
    "reportsToId" TEXT,
    "city" TEXT,
    "country" TEXT,
    "streetAddress" TEXT,
    "postalCode" TEXT,
    "stateRegion" TEXT,
    "countryCode" TEXT,
    "continent" TEXT,
    "timezone" TEXT,
    "isTimezoneOverridden" BOOLEAN NOT NULL DEFAULT false,
    "engagementCadence" TEXT,
    "backgroundNotes" TEXT,
    "preferredLanguage" TEXT,
    "status" "ContactStatus" NOT NULL DEFAULT 'active',
    "personalNotes" TEXT,
    "m365GraphId" TEXT,
    "m365ImmutableId" TEXT,
    "companyId" TEXT,
    "ownerId" TEXT,
    "emails" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "phoneNumbers" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationship_registry" (
    "id" TEXT NOT NULL,
    "sourceContactId" TEXT NOT NULL,
    "targetContactId" TEXT NOT NULL,
    "relationshipType" "RelationshipType" NOT NULL,
    "relationshipStatus" "RelationshipStatus" NOT NULL DEFAULT 'suggested',
    "statusReason" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'user_created',
    "strengthScore" INTEGER DEFAULT 0,
    "confidenceScore" INTEGER DEFAULT 50,
    "ownerId" TEXT,
    "notes" TEXT,
    "aiSummary" TEXT,
    "aiInsights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastAnalyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relationship_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationship_interactions" (
    "id" TEXT NOT NULL,
    "relationshipId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "interactionDate" TIMESTAMP(3) NOT NULL,
    "summary" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relationship_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_registry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "stage" "OpportunityStage" NOT NULL DEFAULT 'prospecting',
    "status" "OpportunityStatus" NOT NULL DEFAULT 'open',
    "value" DOUBLE PRECISION,
    "currency" TEXT DEFAULT 'USD',
    "probability" INTEGER DEFAULT 10,
    "expectedCloseDate" TIMESTAMP(3),
    "description" TEXT,
    "nextStep" TEXT,
    "team" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "sharepointFolderId" TEXT,
    "sharepointFolderUrl" TEXT,
    "sharepointFolderPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunity_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_insights" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "observation" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "expectedOutcome" TEXT,
    "confidence" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stakeholder_influence_profiles" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "influenceLevel" "InfluenceLevel" NOT NULL DEFAULT 'unknown',
    "stance" "SentimentStance" NOT NULL DEFAULT 'unknown',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stakeholder_influence_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_maker_profiles" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "authorityClass" "AuthorityClass" NOT NULL,
    "verificationState" "VerificationState" NOT NULL DEFAULT 'unknown',
    "signOffThreshold" DOUBLE PRECISION,
    "verifiedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decision_maker_profiles_pkey" PRIMARY KEY ("id")
);

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
    "recipientEmails" TEXT[],
    "sentAt" TIMESTAMP(3) NOT NULL,
    "sentiment" "SentimentGrade" NOT NULL DEFAULT 'neutral',
    "isOutbound" BOOLEAN NOT NULL DEFAULT false,
    "m365CategoryName" TEXT,
    "isDeletedInSource" BOOLEAN NOT NULL DEFAULT false,
    "deletedAtInSource" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_message_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_records" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'm365_email',
    "externalAttachmentId" TEXT,
    "contentBase64" TEXT,
    "opportunityId" TEXT,
    "emailMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_integrations" (
    "id" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL DEFAULT 'm365_graph',
    "tenantId" TEXT,
    "userObjectId" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "deltaSyncToken" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_subscriptions" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "externalSubscriptionId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "clientState" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_subscriptions_pkey" PRIMARY KEY ("id")
);

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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expansion_signals_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'REP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_registry_code_key" ON "company_registry"("code");

-- CreateIndex
CREATE UNIQUE INDEX "company_registry_organizationNumber_key" ON "company_registry"("organizationNumber");

-- CreateIndex
CREATE INDEX "company_registry_name_idx" ON "company_registry"("name");

-- CreateIndex
CREATE INDEX "company_registry_code_idx" ON "company_registry"("code");

-- CreateIndex
CREATE INDEX "company_registry_organizationNumber_idx" ON "company_registry"("organizationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "contact_registry_m365GraphId_key" ON "contact_registry"("m365GraphId");

-- CreateIndex
CREATE UNIQUE INDEX "contact_registry_m365ImmutableId_key" ON "contact_registry"("m365ImmutableId");

-- CreateIndex
CREATE INDEX "contact_registry_fullName_idx" ON "contact_registry"("fullName");

-- CreateIndex
CREATE INDEX "contact_registry_companyId_idx" ON "contact_registry"("companyId");

-- CreateIndex
CREATE INDEX "contact_registry_reportsToId_idx" ON "contact_registry"("reportsToId");

-- CreateIndex
CREATE UNIQUE INDEX "relationship_registry_sourceContactId_targetContactId_relat_key" ON "relationship_registry"("sourceContactId", "targetContactId", "relationshipType");

-- CreateIndex
CREATE INDEX "opportunity_registry_companyId_idx" ON "opportunity_registry"("companyId");

-- CreateIndex
CREATE INDEX "opportunity_registry_ownerId_idx" ON "opportunity_registry"("ownerId");

-- CreateIndex
CREATE INDEX "opportunity_registry_stage_idx" ON "opportunity_registry"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "stakeholder_influence_profiles_opportunityId_contactId_key" ON "stakeholder_influence_profiles"("opportunityId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "decision_maker_profiles_opportunityId_contactId_authorityCl_key" ON "decision_maker_profiles"("opportunityId", "contactId", "authorityClass");

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

-- CreateIndex
CREATE INDEX "email_message_records_isDeletedInSource_idx" ON "email_message_records"("isDeletedInSource");

-- CreateIndex
CREATE INDEX "document_records_opportunityId_idx" ON "document_records"("opportunityId");

-- CreateIndex
CREATE INDEX "document_records_emailMessageId_idx" ON "document_records"("emailMessageId");

-- CreateIndex
CREATE INDEX "document_records_source_idx" ON "document_records"("source");

-- CreateIndex
CREATE UNIQUE INDEX "document_records_emailMessageId_externalAttachmentId_key" ON "document_records"("emailMessageId", "externalAttachmentId");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_subscriptions_externalSubscriptionId_key" ON "webhook_subscriptions"("externalSubscriptionId");

-- CreateIndex
CREATE INDEX "webhook_subscriptions_integrationId_idx" ON "webhook_subscriptions"("integrationId");

-- CreateIndex
CREATE INDEX "webhook_subscriptions_expiresAt_idx" ON "webhook_subscriptions"("expiresAt");

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

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_userId_read_idx" ON "notifications"("userId", "read");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- AddForeignKey
ALTER TABLE "company_registry" ADD CONSTRAINT "company_registry_parentCompanyId_fkey" FOREIGN KEY ("parentCompanyId") REFERENCES "company_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_notes" ADD CONSTRAINT "company_notes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_registry" ADD CONSTRAINT "contact_registry_reportsToId_fkey" FOREIGN KEY ("reportsToId") REFERENCES "contact_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_registry" ADD CONSTRAINT "contact_registry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_registry" ADD CONSTRAINT "relationship_registry_sourceContactId_fkey" FOREIGN KEY ("sourceContactId") REFERENCES "contact_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_registry" ADD CONSTRAINT "relationship_registry_targetContactId_fkey" FOREIGN KEY ("targetContactId") REFERENCES "contact_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_interactions" ADD CONSTRAINT "relationship_interactions_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "relationship_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_registry" ADD CONSTRAINT "opportunity_registry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company_registry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_insights" ADD CONSTRAINT "opportunity_insights_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunity_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stakeholder_influence_profiles" ADD CONSTRAINT "stakeholder_influence_profiles_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunity_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stakeholder_influence_profiles" ADD CONSTRAINT "stakeholder_influence_profiles_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_maker_profiles" ADD CONSTRAINT "decision_maker_profiles_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunity_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_maker_profiles" ADD CONSTRAINT "decision_maker_profiles_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "email_message_records" ADD CONSTRAINT "email_message_records_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunity_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_message_records" ADD CONSTRAINT "email_message_records_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_records" ADD CONSTRAINT "document_records_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunity_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_records" ADD CONSTRAINT "document_records_emailMessageId_fkey" FOREIGN KEY ("emailMessageId") REFERENCES "email_message_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "external_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_health_records" ADD CONSTRAINT "account_health_records_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expansion_signals" ADD CONSTRAINT "expansion_signals_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expansion_signals" ADD CONSTRAINT "expansion_signals_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunity_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "workflow_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunity_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
