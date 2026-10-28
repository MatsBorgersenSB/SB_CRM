-- "No reply needed" on a mail conversation. Additive only.
CREATE TABLE IF NOT EXISTS "mail_thread_handled" (
  "conversationId" TEXT NOT NULL,
  "handledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "handledBy" TEXT,
  CONSTRAINT "mail_thread_handled_pkey" PRIMARY KEY ("conversationId")
);
