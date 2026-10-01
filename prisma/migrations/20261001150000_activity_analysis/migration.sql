CREATE TABLE "ActivityAnalysis" (
    "activityId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "inputHash" TEXT NOT NULL,
    "profileJson" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resultJson" TEXT,
    "correctionJson" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ActivityAnalysis_pkey" PRIMARY KEY ("activityId"),
    CONSTRAINT "ActivityAnalysis_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ActivityAnalysis_status_nextAttemptAt_idx" ON "ActivityAnalysis"("status", "nextAttemptAt");
