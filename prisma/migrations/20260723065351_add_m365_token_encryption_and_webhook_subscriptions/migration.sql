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

-- CreateIndex
CREATE UNIQUE INDEX "webhook_subscriptions_externalSubscriptionId_key" ON "webhook_subscriptions"("externalSubscriptionId");

-- CreateIndex
CREATE INDEX "webhook_subscriptions_integrationId_idx" ON "webhook_subscriptions"("integrationId");

-- CreateIndex
CREATE INDEX "webhook_subscriptions_expiresAt_idx" ON "webhook_subscriptions"("expiresAt");

-- AddForeignKey
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "external_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
