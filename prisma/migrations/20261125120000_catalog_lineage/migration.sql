ALTER TABLE "Session"
  ADD COLUMN "catalogWorkoutSlug" TEXT,
  ADD COLUMN "catalogPlanSlug" TEXT,
  ADD COLUMN "catalogPlanVersion" INTEGER;

ALTER TABLE "Template"
  ADD COLUMN "catalogPlanSlug" TEXT,
  ADD COLUMN "catalogPlanVersion" INTEGER;

CREATE INDEX "Session_catalogWorkoutSlug_idx" ON "Session"("catalogWorkoutSlug");
CREATE INDEX "Session_catalogPlanSlug_catalogPlanVersion_idx" ON "Session"("catalogPlanSlug", "catalogPlanVersion");
CREATE INDEX "Template_catalogPlanSlug_catalogPlanVersion_idx" ON "Template"("catalogPlanSlug", "catalogPlanVersion");
