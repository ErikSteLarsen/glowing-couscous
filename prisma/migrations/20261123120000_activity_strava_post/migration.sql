-- Remember an activity posted from Tempo to Strava so it is never uploaded twice.
ALTER TABLE "Activity" ADD COLUMN "stravaPostActivityId" TEXT;
ALTER TABLE "Activity" ADD COLUMN "stravaPostUploadId" TEXT;
ALTER TABLE "Activity" ADD COLUMN "stravaPostStartedAt" TIMESTAMP(3);
ALTER TABLE "Activity" ADD COLUMN "stravaPostedAt" TIMESTAMP(3);
