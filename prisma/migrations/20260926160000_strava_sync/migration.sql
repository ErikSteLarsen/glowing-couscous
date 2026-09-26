ALTER TABLE "Activity"
ADD COLUMN "externalSource" TEXT,
ADD COLUMN "externalActivityId" TEXT,
ADD COLUMN "sourceMetadataJson" TEXT;

CREATE UNIQUE INDEX "Activity_athleteId_externalSource_externalActivityId_key"
ON "Activity"("athleteId", "externalSource", "externalActivityId");

CREATE TABLE "StravaConnection" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "athleteId" TEXT NOT NULL,
    "athleteName" TEXT,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT NOT NULL,
    "expiresAt" INTEGER NOT NULL,
    "refreshLockUntil" TIMESTAMP(3),
    "scopes" TEXT NOT NULL,
    "authorizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StravaConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StravaInboxActivity" (
    "id" SERIAL NOT NULL,
    "connectionId" TEXT NOT NULL,
    "stravaActivityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sportType" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "distanceMeters" DOUBLE PRECISION,
    "elevationGainMeters" DOUBLE PRECISION,
    "metadataJson" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StravaInboxActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StravaWebhookEvent" (
    "id" SERIAL NOT NULL,
    "eventKey" TEXT NOT NULL,
    "ownerAthleteId" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "aspectType" TEXT NOT NULL,
    "updatesJson" TEXT,
    "eventTime" INTEGER NOT NULL,
    "subscriptionId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "StravaWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StravaConnection_userId_key" ON "StravaConnection"("userId");
CREATE UNIQUE INDEX "StravaConnection_athleteId_key" ON "StravaConnection"("athleteId");
CREATE UNIQUE INDEX "StravaInboxActivity_connectionId_stravaActivityId_key"
ON "StravaInboxActivity"("connectionId", "stravaActivityId");
CREATE INDEX "StravaInboxActivity_connectionId_startedAt_idx"
ON "StravaInboxActivity"("connectionId", "startedAt");
CREATE UNIQUE INDEX "StravaWebhookEvent_eventKey_key" ON "StravaWebhookEvent"("eventKey");
CREATE INDEX "StravaWebhookEvent_status_createdAt_idx" ON "StravaWebhookEvent"("status", "createdAt");
CREATE INDEX "StravaWebhookEvent_ownerAthleteId_objectId_idx"
ON "StravaWebhookEvent"("ownerAthleteId", "objectId");

ALTER TABLE "StravaConnection"
ADD CONSTRAINT "StravaConnection_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StravaInboxActivity"
ADD CONSTRAINT "StravaInboxActivity_connectionId_fkey"
FOREIGN KEY ("connectionId") REFERENCES "StravaConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
