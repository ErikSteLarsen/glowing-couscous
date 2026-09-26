ALTER TABLE "Activity"
ADD COLUMN "telemetryJson" TEXT,
ADD COLUMN "importFingerprint" TEXT,
ADD COLUMN "importTitle" TEXT,
ADD COLUMN "importedSessionStatus" TEXT,
ADD COLUMN "distanceMeters" DOUBLE PRECISION,
ADD COLUMN "elevationGainMeters" DOUBLE PRECISION;

CREATE UNIQUE INDEX "Activity_athleteId_importFingerprint_key"
ON "Activity"("athleteId", "importFingerprint");
