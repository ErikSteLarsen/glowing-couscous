ALTER TABLE "StravaInboxActivity" ADD COLUMN "notifiedAt" TIMESTAMP(3), ADD COLUMN "dismissedAt" TIMESTAMP(3);
CREATE INDEX "StravaInboxActivity_connectionId_notifiedAt_dismissedAt_idx" ON "StravaInboxActivity"("connectionId", "notifiedAt", "dismissedAt");
ALTER TABLE "StravaWebhookEvent" ADD COLUMN "processingUntil" TIMESTAMP(3), ADD COLUMN "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
-- Recover previously exhausted work through the existing worker, without removing data.
UPDATE "StravaWebhookEvent" SET "status" = 'pending' WHERE "status" = 'failed';
