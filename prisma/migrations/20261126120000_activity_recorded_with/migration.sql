-- How an activity was recorded inside TempoBuilder: 'ride' (Ride recorder) or
-- 'live' (followed in the guided player). NULL for imports and hand-logged ones.
ALTER TABLE "Activity" ADD COLUMN "recordedWith" TEXT;
